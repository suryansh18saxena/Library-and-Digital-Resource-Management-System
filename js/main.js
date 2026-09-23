/* shared helpers used by every page - data loading, session, nav, animations */

const LIB = (function () {
  const cache = {};

  /* ---------- json "database" ---------- */

  async function load(name) {
    if (cache[name]) return cache[name];
    const res = await fetch("data/" + name + ".json");
    if (!res.ok) throw new Error("Could not load " + name + ".json (" + res.status + ")");
    cache[name] = await res.json();
    return cache[name];
  }

  // fetch() is blocked on file:// URLs, which is the most common way this breaks
  // for a teammate opening index.html by double clicking it.
  function showLoadError(container, err) {
    if (!container) return;
    const openedAsFile = location.protocol === "file:";
    container.innerHTML =
      '<div class="data-error">' +
      "<strong>Could not load the data files.</strong><br>" +
      (openedAsFile
        ? "The page is open as a file:// URL, so the browser blocks reading data/*.json. " +
          "Run it through a local server instead - in VS Code use the Live Server extension, " +
          "or run <code>python3 -m http.server 5500</code> in the project folder and open " +
          "<code>http://localhost:5500</code>."
        : String(err && err.message ? err.message : err)) +
      "</div>";
  }

  /* ---------- session (demo only, no backend yet) ---------- */

  const SESSION_KEY = "gla_session";
  const SIGNUP_KEY = "gla_signups";

  const session = {
    get() {
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      } catch (e) {
        return null;
      }
    },
    set(member) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(member));
    },
    clear() {
      localStorage.removeItem(SESSION_KEY);
    },
  };

  // members added through signup.html live in localStorage because there is no
  // backend to write back into data/members.json
  function localSignups() {
    try {
      return JSON.parse(localStorage.getItem(SIGNUP_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function addSignup(member) {
    const all = localSignups();
    all.push(member);
    localStorage.setItem(SIGNUP_KEY, JSON.stringify(all));
  }

  async function allMembers() {
    const fromFile = await load("members");
    return fromFile.concat(localSignups());
  }

  /* ---------- transactions ----------
   * transactions.json is the starting data. Anything done on the issue/return
   * page is layered on top in localStorage, since a static site cannot write
   * back into the json file.
   */

  const TXN_KEY = "gla_txn_changes";

  function txnChanges() {
    try {
      return JSON.parse(localStorage.getItem(TXN_KEY) || '{"added":[],"returned":{}}');
    } catch (e) {
      return { added: [], returned: {} };
    }
  }

  function saveTxnChanges(changes) {
    localStorage.setItem(TXN_KEY, JSON.stringify(changes));
  }

  async function allTransactions() {
    const base = await load("transactions");
    const changes = txnChanges();

    const merged = base.map(function (txn) {
      const ret = changes.returned[txn.id];
      if (!ret) return txn;
      return Object.assign({}, txn, {
        action: "returned",
        returnedOn: ret.returnedOn,
        status: ret.status,
        fine: ret.fine,
      });
    });

    return merged.concat(changes.added);
  }

  function addTransaction(txn) {
    const changes = txnChanges();
    changes.added.push(txn);
    saveTxnChanges(changes);
  }

  function markReturned(txnId, returnedOn, status, fine) {
    const changes = txnChanges();
    const local = changes.added.find((t) => t.id === txnId);
    if (local) {
      local.action = "returned";
      local.returnedOn = returnedOn;
      local.status = status;
      local.fine = fine;
    } else {
      changes.returned[txnId] = { returnedOn: returnedOn, status: status, fine: fine };
    }
    saveTxnChanges(changes);
  }

  function nextTxnId(existing) {
    let max = 1000;
    existing.forEach(function (t) {
      const n = parseInt(String(t.id).replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return "TXN" + (max + 1);
  }

  function requireAuth() {
    const me = session.get();
    if (!me) {
      location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop());
      return null;
    }
    return me;
  }

  /* ---------- navbar ---------- */

  function initNav() {
    const here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".site-nav .nav-link").forEach((link) => {
      const target = link.getAttribute("href");
      if (target === here || (link.dataset.match && link.dataset.match.split(",").includes(here))) {
        link.classList.add("active");
      }
    });

    const slot = document.getElementById("navAuth");
    if (!slot) return;
    const me = session.get();
    if (me) {
      slot.innerHTML =
        '<div class="dropdown">' +
        '<button class="btn btn-sm btn-outline-light-thin dropdown-toggle d-flex align-items-center gap-2" data-bs-toggle="dropdown">' +
        '<img src="img/avatar.svg" alt="" width="22" height="22" class="rounded-circle">' +
        '<span class="d-none d-sm-inline">' + escapeHtml(me.name.split(" ")[0]) + "</span>" +
        "</button>" +
        '<ul class="dropdown-menu dropdown-menu-end">' +
        '<li><a class="dropdown-item" href="member-dashboard.html">My Dashboard</a></li>' +
        '<li><a class="dropdown-item" href="issue-return.html">Issue / Return</a></li>' +
        '<li><hr class="dropdown-divider"></li>' +
        '<li><button class="dropdown-item" id="logoutBtn">Log out</button></li>' +
        "</ul></div>";
      const out = document.getElementById("logoutBtn");
      if (out) {
        out.addEventListener("click", function () {
          session.clear();
          location.href = "index.html";
        });
      }
    } else {
      slot.innerHTML =
        '<a href="login.html" class="btn btn-sm btn-outline-light-thin">Log in</a>' +
        '<a href="signup.html" class="btn btn-sm btn-gold">Sign up</a>';
    }
  }

  /* ---------- animation helpers ---------- */

  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
  }

  function countUp(el) {
    const target = parseFloat(el.dataset.count || "0");
    const suffix = el.dataset.suffix || "";
    const dur = 900;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-IN") + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    const els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(countUp);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            countUp(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    els.forEach((el) => io.observe(el));
  }

  function toast(message, variant) {
    let holder = document.getElementById("toastHolder");
    if (!holder) {
      holder = document.createElement("div");
      holder.id = "toastHolder";
      holder.className = "toast-container position-fixed bottom-0 end-0 p-3";
      holder.style.zIndex = "1080";
      document.body.appendChild(holder);
    }
    const el = document.createElement("div");
    el.className = "toast align-items-center text-bg-" + (variant || "dark") + " border-0";
    el.setAttribute("role", "alert");
    el.innerHTML =
      '<div class="d-flex"><div class="toast-body">' +
      escapeHtml(message) +
      '</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>';
    holder.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 3200 });
    t.show();
    el.addEventListener("hidden.bs.toast", () => el.remove());
  }

  /* ---------- formatting ---------- */

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return String(d.getDate()).padStart(2, "0") + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function today() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(fromIso, toIso) {
    const a = new Date(fromIso + "T00:00:00");
    const b = new Date(toIso + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }

  function statusBadge(status) {
    const map = {
      available: ["badge-available", "Available"],
      issued: ["badge-issued", "Issued"],
      reserved: ["badge-reserved", "Reserved"],
      overdue: ["badge-overdue", "Overdue"],
      returned: ["badge-available", "Returned On Time"],
      "returned-late": ["badge-overdue", "Returned Late"],
    };
    const pair = map[status] || ["badge-reserved", status];
    return '<span class="badge-soft ' + pair[0] + '">' + pair[1] + "</span>";
  }

  function stars(rating) {
    const full = Math.round(rating);
    let out = "";
    for (let i = 0; i < 5; i++) {
      out += '<i class="bi bi-star' + (i < full ? "-fill" : "") + '"></i>';
    }
    return out;
  }

  /* ---------- shared card markup (home, catalogue and dashboard all use these) ---------- */

  function bookCard(book, colClass) {
    return (
      '<div class="' + (colClass || "col-sm-6 col-lg-3") + ' reveal">' +
      '<a href="book-details.html?id=' + book.id + '" class="card card-lift book-card h-100 text-decoration-none">' +
      '<div class="cover-wrap"><img src="' + book.cover + '" alt="Cover of ' + escapeHtml(book.title) + '"></div>' +
      '<div class="card-body d-flex flex-column">' +
      '<div class="card-category mb-1">' + escapeHtml(book.category) + "</div>" +
      '<h3 class="card-title-sm">' + escapeHtml(book.title) + "</h3>" +
      '<div class="text-muted-soft small mb-3">' + escapeHtml(book.author) + "</div>" +
      '<div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">' +
      statusBadge(book.status) +
      '<span class="rating"><i class="bi bi-star-fill"></i> ' + book.rating + "</span>" +
      "</div></div></a></div>"
    );
  }

  function resourceCard(res, colClass) {
    const openAccess = res.access === "open";
    return (
      '<div class="' + (colClass || "col-sm-6 col-lg-4") + ' reveal">' +
      '<div class="card card-lift h-100">' +
      '<div class="resource-head"><img src="' + res.icon + '" alt=""></div>' +
      '<div class="card-body d-flex flex-column">' +
      '<div class="card-category mb-1">' + escapeHtml(res.type) + "</div>" +
      '<h3 class="card-title-sm">' + escapeHtml(res.title) + "</h3>" +
      '<div class="text-muted-soft small mb-3">' + escapeHtml(res.author) + "</div>" +
      '<div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">' +
      '<span class="badge-soft ' + (openAccess ? "badge-available" : "badge-reserved") + '">' +
      (openAccess ? "Open Access" : "Subscription") + "</span>" +
      '<span class="chip">' + escapeHtml(res.format) + "</span>" +
      "</div></div></div></div>"
    );
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  /* ---------- boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initReveal();
    initCounters();
  });

  return {
    load: load,
    showLoadError: showLoadError,
    session: session,
    allMembers: allMembers,
    addSignup: addSignup,
    requireAuth: requireAuth,
    allTransactions: allTransactions,
    addTransaction: addTransaction,
    markReturned: markReturned,
    nextTxnId: nextTxnId,
    initReveal: initReveal,
    toast: toast,
    fmtDate: fmtDate,
    today: today,
    addDays: addDays,
    daysBetween: daysBetween,
    statusBadge: statusBadge,
    stars: stars,
    bookCard: bookCard,
    resourceCard: resourceCard,
    escapeHtml: escapeHtml,
    param: param,
    FINE_PER_DAY: 10,
    LOAN_DAYS: 14,
  };
})();
