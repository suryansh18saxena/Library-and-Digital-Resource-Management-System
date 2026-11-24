/* Issue / Return desk (issue-return.html)
 * Owner: Sonu Raj
 * Librarian only (RBAC). Issue with limit checks and automatic due date,
 * return with automatic fine, approve / reject member requests,
 * searchable transaction log, fine collection and demo data reset.
 */

LIB.page({ roles: ["librarian"] }, function (ctx) {
  const me = ctx.user;
  const db = ctx.db;
  const $ = LIB.$;
  const esc = LIB.esc;

  function srow(label, value, total) {
    return '<div class="srow' + (total ? " total" : "") + '"><span>' + label + "</span><span>" + value + "</span></div>";
  }

  function memberName(id) {
    const m = db.get("members", id);
    return m ? m.name : id;
  }

  function bookTitle(id) {
    const b = db.get("books", id);
    return b ? b.title : id;
  }

  function borrowers() {
    return db.where("members", (m) => m.role === "student" || m.role === "faculty").sort((a, b) => a.name.localeCompare(b.name));
  }

  function setStep(n) {
    document.querySelectorAll("#stepBar .step").forEach(function (step, i) {
      step.classList.toggle("is-done", i < n - 1 || n === 4);
      step.classList.toggle("is-active", i === n - 1 && n !== 4);
      step.querySelector(".step-dot").innerHTML = i < n - 1 || n === 4 ? '<i class="bi bi-check-lg"></i>' : i + 1;
    });
  }

  /* ============================ ISSUE ============================ */

  function fillIssueMembers() {
    const keep = $("issueMember").value || LIB.param("member") || "";
    $("issueMember").innerHTML =
      '<option value="">Select a member...</option>' +
      borrowers()
        .map(function (m) {
          const loans = LIB.openLoans(m.memberId).length;
          return (
            '<option value="' + m.memberId + '"' + (m.status !== "active" ? " disabled" : "") + ">" +
            esc(m.name) + " (" + m.memberId + ") - " + loans + "/" + m.bookLimit + (m.status !== "active" ? " - suspended" : "") + "</option>"
          );
        })
        .join("");
    $("issueMember").value = keep;
  }

  function fillIssueBooks() {
    const keep = $("issueBook").value || LIB.param("book") || "";
    const books = db.all("books").slice().sort((a, b) => a.title.localeCompare(b.title));
    $("issueBook").innerHTML =
      '<option value="">Select a book...</option>' +
      books
        .map(function (b) {
          return (
            '<option value="' + b.id + '"' + (b.copiesAvailable < 1 ? " disabled" : "") + ">" +
            esc(b.title) + " - " + (b.copiesAvailable < 1 ? "all issued" : b.copiesAvailable + " left") + "</option>"
          );
        })
        .join("");
    const opt = $("issueBook").querySelector('option[value="' + keep + '"]');
    $("issueBook").value = opt && !opt.disabled ? keep : "";
  }

  function refreshIssue() {
    const member = db.get("members", $("issueMember").value);
    const book = db.get("books", $("issueBook").value);
    if (!$("issueDate").value) $("issueDate").value = LIB.today();
    const issueDate = $("issueDate").value;

    $("memberInfo").innerHTML = member
      ? LIB.ROLES[member.role].label + " &middot; " + LIB.openLoans(member.memberId).length + " of " + member.bookLimit + " books on loan" +
        " &middot; " + LIB.pendingRequests(member.memberId).length + " pending request(s)" +
        (LIB.outstandingFine(member.memberId) ? ' &middot; <span class="text-fine">fine due ' + LIB.money(LIB.outstandingFine(member.memberId)) + "</span>" : "")
      : "";

    const dueDate = member ? LIB.addDays(issueDate, LIB.loanDaysFor(member)) : "";
    $("dueDate").value = dueDate;

    $("issueSummary").innerHTML =
      member && book
        ? srow("Member", esc(member.name)) + srow("Book", esc(book.title)) +
          srow("Copies left after issue", book.copiesAvailable - 1 + " of " + book.copiesTotal) +
          srow("Loan period", LIB.loanDaysFor(member) + " days") + srow("Due date", LIB.fmtDate(dueDate), true)
        : '<p class="small text-muted-soft mb-0">Choose a member and a book to see the summary.</p>';

    let error = "";
    if (member && book) {
      const check = LIB.canBorrow(member, book.id);
      error = check.ok ? "" : check.reason;
    }
    if (issueDate > LIB.today()) error = "Issue date cannot be in the future.";
    $("issueErr").textContent = error;
    $("issueBtn").disabled = !member || !book || !!error;

    setStep(!member ? 1 : !book ? 2 : 3);
  }

  $("issueForm").addEventListener("change", refreshIssue);

  $("issueForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const result = LIB.issueBook($("issueMember").value, $("issueBook").value, $("issueDate").value, me);
    if (!result.ok) {
      $("issueErr").textContent = result.reason;
      return;
    }
    setStep(4);
    LIB.toast("Issued \"" + bookTitle(result.txn.bookId) + "\" to " + memberName(result.txn.memberId) + ". Due " + LIB.fmtDate(result.txn.dueDate) + ".");
    $("issueBook").value = "";
    refreshAll();
    setStep(4);
    setTimeout(refreshIssue, 2200);
  });

  /* ============================ RETURN ============================ */

  function fillReturnMembers() {
    const withLoans = borrowers().filter((m) => LIB.openLoans(m.memberId).length);
    let keep = $("returnMember").value;
    const preTxn = LIB.param("return") && db.get("transactions", LIB.param("return"));
    if (!keep && preTxn) keep = preTxn.memberId;
    $("returnMember").innerHTML =
      '<option value="">Select a member...</option>' +
      withLoans
        .map((m) => '<option value="' + m.memberId + '">' + esc(m.name) + " (" + LIB.openLoans(m.memberId).length + " on loan)</option>")
        .join("");
    $("returnMember").value = withLoans.some((m) => m.memberId === keep) ? keep : "";
  }

  function fillReturnBooks() {
    const memberId = $("returnMember").value;
    const loans = memberId ? LIB.openLoans(memberId) : [];
    const select = $("returnBook");
    select.disabled = !loans.length;
    select.innerHTML = loans.length
      ? loans
          .map(function (t) {
            return '<option value="' + t.id + '">' + esc(bookTitle(t.bookId)) + " - due " + LIB.fmtDate(t.dueDate) +
              (LIB.loanState(t) === "overdue" ? " (overdue)" : "") + "</option>";
          })
          .join("")
      : '<option value="">' + (memberId ? "No books on loan" : "Select a member first") + "</option>";
    const pre = LIB.param("return");
    if (pre && loans.some((t) => t.id === pre)) select.value = pre;
  }

  function refreshReturn() {
    const txn = db.get("transactions", $("returnBook").value);
    if (!$("returnDate").value) $("returnDate").value = LIB.today();
    const returnDate = $("returnDate").value;

    if (!txn) {
      $("returnSummary").innerHTML = '<p class="small text-muted-soft mb-0">Pick a member and the book they are returning.</p>';
      $("fineAlert").innerHTML = "";
      $("returnErr").textContent = "";
      $("returnBtn").disabled = true;
      return;
    }

    const late = Math.max(0, LIB.daysBetween(txn.dueDate, returnDate));
    const fine = LIB.fineFor(txn, returnDate);
    $("returnSummary").innerHTML =
      srow("Book", esc(bookTitle(txn.bookId))) + srow("Issued on", LIB.fmtDate(txn.issuedOn)) + srow("Due date", LIB.fmtDate(txn.dueDate)) +
      srow("Days late", late) + srow("Fine", LIB.money(fine), true);

    $("fineAlert").innerHTML = fine
      ? '<div class="alert alert-warning py-2 small"><i class="bi bi-cash-coin me-1"></i> Returned ' + late + " day(s) late. Fine: <strong>" +
        LIB.money(fine) + "</strong> (" + LIB.money(LIB.RULES.FINE_PER_DAY) + "/day)." +
        '<div class="form-check mt-2 mb-0"><input class="form-check-input" type="checkbox" id="finePaid" checked>' +
        '<label class="form-check-label" for="finePaid">Fine collected now</label></div></div>'
      : '<div class="alert alert-success py-2 small"><i class="bi bi-check-circle me-1"></i> On time - no fine.</div>';

    const error = LIB.daysBetween(txn.issuedOn, returnDate) < 0 ? "Return date cannot be before the issue date." : returnDate > LIB.today() ? "Return date cannot be in the future." : "";
    $("returnErr").textContent = error;
    $("returnBtn").disabled = !!error;
  }

  $("returnMember").addEventListener("change", function () {
    fillReturnBooks();
    refreshReturn();
  });
  $("returnBook").addEventListener("change", refreshReturn);
  $("returnDate").addEventListener("change", refreshReturn);

  $("returnForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const paid = $("finePaid") ? $("finePaid").checked : true;
    const result = LIB.returnBook($("returnBook").value, $("returnDate").value, paid);
    if (!result.ok) {
      $("returnErr").textContent = result.reason;
      return;
    }
    LIB.toast(
      "Returned \"" + bookTitle(result.txn.bookId) + "\"." + (result.fine ? " Fine " + LIB.money(result.fine) + (paid ? " collected." : " added to member's dues.") : ""),
      result.fine && !paid ? "warning" : "success"
    );
    refreshAll();
  });

  /* ============================ REQUESTS ============================ */

  function renderRequests() {
    const pending = LIB.pendingRequests().sort((a, b) => a.requestedOn.localeCompare(b.requestedOn));
    $("reqCount").textContent = pending.length;
    $("requestRows").innerHTML = pending.length
      ? pending
          .map(function (r) {
            const book = db.get("books", r.bookId);
            const member = db.get("members", r.memberId);
            const check = LIB.canBorrow(member, r.bookId, { ignoreRequest: r.id });
            return (
              "<tr><td><strong>" + esc(memberName(r.memberId)) + '</strong><div class="small text-muted-soft">' + esc(r.memberId) + "</div></td>" +
              "<td>" + esc(bookTitle(r.bookId)) + (r.note ? '<div class="small text-muted-soft">"' + esc(r.note) + '"</div>' : "") + "</td>" +
              "<td>" + LIB.fmtDate(r.requestedOn) + "</td>" +
              "<td>" + (book ? LIB.availabilityBadge(book) : "-") + "</td>" +
              '<td class="text-end text-nowrap">' +
              '<button class="btn btn-gold btn-xs" data-approve="' + r.id + '"' + (check.ok ? "" : ' disabled title="' + esc(check.reason) + '"') + '><i class="bi bi-check-lg"></i> Approve</button> ' +
              '<button class="btn btn-outline-danger btn-xs" data-reject="' + r.id + '"><i class="bi bi-x-lg"></i> Reject</button>' +
              (check.ok ? "" : '<div class="small text-danger mt-1">' + esc(check.reason) + "</div>") +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="5" class="text-center text-muted-soft py-4">No pending requests. All caught up!</td></tr>';
  }

  $("requestRows").addEventListener("click", async function (e) {
    const approve = e.target.closest("[data-approve]");
    if (approve) {
      const result = LIB.approveRequest(approve.dataset.approve, me);
      if (!result.ok) return LIB.toast(result.reason, "danger");
      LIB.toast("Approved and issued to " + memberName(result.txn.memberId) + ". Due " + LIB.fmtDate(result.txn.dueDate) + ".");
      return refreshAll();
    }
    const reject = e.target.closest("[data-reject]");
    if (reject) {
      const ok = await LIB.confirmDialog({ title: "Reject this request?", message: "The member will see it as rejected on their dashboard.", confirmText: "Reject", danger: true });
      if (!ok) return;
      LIB.closeRequest(reject.dataset.reject, "rejected");
      LIB.toast("Request rejected.", "info");
      refreshAll();
    }
  });

  /* ============================ TRANSACTIONS ============================ */

  function renderTransactions() {
    const term = $("txnSearch").value.trim().toLowerCase();
    const filter = $("txnFilter").value;
    const rows = db
      .all("transactions")
      .filter(function (t) {
        const state = LIB.loanState(t);
        if (filter === "open" && t.status !== "issued") return false;
        if (filter === "overdue" && state !== "overdue") return false;
        if (filter === "returned" && t.status !== "returned") return false;
        if (filter === "unpaid" && !(t.status === "returned" && t.fine > 0 && !t.finePaid)) return false;
        return (t.id + " " + memberName(t.memberId) + " " + bookTitle(t.bookId)).toLowerCase().includes(term);
      })
      .sort((a, b) => (b.returnedOn || b.issuedOn).localeCompare(a.returnedOn || a.issuedOn) || b.id.localeCompare(a.id));

    $("txnRows").innerHTML = rows.length
      ? rows
          .map(function (t) {
            const fine = LIB.fineFor(t);
            let fineCell = fine ? '<span class="text-fine">' + LIB.money(fine) + "</span>" : "-";
            if (t.status === "returned" && t.fine > 0) {
              fineCell += t.finePaid
                ? '<div class="small text-muted-soft">paid</div>'
                : '<div><button class="btn btn-outline-success btn-xs mt-1" data-collect="' + t.id + '">Mark paid</button></div>';
            } else if (t.status === "issued" && fine) {
              fineCell += '<div class="small text-muted-soft">running</div>';
            }
            return (
              '<tr><td class="small text-muted-soft">' + t.id + "</td>" +
              "<td>" + esc(memberName(t.memberId)) + "</td>" +
              "<td>" + esc(bookTitle(t.bookId)) + "</td>" +
              "<td>" + LIB.fmtDate(t.issuedOn) + "</td>" +
              "<td>" + (t.status === "returned" ? LIB.fmtDate(t.returnedOn) : LIB.fmtDate(t.dueDate)) + "</td>" +
              "<td>" + fineCell + "</td>" +
              "<td>" + LIB.badge(LIB.loanState(t)) + "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="7" class="text-center text-muted-soft py-4">No transactions match.</td></tr>';
  }

  $("txnSearch").addEventListener("input", renderTransactions);
  $("txnFilter").addEventListener("change", renderTransactions);

  $("txnRows").addEventListener("click", function (e) {
    const btn = e.target.closest("[data-collect]");
    if (!btn) return;
    db.update("transactions", btn.dataset.collect, { finePaid: true });
    LIB.toast("Fine marked as paid.");
    renderTransactions();
  });

  $("resetDemo").addEventListener("click", async function () {
    const ok = await LIB.confirmDialog({
      title: "Reset all demo data?",
      message: "Every issue, return, request, sign up and edit will be cleared and the data reloaded from the JSON files. You will stay logged in if your account exists in the JSON.",
      confirmText: "Reset data",
      danger: true,
    });
    if (!ok) return;
    await db.reset();
    location.reload();
  });

  /* ============================ start ============================ */

  function refreshAll() {
    fillIssueMembers();
    fillIssueBooks();
    refreshIssue();
    fillReturnMembers();
    fillReturnBooks();
    refreshReturn();
    renderRequests();
    renderTransactions();
  }

  $("issueDate").max = LIB.today();
  $("returnDate").max = LIB.today();
  refreshAll();

  // ?book= / ?member= / ?return= preselect only once, then clean the URL
  if (location.search) history.replaceState(null, "", "issue-return.html");
});
