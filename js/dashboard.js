/* Member dashboard (member-dashboard.html)
 * Owner: Tanishka Chaudhary
 * Only students and faculty can open this page (RBAC). It joins the logged in
 * member with their transactions, requests, books and saved resources:
 * stats, overdue warning, renew, cancel request, history, change password.
 */

LIB.page({ roles: ["student", "faculty"] }, function (ctx) {
  const me = ctx.user;
  const db = ctx.db;
  const $ = LIB.$;
  const esc = LIB.esc;

  function bookCell(bookId) {
    const book = db.get("books", bookId);
    if (!book) return '<span class="text-muted-soft">Removed title (' + esc(bookId) + ")</span>";
    return (
      '<div class="d-flex align-items-center gap-2">' +
      '<img src="' + esc(book.cover) + '" alt="" class="mini-cover">' +
      '<div><a href="book-details.html?id=' + book.id + '" class="text-decoration-none fw-semibold">' + esc(book.title) + "</a>" +
      '<div class="small text-muted-soft">' + esc(book.author) + "</div></div></div>"
    );
  }

  function statBox(icon, value, label, tone) {
    return (
      '<div class="col-6 col-xl-3"><div class="stat-box ' + (tone || "") + '">' +
      '<div class="stat-icon"><i class="bi bi-' + icon + '"></i></div>' +
      '<div><span class="num">' + value + '</span><span class="label">' + label + "</span></div></div></div>"
    );
  }

  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '" class="text-center text-muted-soft py-4">' + esc(text) + "</td></tr>";
  }

  /* ---------------- sections ---------------- */

  function renderBanner(open) {
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const next = open.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    $("welcomeBanner").innerHTML =
      '<div class="d-flex flex-wrap justify-content-between align-items-center gap-3">' +
      "<div><span class=\"role-pill role-" + me.role + '">' + LIB.ROLES[me.role].label + " member</span>" +
      '<h1 class="h3 mt-2 mb-1">' + greet + ", " + esc(LIB.shortName(me.name)) + "</h1>" +
      '<p class="mb-0 opacity-75">' +
      (next ? "Your next return is <strong>" + esc(db.get("books", next.bookId) ? db.get("books", next.bookId).title : next.bookId) + "</strong> on " + LIB.fmtDate(next.dueDate) + "." : "You have no books on loan right now.") +
      "</p></div>" +
      '<div class="d-flex gap-2"><a href="catalogue.html" class="btn btn-gold btn-sm"><i class="bi bi-search me-1"></i>Find a book</a>' +
      '<a href="digital-resources.html" class="btn btn-outline-light-thin btn-sm">E-resources</a></div></div>';
  }

  function renderProfile() {
    $("profileCard").innerHTML =
      '<div class="user-avatar mx-auto mb-3" style="width:84px;height:84px;font-size:1.6rem">' + esc(me.initials) + "</div>" +
      '<h2 class="h5 mb-1">' + esc(me.name) + "</h2>" +
      '<p class="text-muted-soft small mb-2">' + esc(me.course) + " &middot; " + esc(me.year) + "</p>" +
      LIB.badge(me.status) +
      '<ul class="list-unstyled profile-detail text-start mt-3 mb-3">' +
      "<li><span>Member ID</span><span>" + esc(me.memberId) + "</span></li>" +
      "<li><span>Email</span><span class=\"text-truncate ms-2\">" + esc(me.email) + "</span></li>" +
      "<li><span>Role</span><span>" + LIB.ROLES[me.role].label + "</span></li>" +
      "<li><span>Joined</span><span>" + LIB.fmtDate(me.joined) + "</span></li>" +
      "<li><span>Book limit</span><span>" + me.bookLimit + " at a time</span></li>" +
      "<li><span>Loan period</span><span>" + LIB.loanDaysFor(me) + " days</span></li>" +
      "</ul>" +
      '<button class="btn btn-outline-secondary btn-sm w-100" type="button" data-bs-toggle="collapse" data-bs-target="#pwBox" aria-expanded="false" aria-controls="pwBox">' +
      '<i class="bi bi-key me-1"></i>Change password</button>' +
      '<div class="collapse text-start" id="pwBox"><form id="pwForm" class="mt-3" novalidate>' +
      '<input type="password" class="form-control form-control-sm mb-2" id="pwOld" placeholder="Current password" autocomplete="current-password">' +
      '<input type="password" class="form-control form-control-sm mb-2" id="pwNew" placeholder="New password (min 6, letter + number)" autocomplete="new-password">' +
      '<input type="password" class="form-control form-control-sm mb-2" id="pwNew2" placeholder="Repeat new password" autocomplete="new-password">' +
      '<div class="small text-danger mb-2" id="pwErr"></div>' +
      '<button class="btn btn-navy btn-sm w-100" type="submit">Update password</button></form></div>';

    $("pwForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const oldPw = $("pwOld").value;
      const newPw = $("pwNew").value;
      let err = "";
      if (LIB.hashPassword(me.email, oldPw) !== me.passwordHash) err = "Current password is wrong.";
      else if (newPw.length < 6 || !(/\d/.test(newPw) && /[a-z]/i.test(newPw))) err = "New password needs 6+ characters with a letter and a number.";
      else if (newPw !== $("pwNew2").value) err = "New passwords do not match.";
      $("pwErr").textContent = err;
      if (err) return;
      db.update("members", me.memberId, { passwordHash: LIB.hashPassword(me.email, newPw) });
      this.reset();
      bootstrap.Collapse.getOrCreateInstance($("pwBox")).hide();
      LIB.toast("Password updated.");
    });
  }

  function renderStats(open) {
    const overdue = open.filter((t) => LIB.loanState(t) === "overdue");
    const dueSoon = open.filter((t) => LIB.loanState(t) === "due-soon");
    const fine = LIB.outstandingFine(me.memberId);

    $("statRow").innerHTML =
      statBox("book", open.length + '<small class="text-muted-soft fs-6">/' + me.bookLimit + "</small>", "Books on loan") +
      statBox("alarm", dueSoon.length, "Due in " + LIB.RULES.DUE_SOON_DAYS + " days", dueSoon.length ? "is-gold" : "") +
      statBox("exclamation-octagon", overdue.length, "Overdue", overdue.length ? "is-warn" : "is-green") +
      statBox("currency-rupee", LIB.money(fine).replace("Rs ", ""), "Outstanding fine (Rs)", fine ? "is-warn" : "is-green");

    $("overdueAlert").innerHTML = overdue.length
      ? '<div class="alert alert-danger d-flex gap-2 align-items-start" role="alert"><i class="bi bi-exclamation-triangle-fill"></i><div>' +
        "<strong>" + overdue.length + " book(s) overdue.</strong> A fine of " + LIB.money(LIB.RULES.FINE_PER_DAY) +
        " per day is adding up. Please return them at the library desk.</div></div>"
      : "";
  }

  function renderIssued(open) {
    $("issuedRows").innerHTML = open.length
      ? open
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map(function (t) {
            const state = LIB.loanState(t);
            const left = LIB.daysBetween(LIB.today(), t.dueDate);
            const fine = LIB.fineFor(t);
            const canRenew = !t.renewed && state !== "overdue";
            return (
              "<tr><td>" + bookCell(t.bookId) + "</td>" +
              "<td>" + LIB.fmtDate(t.issuedOn) + "</td>" +
              "<td>" + LIB.fmtDate(t.dueDate) + '<div class="small text-muted-soft">' +
              (left < 0 ? -left + " day(s) late" : left === 0 ? "due today" : left + " day(s) left") + (t.renewed ? " &middot; renewed" : "") + "</div></td>" +
              "<td>" + LIB.badge(state) + "</td>" +
              '<td class="' + (fine ? "text-fine" : "") + '">' + (fine ? LIB.money(fine) : "-") + "</td>" +
              '<td class="text-end">' +
              (canRenew
                ? '<button class="btn btn-outline-secondary btn-xs" data-renew="' + t.id + '" title="Extend by ' + LIB.RULES.RENEW_DAYS + ' days"><i class="bi bi-arrow-repeat me-1"></i>Renew</button>'
                : '<span class="small text-muted-soft">' + (state === "overdue" ? "Return at desk" : "Renewed") + "</span>") +
              "</td></tr>"
            );
          })
          .join("")
      : emptyRow(6, "No books on loan. Browse the catalogue and request one.");
  }

  function renderRequests() {
    const mine = db.where("requests", (r) => r.memberId === me.memberId).sort((a, b) => b.requestedOn.localeCompare(a.requestedOn));
    $("requestRows").innerHTML = mine.length
      ? mine
          .map(function (r) {
            return (
              "<tr><td>" + bookCell(r.bookId) + (r.note ? '<div class="small text-muted-soft mt-1">"' + esc(r.note) + '"</div>' : "") + "</td>" +
              "<td>" + LIB.fmtDate(r.requestedOn) + "</td>" +
              "<td>" + LIB.badge(r.status) + (r.decidedOn ? '<div class="small text-muted-soft">' + LIB.fmtDate(r.decidedOn) + "</div>" : "") + "</td>" +
              '<td class="text-end">' +
              (r.status === "pending" ? '<button class="btn btn-outline-danger btn-xs" data-cancel="' + r.id + '">Cancel</button>' : "") +
              "</td></tr>"
            );
          })
          .join("")
      : emptyRow(4, "No requests yet. Use \"Request this book\" on any book page.");
  }

  function renderHistory() {
    const past = db
      .where("transactions", (t) => t.memberId === me.memberId && t.status === "returned")
      .sort((a, b) => b.returnedOn.localeCompare(a.returnedOn));
    $("historyRows").innerHTML = past.length
      ? past
          .map(function (t) {
            const fine = t.fine
              ? '<span class="' + (t.finePaid ? "" : "text-fine") + '">' + LIB.money(t.fine) + "</span>" +
                '<div class="small text-muted-soft">' + (t.finePaid ? "paid" : "unpaid") + "</div>"
              : "-";
            return (
              "<tr><td>" + bookCell(t.bookId) + "</td><td>" + LIB.fmtDate(t.issuedOn) + "</td><td>" + LIB.fmtDate(t.returnedOn) +
              "</td><td>" + fine + "</td><td>" + LIB.badge(LIB.loanState(t)) + "</td></tr>"
            );
          })
          .join("")
      : emptyRow(5, "No returned books yet.");
  }

  function renderSaved() {
    const saved = (me.savedResources || []).map((id) => db.get("resources", id)).filter(Boolean);
    $("savedResources").innerHTML = saved.length
      ? saved
          .map(function (r) {
            return (
              '<div class="col-md-6"><div class="d-flex align-items-center gap-3 border rounded-3 p-2 bg-white h-100">' +
              '<div class="feature-icon-box flex-shrink-0" style="width:46px;height:46px"><img src="' + esc(r.icon) + '" alt="" style="width:24px;height:24px"></div>' +
              '<div class="flex-grow-1 min-w-0"><div class="fw-semibold small text-truncate">' + esc(r.title) + "</div>" +
              '<div class="small text-muted-soft">' + esc(r.type) + " &middot; " + esc(r.format) + "</div></div>" +
              '<a class="btn btn-navy btn-xs" href="' + esc(r.url) + '" target="_blank" rel="noopener">Open</a>' +
              '<button class="btn btn-outline-secondary btn-xs" data-unsave="' + r.id + '" aria-label="Remove ' + esc(r.title) + '"><i class="bi bi-x-lg"></i></button>' +
              "</div></div>"
            );
          })
          .join("")
      : '<div class="col-12">' + LIB.emptyState("Nothing saved yet. Use the Save button on the Digital Resources page.", "bookmark") + "</div>";
  }

  function renderAll() {
    const open = LIB.openLoans(me.memberId);
    renderBanner(open);
    renderStats(open);
    renderIssued(open);
    renderRequests();
    renderHistory();
    renderSaved();
  }

  /* ---------------- actions ---------------- */

  $("main").addEventListener("click", async function (e) {
    const renew = e.target.closest("[data-renew]");
    if (renew) {
      const result = LIB.renewLoan(renew.dataset.renew);
      if (!result.ok) return LIB.toast(result.reason, "danger");
      LIB.toast("Renewed. New due date: " + LIB.fmtDate(result.txn.dueDate));
      return renderAll();
    }

    const cancel = e.target.closest("[data-cancel]");
    if (cancel) {
      const ok = await LIB.confirmDialog({ title: "Cancel this request?", message: "The librarian will no longer see it.", confirmText: "Cancel request", danger: true });
      if (!ok) return;
      LIB.closeRequest(cancel.dataset.cancel, "cancelled");
      LIB.toast("Request cancelled.", "info");
      return renderAll();
    }

    const unsave = e.target.closest("[data-unsave]");
    if (unsave) {
      db.update("members", me.memberId, { savedResources: me.savedResources.filter((id) => id !== unsave.dataset.unsave) });
      LIB.toast("Removed from saved resources.", "info");
      renderSaved();
    }
  });

  renderProfile();
  renderAll();

  if (LIB.param("welcome")) {
    LIB.toast("Welcome to GLA Central Library! Your account is ready.");
    history.replaceState(null, "", "member-dashboard.html");
  }
});
