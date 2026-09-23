/* issue / return page
 * Issuing and returning writes into localStorage through the LIB transaction
 * helpers, so the dashboard picks the change up straight away.
 */

let books = [];
let members = [];
let transactions = [];
let bookById = {};

const el = (id) => document.getElementById(id);

function summaryRow(label, value, isTotal) {
  return (
    '<div class="srow' + (isTotal ? " total" : "") + '"><span>' + label + "</span><span>" + value + "</span></div>"
  );
}

function openLoansFor(memberId) {
  return transactions.filter((t) => t.memberId === memberId && t.action === "issued");
}

function setStep(n) {
  document.querySelectorAll("#stepBar .step").forEach(function (step, i) {
    step.classList.toggle("is-done", i < n - 1);
    step.classList.toggle("is-active", i === n - 1);
  });
}

/* ---------- issue side ---------- */

function fillIssueBooks() {
  const available = books.filter((b) => b.copiesAvailable > 0);
  el("issueBook").innerHTML = available
    .map(function (b) {
      return '<option value="' + b.id + '">' + LIB.escapeHtml(b.title) + " - " + b.copiesAvailable + " left</option>";
    })
    .join("");

  const preselect = LIB.param("book");
  if (preselect && available.some((b) => b.id === preselect)) {
    el("issueBook").value = preselect;
  }
}

function refreshIssue() {
  const memberId = el("issueMember").value;
  const member = members.find((m) => m.memberId === memberId);
  const book = bookById[el("issueBook").value];
  const issueDate = el("issueDate").value || LIB.today();
  const dueDate = LIB.addDays(issueDate, LIB.LOAN_DAYS);

  el("dueDate").value = dueDate;

  const openCount = openLoansFor(memberId).length;
  const limit = member ? member.bookLimit : 5;
  const atLimit = openCount >= limit;

  el("issueNote").innerHTML =
    "Standard loan period is " + LIB.LOAN_DAYS + " days. This member has <strong>" +
    openCount + " of " + limit + "</strong> allowed books issued.";

  el("issueSummary").innerHTML = book
    ? summaryRow("Book", LIB.escapeHtml(book.title)) +
      summaryRow("Availability", book.copiesAvailable + " of " + book.copiesTotal + " copies") +
      summaryRow("Loan period", LIB.LOAN_DAYS + " days") +
      summaryRow("Due date", LIB.fmtDate(dueDate), true)
    : '<p class="small text-muted-soft mb-0">No book selected.</p>';

  el("issueBookErr").textContent = atLimit
    ? "This member has reached the borrowing limit of " + limit + " books."
    : "";

  setStep(book ? 3 : 2);
  return { member, book, issueDate, dueDate, atLimit };
}

/* ---------- return side ---------- */

function fillReturnBooks() {
  const memberId = el("returnMember").value;
  const open = openLoansFor(memberId);
  const select = el("returnBook");

  if (!open.length) {
    select.innerHTML = '<option value="">No books currently issued</option>';
    select.disabled = true;
  } else {
    select.disabled = false;
    select.innerHTML = open
      .map(function (txn) {
        const book = bookById[txn.bookId];
        const late = LIB.daysBetween(txn.dueDate, LIB.today()) > 0 ? " (overdue)" : "";
        return (
          '<option value="' + txn.id + '">' +
          LIB.escapeHtml(book ? book.title : txn.bookId) +
          " - due " + LIB.fmtDate(txn.dueDate) + late +
          "</option>"
        );
      })
      .join("");

    const preselect = LIB.param("return");
    if (preselect && open.some((t) => t.id === preselect)) select.value = preselect;
  }
}

function refreshReturn() {
  const txnId = el("returnBook").value;
  const txn = transactions.find((t) => t.id === txnId);
  const returnDate = el("returnDate").value || LIB.today();

  if (!txn) {
    el("returnSummary").innerHTML = '<p class="small text-muted-soft mb-0">Nothing selected to return.</p>';
    el("fineAlert").innerHTML = "";
    return null;
  }

  const book = bookById[txn.bookId];
  const daysLate = Math.max(0, LIB.daysBetween(txn.dueDate, returnDate));
  const fine = daysLate * LIB.FINE_PER_DAY;

  el("fineAlert").innerHTML = daysLate
    ? '<div class="alert alert-warning d-flex gap-2 align-items-start py-2 small" role="alert">' +
      '<i class="bi bi-exclamation-triangle-fill"></i><span>Returned ' + daysLate +
      " day" + (daysLate > 1 ? "s" : "") + " late. A fine of &#8377;" + fine +
      " (&#8377;" + LIB.FINE_PER_DAY + " per day) applies.</span></div>"
    : '<div class="alert alert-success d-flex gap-2 align-items-start py-2 small" role="alert">' +
      '<i class="bi bi-check-circle-fill"></i><span>This book is within the due date, so there is no fine.</span></div>';

  el("returnSummary").innerHTML =
    summaryRow("Book", LIB.escapeHtml(book ? book.title : txn.bookId)) +
    summaryRow("Issued on", LIB.fmtDate(txn.issuedOn)) +
    summaryRow("Due date", LIB.fmtDate(txn.dueDate)) +
    summaryRow("Days late", daysLate) +
    summaryRow("Fine", "&#8377;" + fine, true);

  return { txn, book, returnDate, daysLate, fine };
}

