/* =============================================================================
 * GLA Central Library - shared core (js/main.js)
 * Owner: Suryansh Saxena (architecture)
 *
 * Every page loads this file first. It provides:
 *   1. Library rules and role based access control (RBAC)
 *   2. A JSON "database" - seeded from data/*.json and persisted in the browser
 *   3. Authentication (hashed passwords + session)
 *   4. Loan / fine / request logic shared by the dashboard, desk and details page
 *   5. Shared layout (navbar + footer), toasts, confirm dialog and helpers
 *   6. LIB.page() - the bootstrapper each page script calls
 * ============================================================================= */

const LIB = (function () {
  "use strict";

  /* ---------------------------------------------------------------------------
   * 1. Rules and RBAC
   * ------------------------------------------------------------------------- */

  const RULES = {
    FINE_PER_DAY: 10, // Rs per day once a book is overdue
    DUE_SOON_DAYS: 3, // "due soon" warning window
    RENEW_DAYS: 7, // a renewal adds this many days (once per loan)
  };

  const ROLES = {
    guest: { label: "Guest", loanDays: 0, home: "index.html" },
    student: { label: "Student", loanDays: 14, home: "member-dashboard.html" },
    faculty: { label: "Faculty", loanDays: 30, home: "member-dashboard.html" },
    librarian: { label: "Librarian", loanDays: 0, home: "admin.html" },
  };

  const MEMBER_PERMISSIONS = [
    "catalogue.view",
    "resources.view",
    "resources.open",
    "resources.save",
    "dashboard.view",
    "books.request",
    "books.review",
    "loans.renew",
  ];

  // Single source of truth for "who can do what". Pages and buttons call LIB.can().
  const PERMISSIONS = {
    guest: ["catalogue.view", "resources.view"],
    student: MEMBER_PERMISSIONS,
    faculty: MEMBER_PERMISSIONS,
    librarian: [
      "catalogue.view",
      "resources.view",
      "resources.open",
      "desk.issue",
      "desk.return",
      "requests.manage",
      "books.manage",
      "members.manage",
      "resources.manage",
      "data.manage",
    ],
  };

  /* ---------------------------------------------------------------------------
   * 2. Small helpers
   * ------------------------------------------------------------------------- */

  const $ = (id) => document.getElementById(id);

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // local date as yyyy-mm-dd (toISOString() would give the UTC date)
  function isoDate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function today() {
    return isoDate(new Date());
  }

  function parseDate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(iso, days) {
    const d = parseDate(iso);
    d.setDate(d.getDate() + days);
    return isoDate(d);
  }

  // whole days from a to b (positive when b is after a)
  function daysBetween(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    return parseDate(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function money(n) {
    return "Rs " + Number(n || 0).toLocaleString("en-IN");
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // "Dr. R. K. Agarwal" -> "Agarwal", "Suryansh Saxena" -> "Suryansh"
  function shortName(name) {
    const words = String(name).split(/\s+/).filter((w) => !w.endsWith("."));
    return words[0] || String(name);
  }

  function currentPage() {
    return location.pathname.split("/").pop() || "index.html";
  }

  /* SHA-256 in plain JS, so passwords are never stored as plain text.
   * (crypto.subtle only works on https/localhost, this works everywhere.) */
  function sha256(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    const H = [];
    const K = [];
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    for (let n = 2, found = 0; found < 64; n++) {
      let prime = true;
      for (let d = 2; d * d <= n; d++) {
        if (n % d === 0) {
          prime = false;
          break;
        }
      }
      if (!prime) continue;
      if (found < 8) H[found] = frac(Math.pow(n, 1 / 2));
      K[found] = frac(Math.pow(n, 1 / 3));
      found++;
    }

    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);

    const rotr = (x, r) => (x >>> r) | (x << (32 - r));
    for (let off = 0; off < bytes.length; off += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        w[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) | 0));
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }

  function hashPassword(email, password) {
    return sha256("lms:" + String(email).trim().toLowerCase() + ":" + password);
  }

  /* ---------------------------------------------------------------------------
   * 3. JSON database
   *    data/*.json is the seed. On the first visit every file is fetched once
   *    and the whole database is kept in localStorage, so issues, returns,
   *    sign ups and edits survive a page refresh. "Reset demo data" reseeds
   *    from the JSON files and the librarian can export the current state
   *    back out as JSON.
   * ------------------------------------------------------------------------- */

  const DB_KEY = "gla_lms_db";
  const DB_VERSION = 3;
  const COLLECTIONS = {
    books: "id",
    members: "memberId",
    resources: "id",
    transactions: "id",
    requests: "id",
  };
  let store = null;

  async function seed() {
    const data = { version: DB_VERSION, seededOn: today() };
    const names = Object.keys(COLLECTIONS);
    const files = await Promise.all(
      names.map(async function (name) {
        const res = await fetch("data/" + name + ".json", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load data/" + name + ".json (HTTP " + res.status + ")");
        return res.json();
      })
    );
    names.forEach((name, i) => (data[name] = files[i]));
    return data;
  }

  function persist() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(store));
    } catch (e) {
      toast("Changes could not be saved - browser storage is full or blocked.", "danger");
    }
  }

  async function ready() {
    if (store) return store;
    try {
      const saved = JSON.parse(localStorage.getItem(DB_KEY) || "null");
      if (saved && saved.version === DB_VERSION) store = saved;
    } catch (e) {
      store = null;
    }
    if (!store) {
      store = await seed();
      persist();
    }
    return store;
  }

  const DB = {
    all(name) {
      return store[name];
    },
    get(name, id) {
      const key = COLLECTIONS[name];
      return store[name].find((row) => row[key] === id) || null;
    },
    where(name, test) {
      return store[name].filter(test);
    },
    insert(name, row) {
      store[name].push(row);
      persist();
      return row;
    },
    update(name, id, patch) {
      const row = DB.get(name, id);
      if (!row) return null;
      Object.assign(row, patch);
      persist();
      return row;
    },
    remove(name, id) {
      const key = COLLECTIONS[name];
      const i = store[name].findIndex((row) => row[key] === id);
      if (i >= 0) store[name].splice(i, 1);
      persist();
    },
    // BK012 -> BK013, TXN1063 -> TXN1064
    nextId(name, prefix) {
      const key = COLLECTIONS[name];
      let max = 0;
      store[name].forEach(function (row) {
        const n = parseInt(String(row[key]).replace(/\D/g, ""), 10);
        if (!isNaN(n) && n > max) max = n;
      });
      return prefix + String(max + 1).padStart(3, "0");
    },
    async reset() {
      localStorage.removeItem(DB_KEY);
      store = null;
      return ready();
    },
    // download one collection (or everything) as a .json file
    exportJSON(name) {
      const data = name ? store[name] : store;
      const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (name || "library-database") + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };

  /* ---------------------------------------------------------------------------
   * 4. Authentication and session
   * ------------------------------------------------------------------------- */

  const SESSION_KEY = "gla_lms_session";

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function startSession(member, remember) {
    clearSession();
    const value = JSON.stringify({ memberId: member.memberId, at: Date.now() });
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, value);
  }

  // The session only stores the id. The member is read fresh from the database
  // every time, so a suspension or role change takes effect immediately.
  function currentUser() {
    const s = readSession();
    if (!s || !store) return null;
    const member = DB.get("members", s.memberId);
    if (!member || member.status !== "active") {
      clearSession();
      return null;
    }
    return member;
  }

  function findByEmail(email) {
    const e = String(email).trim().toLowerCase();
    return DB.all("members").find((m) => m.email.toLowerCase() === e) || null;
  }

  function login(email, password, remember) {
    const member = findByEmail(email);
    if (!member || member.passwordHash !== hashPassword(member.email, password)) {
      return { ok: false, error: "Email or password is incorrect." };
    }
    if (member.status !== "active") {
      return { ok: false, error: "This account is suspended. Please contact the library desk." };
    }
    startSession(member, remember);
    return { ok: true, user: member };
  }

  function logout() {
    clearSession();
    location.href = "index.html";
  }

  function roleOf(user) {
    return user ? user.role : "guest";
  }

  function can(permission, user) {
    if (user === undefined) user = currentUser();
    return (PERMISSIONS[roleOf(user)] || []).includes(permission);
  }

  function homeFor(user) {
    return ROLES[roleOf(user)].home;
  }

  /* ---------------------------------------------------------------------------
   * 5. Loans, fines and requests (shared business rules)
   * ------------------------------------------------------------------------- */

  function loanDaysFor(member) {
    return (ROLES[member.role] && ROLES[member.role].loanDays) || 14;
  }

  // fine for a loan: the stored fine once returned, the running fine while open
  function fineFor(txn, onDate) {
    if (txn.status === "returned") return txn.fine || 0;
    const late = daysBetween(txn.dueDate, onDate || today());
    return late > 0 ? late * RULES.FINE_PER_DAY : 0;
  }

  function loanState(txn) {
    if (txn.status === "returned") return txn.fine > 0 ? "returned-late" : "returned";
    const left = daysBetween(today(), txn.dueDate);
    if (left < 0) return "overdue";
    if (left <= RULES.DUE_SOON_DAYS) return "due-soon";
    return "issued";
  }

  const STATE_BADGE = {
    issued: ["badge-available", "On loan"],
    "due-soon": ["badge-reserved", "Due soon"],
    overdue: ["badge-overdue", "Overdue"],
    returned: ["badge-muted", "Returned"],
    "returned-late": ["badge-reserved", "Returned late"],
    pending: ["badge-reserved", "Pending"],
    approved: ["badge-available", "Approved"],
    rejected: ["badge-overdue", "Rejected"],
    cancelled: ["badge-muted", "Cancelled"],
    active: ["badge-available", "Active"],
    suspended: ["badge-overdue", "Suspended"],
  };

  function badge(state) {
    const b = STATE_BADGE[state] || ["badge-muted", state];
    return '<span class="badge-soft ' + b[0] + '">' + esc(b[1]) + "</span>";
  }

  function openLoans(memberId) {
    return DB.where("transactions", (t) => t.memberId === memberId && t.status === "issued");
  }

  function pendingRequests(memberId) {
    return DB.where("requests", (r) => r.status === "pending" && (!memberId || r.memberId === memberId));
  }

  // running fines on overdue books + returned fines that were never paid
  function outstandingFine(memberId) {
    return DB.where("transactions", (t) => t.memberId === memberId).reduce(function (sum, t) {
      if (t.status === "issued") return sum + fineFor(t);
      return sum + (t.finePaid ? 0 : t.fine || 0);
    }, 0);
  }

  // can this member take one more book (optionally a specific one)?
  function canBorrow(member, bookId, options) {
    options = options || {};
    if (!member || (member.role !== "student" && member.role !== "faculty")) {
      return { ok: false, reason: "Only student and faculty members can borrow books." };
    }
    if (member.status !== "active") return { ok: false, reason: "This member account is suspended." };

    const loans = openLoans(member.memberId);
    // pending requests hold a slot too, except the one being approved right now
    const pending = pendingRequests(member.memberId).filter((r) => r.id !== options.ignoreRequest);
    if (loans.length + pending.length >= member.bookLimit) {
      return { ok: false, reason: member.name + " has reached the limit of " + member.bookLimit + " books." };
    }
    if (bookId) {
      const book = DB.get("books", bookId);
      if (!book) return { ok: false, reason: "Book not found." };
      if (book.copiesAvailable < 1) return { ok: false, reason: "All copies of this book are issued." };
      if (loans.some((t) => t.bookId === bookId)) {
        return { ok: false, reason: member.name + " already has a copy of this book." };
      }
      if (pending.some((r) => r.bookId === bookId)) {
        return { ok: false, reason: "There is already a pending request for this book." };
      }
    }
    return { ok: true };
  }

  function issueBook(memberId, bookId, issuedOn, byUser, options) {
    const member = DB.get("members", memberId);
    const check = canBorrow(member, bookId, options);
    if (!check.ok) return check;
    const book = DB.get("books", bookId);
    issuedOn = issuedOn || today();
    const txn = {
      id: DB.nextId("transactions", "TXN"),
      memberId: memberId,
      bookId: bookId,
      issuedOn: issuedOn,
      dueDate: addDays(issuedOn, loanDaysFor(member)),
      returnedOn: null,
      status: "issued",
      fine: 0,
      finePaid: false,
      renewed: false,
      issuedBy: byUser ? byUser.memberId : null,
    };
    DB.insert("transactions", txn);
    DB.update("books", bookId, { copiesAvailable: book.copiesAvailable - 1 });
    return { ok: true, txn: txn };
  }

  function returnBook(txnId, returnedOn, finePaid) {
    const txn = DB.get("transactions", txnId);
    if (!txn || txn.status !== "issued") return { ok: false, reason: "This loan is not open." };
    returnedOn = returnedOn || today();
    if (daysBetween(txn.issuedOn, returnedOn) < 0) {
      return { ok: false, reason: "Return date cannot be before the issue date." };
    }
    const fine = fineFor(txn, returnedOn);
    DB.update("transactions", txnId, {
      status: "returned",
      returnedOn: returnedOn,
      fine: fine,
      finePaid: fine === 0 ? true : !!finePaid,
    });
    const book = DB.get("books", txn.bookId);
    if (book) {
      DB.update("books", book.id, { copiesAvailable: Math.min(book.copiesTotal, book.copiesAvailable + 1) });
    }
    return { ok: true, txn: txn, fine: fine };
  }

  function renewLoan(txnId) {
    const txn = DB.get("transactions", txnId);
    if (!txn || txn.status !== "issued") return { ok: false, reason: "This loan is not open." };
    if (txn.renewed) return { ok: false, reason: "A loan can only be renewed once." };
    if (loanState(txn) === "overdue") return { ok: false, reason: "Overdue books must be returned at the desk." };
    DB.update("transactions", txnId, { dueDate: addDays(txn.dueDate, RULES.RENEW_DAYS), renewed: true });
    return { ok: true, txn: txn };
  }

  function requestBook(member, bookId, note) {
    const check = canBorrow(member, bookId);
    if (!check.ok) return check;
    const req = {
      id: DB.nextId("requests", "REQ"),
      memberId: member.memberId,
      bookId: bookId,
      requestedOn: today(),
      status: "pending",
      note: String(note || "").slice(0, 200),
      decidedOn: null,
      txnId: null,
    };
    DB.insert("requests", req);
    return { ok: true, request: req };
  }

  function approveRequest(requestId, byUser) {
    const req = DB.get("requests", requestId);
    if (!req || req.status !== "pending") return { ok: false, reason: "Request is no longer pending." };
    const result = issueBook(req.memberId, req.bookId, today(), byUser, { ignoreRequest: req.id });
    if (!result.ok) return result;
    DB.update("requests", req.id, { status: "approved", decidedOn: today(), txnId: result.txn.id });
    return result;
  }

  function closeRequest(requestId, status) {
    const req = DB.get("requests", requestId);
    if (!req || req.status !== "pending") return { ok: false, reason: "Request is no longer pending." };
    DB.update("requests", req.id, { status: status, decidedOn: today() });
    return { ok: true };
  }

  /* ---------------------------------------------------------------------------
   * 6. UI helpers: toasts, confirm dialog, cards, messages
   * ------------------------------------------------------------------------- */

  function toast(message, type) {
    let box = $("toastBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "toastBox";
      box.className = "toast-container position-fixed bottom-0 end-0 p-3";
      document.body.appendChild(box);
    }
    const icons = { success: "check-circle-fill", danger: "x-circle-fill", warning: "exclamation-triangle-fill", info: "info-circle-fill" };
    type = icons[type] ? type : "success";
    const el = document.createElement("div");
    el.className = "toast app-toast toast-" + type;
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="d-flex align-items-start gap-2 p-3"><i class="bi bi-' + icons[type] + '"></i>' +
      '<div class="flex-grow-1 small">' + esc(message) + "</div>" +
      '<button type="button" class="btn-close btn-sm" data-bs-dismiss="toast" aria-label="Close"></button></div>';
    box.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 3800 });
    el.addEventListener("hidden.bs.toast", () => el.remove());
    t.show();
  }

  // Bootstrap modal instead of window.confirm(); resolves true / false
  function confirmDialog(opts) {
    opts = Object.assign({ title: "Are you sure?", message: "", confirmText: "Confirm", danger: false }, opts);
    return new Promise(function (resolve) {
      const wrap = document.createElement("div");
      wrap.className = "modal fade";
      wrap.tabIndex = -1;
      wrap.innerHTML =
        '<div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
        '<div class="modal-header border-0 pb-0"><h2 class="modal-title h5">' + esc(opts.title) + "</h2>" +
        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
        '<div class="modal-body text-muted-soft">' + esc(opts.message) + "</div>" +
        '<div class="modal-footer border-0 pt-0">' +
        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>' +
        '<button type="button" class="btn ' + (opts.danger ? "btn-danger" : "btn-navy") + '" data-ok>' + esc(opts.confirmText) + "</button>" +
        "</div></div></div>";
      document.body.appendChild(wrap);
      const modal = new bootstrap.Modal(wrap);
      let answer = false;
      wrap.querySelector("[data-ok]").addEventListener("click", function () {
        answer = true;
        modal.hide();
      });
      wrap.addEventListener("hidden.bs.modal", function () {
        modal.dispose();
        wrap.remove();
        resolve(answer);
      });
      modal.show();
    });
  }

  function availabilityBadge(book) {
    return book.copiesAvailable > 0
      ? '<span class="badge-soft badge-available">' + book.copiesAvailable + " available</span>"
      : '<span class="badge-soft badge-issued">All issued</span>';
  }

  // card used by the home page, catalogue and "similar books"
  function bookCard(book, colClass) {
    return (
      '<div class="' + (colClass || "col-sm-6 col-lg-3") + '">' +
      '<a href="book-details.html?id=' + encodeURIComponent(book.id) + '" class="card book-card card-lift h-100 text-decoration-none text-reset">' +
      '<div class="cover-wrap"><img src="' + esc(book.cover) + '" alt="Cover of ' + esc(book.title) + '" loading="lazy"></div>' +
      '<div class="card-body d-flex flex-column">' +
      '<p class="card-category mb-1">' + esc(book.category) + "</p>" +
      '<h3 class="card-title-sm">' + esc(book.title) + "</h3>" +
      '<p class="text-muted-soft small mb-2">' + esc(book.author) + "</p>" +
      '<div class="mt-auto d-flex justify-content-between align-items-center gap-2">' +
      '<span class="rating"><i class="bi bi-star-fill"></i> ' + Number(book.rating).toFixed(1) + "</span>" +
      availabilityBadge(book) +
      "</div></div></a></div>"
    );
  }

  // compact resource card used on the home page
  function resourceCard(r) {
    return (
      '<div class="col-sm-6 col-lg-4">' +
      '<a href="digital-resources.html?q=' + encodeURIComponent(r.title) + '" class="card card-lift h-100 text-decoration-none text-reset">' +
      '<div class="resource-head"><img src="' + esc(r.icon) + '" alt=""></div>' +
      '<div class="card-body">' +
      '<p class="card-category mb-1">' + esc(r.type) + "</p>" +
      '<h3 class="card-title-sm">' + esc(r.title) + "</h3>" +
      '<p class="text-muted-soft small mb-3">' + esc(r.author) + "</p>" +
      '<span class="chip">' + esc(r.format) + '</span> <span class="chip">' + esc(r.size) + "</span> " +
      '<span class="chip"><i class="bi bi-eye"></i> ' + Number(r.views).toLocaleString("en-IN") + "</span>" +
      "</div></a></div>"
    );
  }

  function emptyState(text, icon) {
    return '<div class="empty-state"><i class="bi bi-' + (icon || "inbox") + ' d-block fs-2 mb-2"></i>' + esc(text) + "</div>";
  }

  function showLoadError(container, err) {
    if (!container) return;
    const fileUrl = location.protocol === "file:";
    container.innerHTML =
      '<div class="container py-5"><div class="data-error"><strong>Could not load the library data.</strong><br>' +
      (fileUrl
        ? "The page was opened by double clicking it (file://), so the browser blocks reading data/*.json. " +
          "Open it through a local server instead: VS Code <em>Live Server</em>, or run " +
          "<code>python3 -m http.server 5500</code> in the project folder and visit <code>http://localhost:5500</code>."
        : esc(err && err.message ? err.message : err)) +
      "</div></div>";
  }

  function renderForbidden(user) {
    const main = $("main");
    if (!main) return;
    main.innerHTML =
      '<section class="py-5"><div class="container"><div class="forbidden-card mx-auto text-center">' +
      '<div class="forbidden-icon"><i class="bi bi-shield-lock"></i></div>' +
      '<h1 class="h3 mt-3">Access restricted</h1>' +
      '<p class="text-muted-soft">This page is not available for the <strong>' + esc(ROLES[roleOf(user)].label) +
      "</strong> role. Your account only sees the parts of the portal it has permission for.</p>" +
      '<a href="' + homeFor(user) + '" class="btn btn-navy">Go to my home page</a></div></div></section>';
  }

  /* ---------------------------------------------------------------------------
   * 7. Shared layout: navbar + footer (rendered once here, used by every page)
   * ------------------------------------------------------------------------- */

  const NAV_LINKS = [
    { href: "index.html", label: "Home" },
    { href: "catalogue.html", label: "Catalogue", match: ["book-details.html"] },
    { href: "digital-resources.html", label: "Digital Resources" },
    { href: "member-dashboard.html", label: "My Dashboard", roles: ["student", "faculty"] },
    { href: "issue-return.html", label: "Issue / Return", roles: ["librarian"] },
    { href: "admin.html", label: "Librarian Desk", roles: ["librarian"] },
  ];

  function renderHeader(user) {
    const header = $("siteHeader");
    if (!header) return;
    const role = roleOf(user);
    const page = currentPage();

    const links = NAV_LINKS.filter((l) => !l.roles || l.roles.includes(role))
      .map(function (l) {
        const active = l.href === page || (l.match && l.match.includes(page));
        return (
          '<li class="nav-item"><a class="nav-link' + (active ? " active" : "") + '" href="' + l.href + '"' +
          (active ? ' aria-current="page"' : "") + ">" + esc(l.label) + "</a></li>"
        );
      })
      .join("");

    const auth = user
      ? '<div class="dropdown">' +
        '<button class="btn user-chip dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">' +
        '<span class="user-avatar">' + esc(user.initials || user.name.charAt(0)) + "</span>" +
        '<span class="d-flex flex-column text-start lh-1"><span class="user-name">' + esc(shortName(user.name)) + "</span>" +
        '<span class="role-pill role-' + role + '">' + esc(ROLES[role].label) + "</span></span></button>" +
        '<ul class="dropdown-menu dropdown-menu-end shadow">' +
        '<li><span class="dropdown-item-text small text-muted-soft">' + esc(user.email) + "</span></li>" +
        '<li><hr class="dropdown-divider"></li>' +
        '<li><a class="dropdown-item" href="' + homeFor(user) + '"><i class="bi bi-grid me-2"></i>' +
        (role === "librarian" ? "Librarian Desk" : "My Dashboard") + "</a></li>" +
        '<li><button class="dropdown-item text-danger" type="button" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Log out</button></li>' +
        "</ul></div>"
      : '<a href="login.html" class="btn btn-outline-light-thin btn-sm">Log in</a>' +
        '<a href="signup.html" class="btn btn-gold btn-sm">Sign up</a>';

    header.innerHTML =
      '<nav class="navbar navbar-expand-lg navbar-dark site-nav">' +
      '<div class="container">' +
      '<a class="navbar-brand d-flex align-items-center gap-2" href="index.html">' +
      '<img src="img/logo.svg" alt="" width="38" height="38">' +
      '<span class="d-flex flex-column lh-1"><span class="fw-bold">GLA Central Library</span>' +
      '<span class="brand-sub">Digital Resource Management</span></span></a>' +
      '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" ' +
      'aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>' +
      '<div class="collapse navbar-collapse" id="mainNav">' +
      '<ul class="navbar-nav ms-auto mb-2 mb-lg-0">' + links + "</ul>" +
      '<div class="d-flex gap-2 ms-lg-3 mt-2 mt-lg-0 align-items-center">' + auth + "</div>" +
      "</div></div></nav>";

    const out = $("logoutBtn");
    if (out) out.addEventListener("click", logout);
  }

  function renderFooter() {
    const footer = $("siteFooter");
    if (!footer) return;
    footer.className = "site-footer pt-5";
    footer.innerHTML =
      '<div class="container"><div class="row g-4 pb-4">' +
      '<div class="col-lg-4"><h5>GLA Central Library</h5><p class="small mb-0">A unified portal for browsing, issuing and managing physical and digital resources at GLA University, Mathura.</p></div>' +
      '<div class="col-6 col-lg-3"><h5>Quick Links</h5><ul class="list-unstyled d-grid gap-2 mb-0">' +
      '<li><a href="catalogue.html">Catalogue</a></li><li><a href="digital-resources.html">Digital Resources</a></li>' +
      '<li><a href="member-dashboard.html">Member Dashboard</a></li><li><a href="login.html">Member Login</a></li></ul></div>' +
      '<div class="col-6 col-lg-2"><h5>Categories</h5><ul class="list-unstyled d-grid gap-2 mb-0">' +
      '<li><a href="catalogue.html?category=Computer+Science">Computer Science</a></li>' +
      '<li><a href="catalogue.html?category=Mathematics">Mathematics</a></li>' +
      '<li><a href="catalogue.html?category=Software+Engineering">Software Engineering</a></li></ul></div>' +
      '<div class="col-lg-3"><h5>Contact</h5><ul class="list-unstyled d-grid gap-2 mb-0 small">' +
      '<li><i class="bi bi-envelope me-2"></i>library@gla.ac.in</li>' +
      '<li><i class="bi bi-telephone me-2"></i>+91 565 350 3000</li>' +
      '<li><i class="bi bi-geo-alt me-2"></i>GLA University, Mathura, UP</li></ul></div>' +
      "</div>" +
      '<div class="footer-bottom py-3 d-flex flex-wrap justify-content-between gap-2">' +
      "<span>&copy; " + new Date().getFullYear() + " GLA Central Library. Mini Project, B.Tech CSE 3rd Year.</span>" +
      "<span>Built with HTML, CSS, Bootstrap and JavaScript</span></div></div>";
  }

  /* ---------------------------------------------------------------------------
   * 8. Page bootstrapper
   *    LIB.page({ roles: ["librarian"] }, function (ctx) { ... })
   *    - loads the database
   *    - renders navbar + footer for the current user
   *    - enforces the page's allowed roles (guests go to login, others see 403)
   *    - then runs the page's own code with { user, db }
   * ------------------------------------------------------------------------- */

  async function page(options, init) {
    options = options || {};
    try {
      await ready();
    } catch (err) {
      renderHeader(null);
      renderFooter();
      showLoadError($("main") || document.body, err);
      return;
    }

    const user = currentUser();

    if (options.guestOnly && user) {
      location.replace(homeFor(user));
      return;
    }

    renderHeader(user);
    renderFooter();

    if (options.roles && !options.roles.includes(roleOf(user))) {
      if (!user) {
        location.replace("login.html?next=" + encodeURIComponent(currentPage() + location.search));
      } else {
        renderForbidden(user);
      }
      return;
    }

    try {
      await init({ user: user, db: DB });
    } catch (err) {
      console.error(err);
      toast("Something went wrong on this page: " + err.message, "danger");
    }
  }

  return {
    RULES, ROLES, PERMISSIONS,
    $, esc, shortName, today, addDays, daysBetween, fmtDate, money, param, sha256, hashPassword,
    db: DB, ready, page,
    currentUser, login, logout, startSession, findByEmail, can, roleOf, homeFor,
    loanDaysFor, fineFor, loanState, badge, openLoans, pendingRequests, outstandingFine,
    canBorrow, issueBook, returnBook, renewLoan, requestBook, approveRequest, closeRequest,
    toast, confirmDialog, bookCard, resourceCard, availabilityBadge, emptyState, showLoadError,
  };
})();
