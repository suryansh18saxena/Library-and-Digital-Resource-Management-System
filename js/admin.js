/* Librarian desk (admin.html)
 * Owner: Sonu Raj
 * Librarian only (RBAC). KPIs, overdue list, and full management of the JSON
 * database: books (add / edit / delete), members (add / edit / suspend),
 * digital resources (add / edit / delete), export and reset.
 */

LIB.page({ roles: ["librarian"] }, function (ctx) {
  const me = ctx.user;
  const db = ctx.db;
  const $ = LIB.$;
  const esc = LIB.esc;

  /* ============================ shared modal form ============================ */

  const modal = new bootstrap.Modal($("formModal"));
  let onSave = null;

  // fields: [{ name, label, type, options, col, required, min, placeholder, help }]
  function fieldHtml(f, value) {
    const id = "f_" + f.name;
    const v = value == null ? "" : value;
    const req = f.required ? " required" : "";
    let input;
    if (f.type === "select") {
      input = '<select class="form-select" id="' + id + '" name="' + f.name + '"' + req + ">" +
        f.options.map((o) => {
          const val = Array.isArray(o) ? o[0] : o;
          const text = Array.isArray(o) ? o[1] : o;
          return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? " selected" : "") + ">" + esc(text) + "</option>";
        }).join("") + "</select>";
    } else if (f.type === "textarea") {
      input = '<textarea class="form-control" id="' + id + '" name="' + f.name + '" rows="3"' + req + ">" + esc(v) + "</textarea>";
    } else {
      input = '<input class="form-control" id="' + id + '" name="' + f.name + '" type="' + (f.type || "text") + '" value="' + esc(v) + '"' +
        (f.min != null ? ' min="' + f.min + '"' : "") + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "") +
        (f.readonly ? " readonly" : "") + (f.list ? ' list="' + f.list + '"' : "") + req + ">";
    }
    return (
      '<div class="' + (f.col || "col-md-6") + '"><label class="form-label small fw-semibold" for="' + id + '">' + esc(f.label) +
      (f.required ? ' <span class="text-danger">*</span>' : "") + "</label>" + input +
      (f.help ? '<div class="form-text">' + esc(f.help) + "</div>" : "") + "</div>"
    );
  }

  function openForm(title, fields, values, save, extraHtml) {
    $("formModalTitle").textContent = title;
    $("modalErr").textContent = "";
    $("modalBody").innerHTML = '<div class="row g-3">' + fields.map((f) => fieldHtml(f, values[f.name])).join("") + "</div>" + (extraHtml || "");
    onSave = function () {
      const data = {};
      for (const f of fields) {
        const el = $("f_" + f.name);
        let val = el.value.trim();
        if (f.required && !val) {
          el.classList.add("is-invalid");
          el.focus();
          return "Please fill in " + f.label + ".";
        }
        el.classList.remove("is-invalid");
        if (f.type === "number") val = Number(val);
        data[f.name] = val;
      }
      return save(data);
    };
    modal.show();
  }

  $("modalForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const error = onSave ? onSave() : null;
    if (error) {
      $("modalErr").textContent = error;
      return;
    }
    modal.hide();
    renderAll();
  });

  /* ============================ helpers ============================ */

  function memberName(id) {
    const m = db.get("members", id);
    return m ? m.name : id;
  }

  function kpi(icon, value, label, tone, href) {
    return (
      '<div class="col-6 col-md-4 col-xl-2"><' + (href ? 'a href="' + href + '" class="text-decoration-none text-reset d-block h-100"' : "div class=\"h-100\"") + ">" +
      '<div class="stat-box ' + (tone || "") + '"><div class="stat-icon"><i class="bi bi-' + icon + '"></i></div>' +
      '<div><span class="num">' + value + '</span><span class="label">' + label + "</span></div></div></" + (href ? "a" : "div") + "></div>"
    );
  }

  /* ============================ overview ============================ */

  function renderKpis() {
    const books = db.all("books");
    const open = db.where("transactions", (t) => t.status === "issued");
    const overdue = open.filter((t) => LIB.loanState(t) === "overdue");
    const pending = LIB.pendingRequests();
    const borrowers = db.where("members", (m) => m.role !== "librarian");
    const fines = borrowers.reduce((s, m) => s + LIB.outstandingFine(m.memberId), 0);

    $("kpiRow").innerHTML =
      kpi("book", books.length, "Titles (" + books.reduce((s, b) => s + b.copiesTotal, 0) + " copies)") +
      kpi("box-arrow-up-right", open.length, "Books on loan", "is-green") +
      kpi("exclamation-octagon", overdue.length, "Overdue", overdue.length ? "is-warn" : "") +
      kpi("inbox", pending.length, "Pending requests", pending.length ? "is-gold" : "", "issue-return.html") +
      kpi("people", borrowers.length, "Members") +
      kpi("currency-rupee", LIB.money(fines).replace("Rs ", ""), "Fines due (Rs)", fines ? "is-warn" : "");

    $("deskSummary").textContent =
      "Logged in as " + me.name + ". " + pending.length + " request(s) waiting, " + overdue.length + " book(s) overdue today.";
  }

  function renderOverview() {
    const attention = db
      .where("transactions", (t) => t.status === "issued" && ["overdue", "due-soon"].includes(LIB.loanState(t)))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    $("attentionRows").innerHTML = attention.length
      ? attention
          .map(function (t) {
            const book = db.get("books", t.bookId);
            const fine = LIB.fineFor(t);
            return (
              "<tr><td>" + esc(memberName(t.memberId)) + "</td><td>" + esc(book ? book.title : t.bookId) + "</td>" +
              "<td>" + LIB.fmtDate(t.dueDate) + "<div>" + LIB.badge(LIB.loanState(t)) + "</div></td>" +
              '<td class="' + (fine ? "text-fine" : "") + '">' + (fine ? LIB.money(fine) : "-") + "</td>" +
              '<td class="text-end"><a class="btn btn-outline-secondary btn-xs" href="issue-return.html?return=' + t.id + '">Return</a></td></tr>'
            );
          })
          .join("")
      : '<tr><td colspan="5" class="text-center text-muted-soft py-4">Nothing overdue or due in the next ' + LIB.RULES.DUE_SOON_DAYS + " days.</td></tr>";

    // copies by category: issued vs available
    const cats = {};
    db.all("books").forEach(function (b) {
      cats[b.category] = cats[b.category] || { total: 0, available: 0 };
      cats[b.category].total += b.copiesTotal;
      cats[b.category].available += b.copiesAvailable;
    });
    const max = Math.max(1, ...Object.values(cats).map((c) => c.total));
    $("categoryBars").innerHTML = Object.keys(cats)
      .sort()
      .map(function (name) {
        const c = cats[name];
        return (
          '<div class="mb-3"><div class="d-flex justify-content-between small mb-1"><span class="fw-semibold">' + esc(name) + "</span>" +
          '<span class="text-muted-soft">' + c.available + " of " + c.total + " on shelf</span></div>" +
          '<div class="progress" style="height:10px" role="progressbar" aria-label="' + esc(name) + '">' +
          '<div class="progress-bar" style="width:' + (c.available / max) * 100 + '%;background:#2e8b57"></div>' +
          '<div class="progress-bar" style="width:' + ((c.total - c.available) / max) * 100 + '%;background:var(--gold)"></div></div></div>'
        );
      })
      .join("") +
      '<div class="small text-muted-soft"><span class="d-inline-block rounded-circle me-1" style="width:8px;height:8px;background:#2e8b57"></span>On shelf ' +
      '<span class="d-inline-block rounded-circle ms-3 me-1" style="width:8px;height:8px;background:var(--gold)"></span>Issued</div>';

    const counts = {};
    db.all("transactions").forEach((t) => (counts[t.bookId] = (counts[t.bookId] || 0) + 1));
    $("topBooks").innerHTML = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 5)
      .map((id) => "<li class='mb-1'>" + esc(db.get("books", id) ? db.get("books", id).title : id) + ' <span class="text-muted-soft">(' + counts[id] + " loans)</span></li>")
      .join("");
  }

  /* ============================ books ============================ */

  function bookForm(book) {
    const categories = [...new Set(db.all("books").map((b) => b.category))].sort();
    const covers = [...new Set(db.all("books").map((b) => b.cover))].sort();
    const onLoan = book ? book.copiesTotal - book.copiesAvailable : 0;
    const fields = [
      { name: "title", label: "Title", required: true, col: "col-md-8" },
      { name: "language", label: "Language", type: "select", options: ["English", "Hindi"], col: "col-md-4" },
      { name: "author", label: "Author(s)", required: true, col: "col-md-8" },
      { name: "pages", label: "Pages", type: "number", min: 1, col: "col-md-4" },
      { name: "category", label: "Category", required: true, list: "catList", col: "col-md-6", help: "Pick one or type a new category" },
      { name: "subject", label: "Subject", col: "col-md-6" },
      { name: "isbn", label: "ISBN", required: true, col: "col-md-6", placeholder: "978-..." },
      { name: "publisher", label: "Publisher", col: "col-md-6" },
      { name: "edition", label: "Edition", col: "col-md-6", placeholder: "e.g. 3rd Edition, 2020" },
      { name: "shelf", label: "Shelf location", col: "col-md-6", placeholder: "e.g. CS-Rack 2, Row A" },
      { name: "copiesTotal", label: "Total copies", type: "number", min: Math.max(1, onLoan), required: true, col: "col-md-4", help: onLoan ? onLoan + " copies are out on loan" : "" },
      { name: "cover", label: "Cover image", type: "select", options: covers, col: "col-md-8" },
      { name: "tags", label: "Tags (comma separated)", col: "col-12" },
      { name: "description", label: "Description", type: "textarea", col: "col-12" },
    ];
    const values = book
      ? Object.assign({}, book, { tags: (book.tags || []).join(", ") })
      : { language: "English", copiesTotal: 1, cover: covers[0], pages: 300 };

    openForm(
      book ? "Edit book - " + book.id : "Add a new book",
      fields,
      values,
      function (data) {
        if (!Number.isInteger(data.copiesTotal) || data.copiesTotal < Math.max(1, onLoan)) {
          return "Total copies must be at least " + Math.max(1, onLoan) + ".";
        }
        const dupe = db.all("books").find((b) => b.isbn === data.isbn && (!book || b.id !== book.id));
        if (dupe) return "ISBN already used by \"" + dupe.title + "\".";
        data.tags = data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
        data.pages = data.pages || 0;

        if (book) {
          data.copiesAvailable = data.copiesTotal - onLoan;
          db.update("books", book.id, data);
          LIB.toast("Book updated.");
        } else {
          db.insert("books", Object.assign(data, {
            id: db.nextId("books", "BK"),
            copiesAvailable: data.copiesTotal,
            rating: 0,
            reviewCount: 0,
            reviews: [],
            addedOn: LIB.today(),
          }));
          LIB.toast("Book added to the catalogue.");
        }
        return null;
      },
      '<datalist id="catList">' + categories.map((c) => '<option value="' + esc(c) + '">').join("") + "</datalist>"
    );
  }

  function renderBooks() {
    const term = $("bookSearch").value.trim().toLowerCase();
    const rows = db
      .where("books", (b) => (b.title + " " + b.author + " " + b.isbn + " " + b.id).toLowerCase().includes(term))
      .sort((a, b) => a.title.localeCompare(b.title));
    $("bookRows").innerHTML = rows.length
      ? rows
          .map(function (b) {
            return (
              '<tr><td><div class="d-flex align-items-center gap-2"><img src="' + esc(b.cover) + '" alt="" class="mini-cover">' +
              '<div><a class="fw-semibold text-decoration-none" href="book-details.html?id=' + b.id + '">' + esc(b.title) + "</a>" +
              '<div class="small text-muted-soft">' + esc(b.author) + " &middot; " + b.id + "</div></div></div></td>" +
              "<td>" + esc(b.category) + '</td><td class="small">' + esc(b.isbn) + "</td>" +
              "<td>" + b.copiesAvailable + " / " + b.copiesTotal + "</td>" +
              '<td><span class="rating">' + Number(b.rating).toFixed(1) + "</span></td>" +
              '<td class="text-end text-nowrap"><button class="btn btn-outline-secondary btn-xs" data-edit-book="' + b.id + '"><i class="bi bi-pencil"></i> Edit</button> ' +
              '<button class="btn btn-outline-danger btn-xs" data-del-book="' + b.id + '"><i class="bi bi-trash"></i></button></td></tr>'
            );
          })
          .join("")
      : '<tr><td colspan="6" class="text-center text-muted-soft py-4">No books match.</td></tr>';
  }

  $("bookSearch").addEventListener("input", renderBooks);
  $("addBookBtn").addEventListener("click", () => bookForm(null));

  $("bookRows").addEventListener("click", async function (e) {
    const edit = e.target.closest("[data-edit-book]");
    if (edit) return bookForm(db.get("books", edit.dataset.editBook));

    const del = e.target.closest("[data-del-book]");
    if (del) {
      const book = db.get("books", del.dataset.delBook);
      const onLoan = db.where("transactions", (t) => t.bookId === book.id && t.status === "issued").length;
      if (onLoan) return LIB.toast("Cannot delete: " + onLoan + " copy(s) of this book are still on loan.", "danger");
      const ok = await LIB.confirmDialog({ title: "Delete \"" + book.title + "\"?", message: "The book is removed from the catalogue. Past transactions keep their record.", confirmText: "Delete book", danger: true });
      if (!ok) return;
      db.where("requests", (r) => r.bookId === book.id && r.status === "pending").forEach((r) => LIB.closeRequest(r.id, "rejected"));
      db.remove("books", book.id);
      LIB.toast("Book deleted.", "info");
      renderAll();
    }
  });

  /* ============================ members ============================ */

  function memberForm(member) {
    const isNew = !member;
    const fields = [
      { name: "name", label: "Full name", required: true, col: "col-md-6" },
      { name: "memberId", label: "Member ID / roll number", required: true, col: "col-md-6", readonly: !isNew },
      { name: "email", label: "Email", type: "email", required: true, col: "col-md-6" },
      { name: "role", label: "Role", type: "select", options: [["student", "Student"], ["faculty", "Faculty"], ["librarian", "Librarian"]], col: "col-md-6" },
      { name: "course", label: "Course / department", col: "col-md-6" },
      { name: "year", label: "Year / designation", col: "col-md-6" },
      { name: "bookLimit", label: "Book limit", type: "number", min: 0, required: true, col: "col-md-6", help: "Students 5, faculty 10 by default" },
    ];
    if (isNew) fields.push({ name: "password", label: "Temporary password", required: true, col: "col-md-6", help: "Member can change it from their dashboard" });

    openForm(isNew ? "Add a member" : "Edit member - " + member.name, fields, member || { role: "faculty", bookLimit: 10, year: "Faculty" }, function (data) {
      data.email = data.email.toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(data.email)) return "Enter a valid email address.";
      const emailOwner = LIB.findByEmail(data.email);
      if (emailOwner && (isNew || emailOwner.memberId !== member.memberId)) return "That email is already used by " + emailOwner.name + ".";
      if (!Number.isInteger(data.bookLimit) || data.bookLimit < 0) return "Book limit must be 0 or more.";
      if (!isNew && member.memberId === me.memberId && data.role !== "librarian") return "You cannot remove your own librarian role.";
      if (data.role !== "librarian" && data.bookLimit < 1) return "Students and faculty need a book limit of at least 1.";

      if (isNew) {
        if (db.get("members", data.memberId)) return "Member ID " + data.memberId + " already exists.";
        if (data.password.length < 6) return "Temporary password must be at least 6 characters.";
        const pw = data.password;
        delete data.password;
        db.insert("members", Object.assign(data, {
          passwordHash: LIB.hashPassword(data.email, pw),
          joined: LIB.today(),
          initials: data.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
          status: "active",
          savedResources: [],
        }));
        LIB.toast("Member added. Share the temporary password with them.");
      } else {
        // the hash is salted with the email, so an email change needs a new password
        if (data.email !== member.email) return "Email cannot be changed here because the password is tied to it. Add a new account instead.";
        db.update("members", member.memberId, data);
        LIB.toast("Member updated.");
      }
      return null;
    });
  }

  function renderMembers() {
    const term = $("memberSearch").value.trim().toLowerCase();
    const role = $("roleFilter").value;
    const rows = db
      .where("members", (m) => (!role || m.role === role) && (m.name + " " + m.email + " " + m.memberId).toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
    $("memberRows").innerHTML = rows.length
      ? rows
          .map(function (m) {
            const loans = LIB.openLoans(m.memberId).length;
            const fine = LIB.outstandingFine(m.memberId);
            const self = m.memberId === me.memberId;
            return (
              "<tr><td><strong>" + esc(m.name) + '</strong><div class="small text-muted-soft">' + esc(m.email) + "</div></td>" +
              '<td class="small">' + esc(m.memberId) + "</td>" +
              '<td><span class="role-pill role-' + m.role + '">' + LIB.ROLES[m.role].label + "</span></td>" +
              "<td>" + (m.role === "librarian" ? "-" : loans + " / " + m.bookLimit) + "</td>" +
              '<td class="' + (fine ? "text-fine" : "") + '">' + (fine ? LIB.money(fine) : "-") + "</td>" +
              "<td>" + LIB.badge(m.status) + "</td>" +
              '<td class="text-end text-nowrap"><button class="btn btn-outline-secondary btn-xs" data-edit-member="' + m.memberId + '"><i class="bi bi-pencil"></i> Edit</button> ' +
              (self
                ? ""
                : '<button class="btn btn-xs ' + (m.status === "active" ? "btn-outline-danger" : "btn-outline-success") + '" data-toggle-member="' + m.memberId + '">' +
                  (m.status === "active" ? "Suspend" : "Activate") + "</button>") +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="7" class="text-center text-muted-soft py-4">No members match.</td></tr>';
  }

  $("memberSearch").addEventListener("input", renderMembers);
  $("roleFilter").addEventListener("change", renderMembers);
  $("addMemberBtn").addEventListener("click", () => memberForm(null));

  $("memberRows").addEventListener("click", async function (e) {
    const edit = e.target.closest("[data-edit-member]");
    if (edit) return memberForm(db.get("members", edit.dataset.editMember));

    const toggle = e.target.closest("[data-toggle-member]");
    if (toggle) {
      const m = db.get("members", toggle.dataset.toggleMember);
      const suspend = m.status === "active";
      const ok = await LIB.confirmDialog({
        title: (suspend ? "Suspend " : "Activate ") + m.name + "?",
        message: suspend ? "They will be logged out, cannot log in and cannot borrow until activated again." : "They will be able to log in and borrow again.",
        confirmText: suspend ? "Suspend" : "Activate",
        danger: suspend,
      });
      if (!ok) return;
      db.update("members", m.memberId, { status: suspend ? "suspended" : "active" });
      if (suspend) db.where("requests", (r) => r.memberId === m.memberId && r.status === "pending").forEach((r) => LIB.closeRequest(r.id, "rejected"));
      LIB.toast(m.name + (suspend ? " suspended." : " activated."), suspend ? "warning" : "success");
      renderAll();
    }
  });

  /* ============================ resources ============================ */

  const ICONS = { "E-Book": "img/icons/epub.svg", "Research Paper": "img/icons/pdf.svg", Journal: "img/icons/journal.svg", "Web Resource": "img/icons/web.svg" };

  function resourceForm(r) {
    const fields = [
      { name: "title", label: "Title", required: true, col: "col-md-8" },
      { name: "type", label: "Type", type: "select", options: Object.keys(ICONS), col: "col-md-4" },
      { name: "author", label: "Author / source", required: true, col: "col-md-8" },
      { name: "format", label: "Format", type: "select", options: ["PDF", "EPUB", "HTML"], col: "col-md-4" },
      { name: "access", label: "Access", type: "select", options: [["open", "Open access"], ["subscription", "Members only"]], col: "col-md-6" },
      { name: "size", label: "Size", col: "col-md-6", placeholder: "e.g. 2.4 MB or Online" },
      { name: "url", label: "Link (https://...)", type: "url", required: true, col: "col-12" },
      { name: "description", label: "Short description", type: "textarea", col: "col-12" },
    ];
    openForm(r ? "Edit resource - " + r.id : "Add a digital resource", fields, r || { type: "E-Book", format: "PDF", access: "open" }, function (data) {
      if (!/^https?:\/\/\S+$/i.test(data.url)) return "Link must start with http:// or https://";
      data.icon = ICONS[data.type];
      if (r) {
        db.update("resources", r.id, data);
        LIB.toast("Resource updated.");
      } else {
        db.insert("resources", Object.assign(data, { id: db.nextId("resources", "DR"), views: 0, addedOn: LIB.today() }));
        LIB.toast("Resource added.");
      }
      return null;
    });
  }

  function renderResources() {
    const term = $("resourceSearch").value.trim().toLowerCase();
    const rows = db
      .where("resources", (r) => (r.title + " " + r.author + " " + r.type).toLowerCase().includes(term))
      .sort((a, b) => a.title.localeCompare(b.title));
    $("resourceRows").innerHTML = rows.length
      ? rows
          .map(function (r) {
            return (
              '<tr><td><div class="d-flex align-items-center gap-2"><img src="' + esc(r.icon) + '" alt="" width="26" height="26">' +
              '<div><a class="fw-semibold text-decoration-none" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + "</a>" +
              '<div class="small text-muted-soft">' + esc(r.author) + "</div></div></div></td>" +
              "<td>" + esc(r.type) + "</td>" +
              '<td><span class="badge-soft ' + (r.access === "open" ? "access-open" : "access-subscription") + '">' + (r.access === "open" ? "Open" : "Members") + "</span></td>" +
              "<td>" + Number(r.views).toLocaleString("en-IN") + "</td>" +
              '<td class="text-end text-nowrap"><button class="btn btn-outline-secondary btn-xs" data-edit-res="' + r.id + '"><i class="bi bi-pencil"></i> Edit</button> ' +
              '<button class="btn btn-outline-danger btn-xs" data-del-res="' + r.id + '"><i class="bi bi-trash"></i></button></td></tr>'
            );
          })
          .join("")
      : '<tr><td colspan="5" class="text-center text-muted-soft py-4">No resources match.</td></tr>';
  }

  $("resourceSearch").addEventListener("input", renderResources);
  $("addResourceBtn").addEventListener("click", () => resourceForm(null));

  $("resourceRows").addEventListener("click", async function (e) {
    const edit = e.target.closest("[data-edit-res]");
    if (edit) return resourceForm(db.get("resources", edit.dataset.editRes));
    const del = e.target.closest("[data-del-res]");
    if (del) {
      const r = db.get("resources", del.dataset.delRes);
      const ok = await LIB.confirmDialog({ title: "Delete \"" + r.title + "\"?", message: "It will also disappear from members' saved lists.", confirmText: "Delete", danger: true });
      if (!ok) return;
      db.all("members").forEach(function (m) {
        if ((m.savedResources || []).includes(r.id)) db.update("members", m.memberId, { savedResources: m.savedResources.filter((id) => id !== r.id) });
      });
      db.remove("resources", r.id);
      LIB.toast("Resource deleted.", "info");
      renderAll();
    }
  });

  /* ============================ data ============================ */

  function renderData() {
    $("dataRows").innerHTML = ["books", "members", "resources", "transactions", "requests"]
      .map(function (name) {
        return (
          "<tr><td><code>data/" + name + ".json</code></td><td>" + db.all(name).length + "</td>" +
          '<td class="text-end"><button class="btn btn-outline-secondary btn-xs" data-export="' + name + '"><i class="bi bi-download"></i> ' + name + ".json</button></td></tr>"
        );
      })
      .join("");

    const perms = [...new Set(Object.values(LIB.PERMISSIONS).flat())];
    const roles = Object.keys(LIB.PERMISSIONS);
    $("permTable").innerHTML =
      '<div class="table-responsive"><table class="table table-sm align-middle small mb-0"><thead><tr><th>Permission</th>' +
      roles.map((r) => '<th class="text-center">' + LIB.ROLES[r].label + "</th>").join("") + "</tr></thead><tbody>" +
      perms
        .map(function (p) {
          return "<tr><td><code>" + p + "</code></td>" +
            roles.map((r) => '<td class="text-center">' + (LIB.PERMISSIONS[r].includes(p) ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-dash text-muted"></i>') + "</td>").join("") +
            "</tr>";
        })
        .join("") +
      "</tbody></table></div>";
  }

  $("dataRows").addEventListener("click", function (e) {
    const btn = e.target.closest("[data-export]");
    if (btn) db.exportJSON(btn.dataset.export);
  });
  $("exportAllTop").addEventListener("click", () => db.exportJSON());

  $("resetAll").addEventListener("click", async function () {
    const ok = await LIB.confirmDialog({ title: "Reset all demo data?", message: "Every change is cleared and the JSON files are loaded again.", confirmText: "Reset data", danger: true });
    if (!ok) return;
    await db.reset();
    location.reload();
  });

  /* ============================ start ============================ */

  function renderAll() {
    renderKpis();
    renderOverview();
    renderBooks();
    renderMembers();
    renderResources();
    renderData();
  }

  renderAll();

  // deep links: admin.html?tab=books&edit=BK001
  const tab = LIB.param("tab");
  if (tab && $("tab-" + tab)) bootstrap.Tab.getOrCreateInstance($("tab-" + tab)).show();
  const editId = LIB.param("edit");
  if (editId && db.get("books", editId)) bookForm(db.get("books", editId));
  if (tab || editId) history.replaceState(null, "", "admin.html");
});
