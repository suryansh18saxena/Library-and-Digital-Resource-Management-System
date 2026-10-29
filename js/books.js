function bookCard(book) {
  return `
    <div class="col-sm-6 col-lg-3">
      <a href="book-details.html?id=${book.id}" class="card book-card card-lift h-100 text-decoration-none text-reset">
        <div class="cover-wrap"><img src="${book.cover}" alt="${book.title}"></div>
        <div class="card-body">
          <p class="card-category mb-1">${book.category}</p>
          <h3 class="card-title-sm">${book.title}</h3>
          <p class="text-muted-soft small mb-2">${book.author}</p>
          <span class="rating">${book.rating} &#9733;</span>
        </div>
      </a>
    </div>`;
}

const latestBooks = document.getElementById("latestBooks");
const bookGrid = document.getElementById("bookGrid");

fetch("data/books.json")
  .then(function (res) {
    return res.json();
  })
  .then(function (books) {
    if (latestBooks) {
      const newest = books
        .slice()
        .sort(function (a, b) {
          return b.addedOn.localeCompare(a.addedOn);
        })
        .slice(0, 4);
      latestBooks.innerHTML = newest.map(bookCard).join("");
    }

    if (bookGrid) {
      setUpCatalogue(books);
    }
  })
  .catch(function () {
    showError(latestBooks);
    showError(bookGrid);
  });

function setUpCatalogue(books) {
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const resultCount = document.getElementById("resultCount");
  const params = new URLSearchParams(location.search);
  const category = params.get("category") || "";

  searchInput.value = params.get("q") || "";

  function search() {
    const term = searchInput.value.trim().toLowerCase();

    const found = books.filter(function (book) {
      const haystack = (book.title + " " + book.author + " " + book.isbn).toLowerCase();
      return haystack.includes(term) && (category === "" || book.category === category);
    });

    resultCount.textContent = found.length + " books found";
    bookGrid.innerHTML = found.length
      ? found.map(bookCard).join("")
      : '<div class="col-12"><div class="empty-state">No books matched your search.</div></div>';
  }

  searchBtn.addEventListener("click", search);
  searchInput.addEventListener("input", search);
  search();
}
