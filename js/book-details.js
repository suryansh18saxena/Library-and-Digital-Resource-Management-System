/* book details page - picks the book out of books.json using the ?id= in the url */

/* Creates a table row with a label and its corresponding value. */
function infoRow(label, value) {
  return (
    "<tr><td class='text-muted-soft fw-semibold' style='width:190px'>" +
    label +
    "</td><td>" +
    LIB.escapeHtml(String(value)) +
    "</td></tr>"
  );
  // Converts the value to a string, escapes HTML characters, and returns the completed table row.
}

/* Creates the HTML block for displaying an individual book review. */
function reviewBlock(review) {
  return (
    '<div class="border-bottom pb-3 mb-3">' +
    '<div class="d-flex justify-content-between align-items-center flex-wrap gap-2">' +
    '<strong>' + LIB.escapeHtml(review.member) + "</strong>" +
    // Displays the reviewer's name after escaping HTML characters.
    '<span class="rating">' + LIB.stars(review.rating) + "</span>" +
    // Displays the star rating using the library's stars helper.
    "</div>" +
    '<div class="text-muted-soft small mb-2">' + LIB.fmtDate(review.date) + "</div>" +
    // Formats and displays the review date.
    "<p class='mb-0 small'>" + LIB.escapeHtml(review.text) + "</p>" +
    // Displays the review text safely by escaping HTML characters.
    "</div>"
  );
  // Combines the reviewer's name, rating, date, and review text into one HTML block.
}

