/* member dashboard - joins the logged in member with their transactions and books */

function bookCell(book) {
  if (!book) return "<span class='text-muted-soft'>Unknown title</span>";
  return (
    '<div class="d-flex align-items-center gap-2">' +
    '<img src="' + book.cover + '" alt="" class="mini-cover">' +
    '<a href="book-details.html?id=' + book.id + '" class="text-decoration-none fw-semibold">' +
    LIB.escapeHtml(book.title) +
    "</a></div>"
  );
}

function statBox(value, label, warn) {
  return (
    '<div class="col-6 col-xl-3"><div class="stat-box' + (warn ? " is-warn" : "") + '">' +
    '<span class="num">' + value + "</span>" +
    '<span class="text-muted-soft small">' + label + "</span>" +
    "</div></div>"
  );
}

function renderProfile(me) {
  document.getElementById("profileCard").innerHTML =
    '<img src="img/avatar.svg" alt="" width="84" height="84" class="rounded-circle mb-3">' +
    "<h2 class='h5 mb-1'>" + LIB.escapeHtml(me.name) + "</h2>" +
    '<p class="text-muted-soft small mb-2">' + LIB.escapeHtml(me.course) + " &middot; " + LIB.escapeHtml(me.year) + "</p>" +
    '<span class="badge-soft badge-available">Active Member</span>' +
    '<ul class="list-unstyled profile-detail text-start mt-3 mb-3">' +
    "<li><span>Member ID</span><span>" + LIB.escapeHtml(me.memberId) + "</span></li>" +
    "<li><span>Membership</span><span>" + LIB.escapeHtml(me.membership) + "</span></li>" +
    "<li><span>Joined</span><span>" + LIB.fmtDate(me.joined) + "</span></li>" +
    "<li><span>Book limit</span><span>" + me.bookLimit + " at a time</span></li>" +
    "</ul>" +
    '<a href="issue-return.html" class="btn btn-navy w-100">Issue a New Book</a>';
}

document.addEventListener("DOMContentLoaded", async function () {
  const me = LIB.requireAuth();
  if (!me) return;

  renderProfile(me);

  let books, transactions, resources;
  try {
    books = await LIB.load("books");
    transactions = await LIB.allTransactions();
    resources = await LIB.load("resources");
  } catch (err) {
    LIB.showLoadError(document.getElementById("statRow"), err);
    return;
  }

  const bookById = {};
  books.forEach((b) => (bookById[b.id] = b));

  const mine = transactions.filter((t) => t.memberId === me.memberId);
  const open = mine.filter((t) => t.action === "issued");
  const past = mine.filter((t) => t.action === "returned");
  const today = LIB.today();

  // an issued book counts as overdue once the due date has gone past
  open.forEach(function (txn) {
    const late = LIB.daysBetween(txn.dueDate, today);
    if (late > 0) {
      txn.status = "overdue";
      txn.fine = late * LIB.FINE_PER_DAY;
      txn.daysLate = late;
    } else {
      txn.status = "issued";
      txn.fine = 0;
      txn.daysLate = 0;
    }
  });

  const overdue = open.filter((t) => t.status === "overdue");
  const totalFine = overdue.reduce((sum, t) => sum + t.fine, 0);

  document.getElementById("statRow").innerHTML =
    statBox(open.length, "Books Issued", false) +
    statBox(overdue.length, "Overdue", overdue.length > 0) +
    statBox(past.length, "Books Returned", false) +
    statBox("&#8377;" + totalFine, "Pending Fine", totalFine > 0);

  if (overdue.length) {
    const first = overdue[0];
    const book = bookById[first.bookId];
    document.getElementById("overdueAlert").innerHTML =
      '<div class="alert alert-warning d-flex gap-2 align-items-start" role="alert">' +
      '<i class="bi bi-exclamation-triangle-fill"></i>' +
      "<div><strong>You have " + overdue.length + " overdue book" + (overdue.length > 1 ? "s" : "") + ".</strong> " +
      (book ? LIB.escapeHtml(book.title) + " was due on " + LIB.fmtDate(first.dueDate) + ". " : "") +
      "A fine of &#8377;" + LIB.FINE_PER_DAY + " per day applies, currently &#8377;" + totalFine + ".</div></div>";
  }

  const issuedRows = document.getElementById("issuedRows");
  if (open.length) {
    issuedRows.innerHTML = open
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map(function (txn) {
        const late = txn.status === "overdue";
        return (
          "<tr><td>" + bookCell(bookById[txn.bookId]) + "</td>" +
          "<td>" + LIB.fmtDate(txn.issuedOn) + "</td>" +
          "<td>" + LIB.fmtDate(txn.dueDate) +
          (late ? '<br><span class="text-danger small">' + txn.daysLate + " days late</span>" : "") + "</td>" +
          "<td>" + LIB.statusBadge(txn.status) + "</td>" +
          '<td class="text-end"><a href="issue-return.html?return=' + txn.id + '" class="btn btn-sm ' +
          (late ? "btn-danger" : "btn-outline-secondary") + '">' + (late ? "Return Now" : "Return") + "</a></td></tr>"
        );
      })
      .join("");
  } else {
    issuedRows.innerHTML =
      '<tr><td colspan="5" class="text-center text-muted-soft py-4">No books issued right now. ' +
      '<a href="catalogue.html" class="text-decoration-none">Browse the catalogue</a>.</td></tr>';
  }

  const historyRows = document.getElementById("historyRows");
  if (past.length) {
    historyRows.innerHTML = past
      .sort((a, b) => (b.returnedOn || "").localeCompare(a.returnedOn || ""))
      .map(function (txn) {
        return (
          "<tr><td>" + bookCell(bookById[txn.bookId]) + "</td>" +
          "<td>" + LIB.fmtDate(txn.issuedOn) + "</td>" +
          "<td>" + LIB.fmtDate(txn.returnedOn) + "</td>" +
          "<td>" + (txn.fine ? "&#8377;" + txn.fine : "-") + "</td>" +
          "<td>" + LIB.statusBadge(txn.status) + "</td></tr>"
        );
      })
      .join("");
  } else {
    historyRows.innerHTML = '<tr><td colspan="5" class="text-center text-muted-soft py-4">No past transactions yet.</td></tr>';
  }

  const savedIds = me.savedResources || [];
  const saved = resources.filter((r) => savedIds.includes(r.id));
  const savedSlot = document.getElementById("savedResources");

  if (saved.length) {
    savedSlot.innerHTML = saved
      .map(function (res) {
        return (
          '<div class="col-sm-6 col-xl-4"><div class="card card-lift h-100">' +
          '<div class="card-body d-flex align-items-center gap-3">' +
          '<img src="' + res.icon + '" alt="" width="38" height="38">' +
          "<div><div class='fw-semibold small'>" + LIB.escapeHtml(res.title) + "</div>" +
          '<div class="text-muted-soft" style="font-size:.8rem">' + LIB.escapeHtml(res.author) + "</div></div>" +
          "</div></div></div>"
        );
      })
      .join("");
  } else {
    savedSlot.innerHTML =
      '<div class="col-12"><div class="empty-state py-4">You have not saved any digital resources yet.</div></div>';
  }
});
