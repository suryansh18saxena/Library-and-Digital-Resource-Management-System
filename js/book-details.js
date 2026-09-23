/* book details page - picks the book out of books.json using the ?id= in the url */

function infoRow(label, value) {
  return (
    "<tr><td class='text-muted-soft fw-semibold' style='width:190px'>" +
    label +
    "</td><td>" +
    LIB.escapeHtml(String(value)) +
    "</td></tr>"
  );
}

function reviewBlock(review) {
  return (
    '<div class="border-bottom pb-3 mb-3">' +
    '<div class="d-flex justify-content-between align-items-center flex-wrap gap-2">' +
    '<strong>' + LIB.escapeHtml(review.member) + "</strong>" +
    '<span class="rating">' + LIB.stars(review.rating) + "</span>" +
    "</div>" +
    '<div class="text-muted-soft small mb-2">' + LIB.fmtDate(review.date) + "</div>" +
    "<p class='mb-0 small'>" + LIB.escapeHtml(review.text) + "</p>" +
    "</div>"
  );
}

function renderBook(book, allBooks) {
  document.getElementById("crumbTitle").textContent = book.title;
  document.title = book.title + " | GLA Central Library";

  const availability =
    book.copiesAvailable > 0
      ? book.copiesAvailable + " of " + book.copiesTotal + " copies on the shelf"
      : "All " + book.copiesTotal + " copies are out";

  const reviews = book.reviews && book.reviews.length
    ? book.reviews.map(reviewBlock).join("")
    : '<p class="text-muted-soft small mb-0">No reviews for this title yet.</p>';

  document.getElementById("bookDetail").innerHTML =
    '<div class="row g-4 g-lg-5">' +
      '<div class="col-lg-4">' +
        '<img src="' + book.cover + '" alt="Cover of ' + LIB.escapeHtml(book.title) + '" class="img-fluid rounded-3 shadow-sm w-100">' +
        '<div class="card mt-3"><div class="card-body d-grid gap-2">' +
          '<a href="issue-return.html?book=' + book.id + '" class="btn btn-gold' + (book.copiesAvailable > 0 ? "" : " disabled") + '">' +
            (book.copiesAvailable > 0 ? "Issue This Book" : "Currently Unavailable") +
          "</a>" +
          '<button class="btn btn-outline-secondary" id="reserveBtn">Reserve for Later</button>' +
          '<p class="text-muted-soft small text-center mb-0 mt-1">' + availability + "</p>" +
        "</div></div>" +
      "</div>" +

      '<div class="col-lg-8">' +
        '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2">' +
          "<div>" +
            '<div class="card-category mb-1">' + LIB.escapeHtml(book.category) + " &middot; " + LIB.escapeHtml(book.subject) + "</div>" +
            '<h1 class="h2 mb-2">' + LIB.escapeHtml(book.title) + "</h1>" +
            '<p class="text-muted-soft mb-0">by ' + LIB.escapeHtml(book.author) + "</p>" +
          "</div>" +
          LIB.statusBadge(book.status) +
        "</div>" +

        '<div class="d-flex flex-wrap gap-2 my-3">' +
          '<span class="chip"><span class="rating">' + LIB.stars(book.rating) + "</span> " + book.rating + "</span>" +
          '<span class="chip">' + LIB.escapeHtml(book.edition) + "</span>" +
          '<span class="chip">' + LIB.escapeHtml(book.language) + "</span>" +
          '<span class="chip">' + book.pages + " pages</span>" +
          '<span class="chip">' + LIB.escapeHtml(book.publisher) + "</span>" +
        "</div>" +

        '<ul class="nav nav-tabs mt-4" role="tablist">' +
          '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-about" type="button">Description</button></li>' +
          '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-info" type="button">Book Info</button></li>' +
          '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-reviews" type="button">Reviews (' + book.reviewCount + ")</button></li>" +
        "</ul>" +

        '<div class="tab-content border border-top-0 rounded-bottom p-4 bg-white">' +
          '<div class="tab-pane fade show active" id="tab-about">' +
            "<p class='mb-3'>" + LIB.escapeHtml(book.description) + "</p>" +
            '<div class="d-flex flex-wrap gap-2">' +
              book.tags.map((t) => '<span class="chip">' + LIB.escapeHtml(t) + "</span>").join("") +
            "</div>" +
          "</div>" +
          '<div class="tab-pane fade" id="tab-info">' +
            '<table class="table table-sm mb-0"><tbody>' +
              infoRow("ISBN", book.isbn) +
              infoRow("Publisher", book.publisher) +
              infoRow("Edition", book.edition) +
              infoRow("Category", book.category + " / " + book.subject) +
              infoRow("Shelf Location", book.shelf) +
              infoRow("Copies Available", book.copiesAvailable + " of " + book.copiesTotal) +
              infoRow("Added To Library", LIB.fmtDate(book.addedOn)) +
            "</tbody></table>" +
          "</div>" +
          '<div class="tab-pane fade" id="tab-reviews">' + reviews + "</div>" +
        "</div>" +
      "</div>" +
    "</div>";

  const reserve = document.getElementById("reserveBtn");
  if (reserve) {
    reserve.addEventListener("click", function () {
      LIB.toast("Reservation noted for " + book.title + ".", "success");
    });
  }

  const similar = allBooks
    .filter((b) => b.id !== book.id && b.category === book.category)
    .slice(0, 4);

  if (similar.length) {
    document.getElementById("similarBooks").innerHTML = similar.map((b) => LIB.bookCard(b)).join("");
    document.getElementById("similarWrap").hidden = false;
    LIB.initReveal();
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  const slot = document.getElementById("bookDetail");
  let books;

  try {
    books = await LIB.load("books");
  } catch (err) {
    LIB.showLoadError(slot, err);
    return;
  }

  const id = LIB.param("id");
  const book = books.find((b) => b.id === id) || books[0];

  if (!book) {
    slot.innerHTML = '<div class="empty-state">That book is not in the catalogue.</div>';
    return;
  }

  renderBook(book, books);
});