/* Displays all details of the selected book on the page. */
function renderBook(book, allBooks) {
  document.getElementById("crumbTitle").textContent = book.title;
  // Updates the breadcrumb title with the selected book's title.

  document.title = book.title + " | GLA Central Library";
  // Sets the browser tab title to the book's title and library name.

  // Determines whether the book has available copies and prepares the availability message.
  const availability =
    book.copiesAvailable > 0
      ? book.copiesAvailable + " of " + book.copiesTotal + " copies on the shelf"
      : "All " + book.copiesTotal + " copies are out";

  // Generates the HTML for all reviews, or displays a message if no reviews exist.
  const reviews = book.reviews && book.reviews.length
    ? book.reviews.map(reviewBlock).join("")
    : '<p class="text-muted-soft small mb-0">No reviews for this title yet.</p>';

  // Inserts the complete book details page into the bookDetail element.
  document.getElementById("bookDetail").innerHTML =
    // Creates the main Bootstrap row containing the cover and book information.
    '<div class="row g-4 g-lg-5">' +

      // Left column: book cover, issue button, reservation button, and availability.
      '<div class="col-lg-4">' +

        // Displays the book cover with responsive sizing, rounded corners, and a shadow.
        '<img src="' + book.cover + '" alt="Cover of ' + LIB.escapeHtml(book.title) + '" class="img-fluid rounded-3 shadow-sm w-100">' +

        // Creates a card containing the book actions and availability information.
        '<div class="card mt-3"><div class="card-body d-grid gap-2">' +

          // Creates the issue-book link and disables its button styling when no copies are available.
          '<a href="issue-return.html?book=' + book.id + '" class="btn btn-gold' + (book.copiesAvailable > 0 ? "" : " disabled") + '">' +

            // Displays the appropriate button text based on book availability.
            (book.copiesAvailable > 0 ? "Issue This Book" : "Currently Unavailable") +

          "</a>" +

          // Creates the button used to reserve the book for later.
          '<button class="btn btn-outline-secondary" id="reserveBtn">Reserve for Later</button>' +

          // Displays the availability message prepared above.
          '<p class="text-muted-soft small text-center mb-0 mt-1">' + availability + "</p>" +

        "</div></div>" +
      "</div>" +

      // Right column: book metadata, ratings, description, detailed information, and reviews.
      '<div class="col-lg-8">' +

        // Creates a flexible header containing the book details and status badge.
        '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2">' +
          "<div>" +

            // Displays the book's category and subject, separated by a middle dot.
            '<div class="card-category mb-1">' + LIB.escapeHtml(book.category) + " &middot; " + LIB.escapeHtml(book.subject) + "</div>" +

            // Displays the book title as the main heading.
            '<h1 class="h2 mb-2">' + LIB.escapeHtml(book.title) + "</h1>" +

            // Displays the author's name.
            '<p class="text-muted-soft mb-0">by ' + LIB.escapeHtml(book.author) + "</p>" +

          "</div>" +

          // Generates the badge showing the book's current status.
          LIB.statusBadge(book.status) +

        "</div>" +

        // Displays rating, edition, language, page count, and publisher as chips.
        '<div class="d-flex flex-wrap gap-2 my-3">' +

          // Shows the star rating and its numerical value.
          '<span class="chip"><span class="rating">' + LIB.stars(book.rating) + "</span> " + book.rating + "</span>" +

          // Displays the book's edition.
          '<span class="chip">' + LIB.escapeHtml(book.edition) + "</span>" +

          // Displays the book's language.
          '<span class="chip">' + LIB.escapeHtml(book.language) + "</span>" +

          // Displays the total number of pages.
          '<span class="chip">' + book.pages + " pages</span>" +

          // Displays the publisher's name.
          '<span class="chip">' + LIB.escapeHtml(book.publisher) + "</span>" +

        "</div>" +

        // Creates the navigation tabs for the description, book information, and reviews.
        '<ul class="nav nav-tabs mt-4" role="tablist">' +

          // Description tab: active by default.
          '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-about" type="button">Description</button></li>' +

          // Book Info tab: displays detailed bibliographic information.
          '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-info" type="button">Book Info</button></li>' +

          // Reviews tab: includes the total review count.
          '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-reviews" type="button">Reviews (' + book.reviewCount + ")</button></li>" +

        "</ul>" +

        // Container holding the content associated with the three tabs.
        '<div class="tab-content border border-top-0 rounded-bottom p-4 bg-white">' +

          // Description tab content; visible when the page initially loads.
          '<div class="tab-pane fade show active" id="tab-about">' +

            // Displays the book's description.
            "<p class='mb-3'>" + LIB.escapeHtml(book.description) + "</p>" +

            // Creates a flexible container for the book's tags.
            '<div class="d-flex flex-wrap gap-2">' +

              // Converts every tag into a chip and joins the resulting HTML strings.
              book.tags.map((t) => '<span class="chip">' + LIB.escapeHtml(t) + "</span>").join("") +

            "</div>" +
          "</div>" +

          // Book Info tab content.
          '<div class="tab-pane fade" id="tab-info">' +

            // Creates a compact Bootstrap table for the book's bibliographic details.
            '<table class="table table-sm mb-0"><tbody>' +

              // Adds the ISBN to the table.
              infoRow("ISBN", book.isbn) +

              // Adds the publisher to the table.
              infoRow("Publisher", book.publisher) +

              // Adds the edition to the table.
              infoRow("Edition", book.edition) +

              // Adds the category and subject to the table.
              infoRow("Category", book.category + " / " + book.subject) +

              // Adds the physical shelf location.
              infoRow("Shelf Location", book.shelf) +

              // Adds the number of available copies and total copies.
              infoRow("Copies Available", book.copiesAvailable + " of " + book.copiesTotal) +

              // Adds the date the book was added to the library.
              infoRow("Added To Library", LIB.fmtDate(book.addedOn)) +

            "</tbody></table>" +
          "</div>" +

          // Reviews tab content; inserts the reviews generated earlier.
          '<div class="tab-pane fade" id="tab-reviews">' + reviews + "</div>" +

        "</div>" +
      "</div>" +
    "</div>";

  // Finds the Reserve for Later button in the generated HTML.
  const reserve = document.getElementById("reserveBtn");

  // Checks that the button exists before attaching an event listener.
  if (reserve) {

    // Runs this function when the user clicks the reservation button.
    reserve.addEventListener("click", function () {

      // Displays a success-style notification containing the book's title.
      // This records a notification in the interface; it does not save a reservation to a database.
      LIB.toast("Reservation noted for " + book.title + ".", "success");
    });
  }

  // Finds other books in the same category, excluding the currently selected book.
  const similar = allBooks
    .filter((b) => b.id !== book.id && b.category === book.category)

    // Limits the list of similar books to four.
    .slice(0, 4);

  // Displays the similar-books section only when matching books are found.
  if (similar.length) {

    // Converts each similar book into a book card and joins the cards into HTML.
    document.getElementById("similarBooks").innerHTML = similar.map((b) => LIB.bookCard(b)).join("");

    // Makes the similar-books section visible.
    document.getElementById("similarWrap").hidden = false;

    // Initializes the library's reveal animation or visibility effects.
    LIB.initReveal();
  }
}

// Runs the following asynchronous function after the HTML document has finished loading.
document.addEventListener("DOMContentLoaded", async function () {

  // Finds the HTML element where the book details will be displayed.
  const slot = document.getElementById("bookDetail");

  // Declares a variable that will hold the list of books.
  let books;

  // Attempts to load the book catalogue using the library helper.
  try {
    books = await LIB.load("books");
  } catch (err) {

    // Displays a loading error if the catalogue cannot be loaded.
    LIB.showLoadError(slot, err);

    // Stops execution because the book data could not be loaded.
    return;
  }

  // Reads the book ID from the URL query parameter, such as ?id=book123.
  const id = LIB.param("id");

  // Finds the book whose ID matches the URL parameter.
  // If no matching book is found, selects the first book in the catalogue.
  const book = books.find((b) => b.id === id) || books[0];

  // Checks whether a book was found in the catalogue.
  if (!book) {

    // Displays a message if the catalogue contains no suitable book.
    slot.innerHTML = '<div class="empty-state">That book is not in the catalogue.</div>';

    // Stops execution because there is no book to display.
    return;
  }

  // Renders the selected book and passes the complete catalogue for similar-book suggestions.
  renderBook(book, books);
});