/* ---------- transactions table ---------- */

function renderTxnTable() {
  const memberName = {};
  members.forEach((m) => (memberName[m.memberId] = m.name));

  const rows = transactions
    .slice()
    .sort(function (a, b) {
      const aDate = a.returnedOn || a.issuedOn;
      const bDate = b.returnedOn || b.issuedOn;
      return bDate.localeCompare(aDate);
    })
    .slice(0, 8);

  el("txnRows").innerHTML = rows
    .map(function (txn) {
      const book = bookById[txn.bookId];
      return (
        "<tr><td>" + LIB.escapeHtml(memberName[txn.memberId] || txn.memberId) + "</td>" +
        "<td>" + LIB.escapeHtml(book ? book.title : txn.bookId) + "</td>" +
        "<td class='text-capitalize'>" + txn.action + "</td>" +
        "<td>" + LIB.fmtDate(txn.returnedOn || txn.issuedOn) + "</td>" +
        "<td>" + (txn.fine ? "&#8377;" + txn.fine : "-") + "</td>" +
        "<td>" + LIB.statusBadge(txn.status) + "</td></tr>"
      );
    })
    .join("");
}

/* ---------- boot ---------- */

document.addEventListener("DOMContentLoaded", async function () {
  const me = LIB.requireAuth();
  if (!me) return;

  try {
    books = await LIB.load("books");
    members = await LIB.allMembers();
    transactions = await LIB.allTransactions();
  } catch (err) {
    LIB.showLoadError(el("txnRows").closest(".card-body"), err);
    return;
  }

  books.forEach((b) => (bookById[b.id] = b));

  const memberOptions = members
    .map(function (m) {
      return '<option value="' + m.memberId + '"' + (m.memberId === me.memberId ? " selected" : "") + ">" +
        LIB.escapeHtml(m.name) + " - " + m.memberId + "</option>";
    })
    .join("");

  el("issueMember").innerHTML = memberOptions;
  el("returnMember").innerHTML = memberOptions;
  el("issueDate").value = LIB.today();
  el("returnDate").value = LIB.today();

  fillIssueBooks();
  fillReturnBooks();
  refreshIssue();
  refreshReturn();
  renderTxnTable();

  ["issueMember", "issueBook", "issueDate"].forEach((id) => el(id).addEventListener("change", refreshIssue));
  el("returnMember").addEventListener("change", function () {
    fillReturnBooks();
    refreshReturn();
  });
  ["returnBook", "returnDate"].forEach((id) => el(id).addEventListener("change", refreshReturn));

  el("issueForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const state = refreshIssue();
    if (!state.book) return;
    if (state.atLimit) {
      LIB.toast("Borrowing limit reached for this member.", "danger");
      return;
    }

    const txn = {
      id: LIB.nextTxnId(transactions),
      memberId: state.member.memberId,
      bookId: state.book.id,
      action: "issued",
      issuedOn: state.issueDate,
      dueDate: state.dueDate,
      returnedOn: null,
      status: "issued",
      fine: 0,
    };

    LIB.addTransaction(txn);
    transactions.push(txn);
    state.book.copiesAvailable = Math.max(0, state.book.copiesAvailable - 1);

    fillIssueBooks();
    fillReturnBooks();
    refreshIssue();
    refreshReturn();
    renderTxnTable();
    setStep(4);

    LIB.toast(state.book.title + " issued, due " + LIB.fmtDate(state.dueDate) + ".", "success");
  });

  el("returnForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const state = refreshReturn();
    if (!state) {
      LIB.toast("Select a book to return first.", "danger");
      return;
    }

    const status = state.daysLate > 0 ? "returned-late" : "returned";
    LIB.markReturned(state.txn.id, state.returnDate, status, state.fine);

    state.txn.action = "returned";
    state.txn.returnedOn = state.returnDate;
    state.txn.status = status;
    state.txn.fine = state.fine;

    if (state.book) state.book.copiesAvailable += 1;

    fillIssueBooks();
    fillReturnBooks();
    refreshIssue();
    refreshReturn();
    renderTxnTable();

    LIB.toast(
      state.fine
        ? "Returned with a fine of ₹" + state.fine + "."
        : "Returned on time, no fine.",
      state.fine ? "warning" : "success"
    );
  });

  el("resetDemo").addEventListener("click", function () {
    localStorage.removeItem("gla_txn_changes");
    LIB.toast("Demo transactions reset.", "dark");
    setTimeout(() => location.reload(), 600);
  });
});
