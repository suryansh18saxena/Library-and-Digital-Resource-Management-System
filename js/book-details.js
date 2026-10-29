const bookDetail = document.getElementById("bookDetail");
const bookId = new URLSearchParams(location.search).get("id");

fetch("data/books.json")
  .then(function (res) {
    return res.json();
  })
  .then(function (books) {
    const book = books.find(function (b) {
      return b.id === bookId;
    });

    if (!book) {
      bookDetail.innerHTML = '<div class="empty-state">Book not found.</div>';
      return;
    }

    document.getElementById("crumbTitle").textContent = book.title;
    document.title = book.title + " | GLA Central Library";

    const badge = book.copiesAvailable > 0 ? "badge-available" : "badge-issued";
    const availability =
      book.copiesAvailable > 0
        ? book.copiesAvailable + " of " + book.copiesTotal + " copies available"
        : "All copies issued";

    bookDetail.innerHTML = `
      <div class="row g-4">
        <div class="col-md-4 col-lg-3">
          <div class="card book-card">
            <div class="cover-wrap"><img src="${book.cover}" alt="${book.title}"></div>
          </div>
        </div>
        <div class="col-md-8 col-lg-9">
          <p class="card-category mb-1">${book.category}</p>
          <h1 class="h3">${book.title}</h1>
          <p class="text-muted-soft">${book.author}</p>
          <span class="badge ${badge}">${availability}</span>
          <span class="rating ms-2">${book.rating} &#9733; (${book.reviewCount} reviews)</span>
          <p class="mt-3">${book.description}</p>
          <ul class="list-unstyled small text-muted-soft">
            <li><strong>ISBN:</strong> ${book.isbn}</li>
            <li><strong>Publisher:</strong> ${book.publisher}</li>
            <li><strong>Edition:</strong> ${book.edition}</li>
            <li><strong>Pages:</strong> ${book.pages}</li>
            <li><strong>Language:</strong> ${book.language}</li>
            <li><strong>Shelf:</strong> ${book.shelf}</li>
          </ul>
        </div>
      </div>`;
  })
  .catch(function () {
    showError(bookDetail);
  });
