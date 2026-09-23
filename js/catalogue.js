/* catalogue page - client side search, filter, sort and pagination over books.json */

const PER_PAGE = 6;

let allBooks = [];
let currentPage = 1;

const grid = document.getElementById("bookGrid");
const countLabel = document.getElementById("resultCount");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

function checkboxRow(group, value, label, count, checked) {
  const id = group + "-" + value.replace(/[^a-z0-9]/gi, "");
  return (
    '<div class="form-check">' +
    '<input class="form-check-input filter-input" type="checkbox" value="' +
    LIB.escapeHtml(value) + '" id="' + id + '" data-group="' + group + '"' + (checked ? " checked" : "") + ">" +
    '<label class="form-check-label" for="' + id + '">' + LIB.escapeHtml(label) +
    (count !== null ? ' <span class="text-muted-soft">(' + count + ")</span>" : "") +
    "</label></div>"
  );
}

function buildFilters() {
  const byCategory = {};
  const byLanguage = {};
  allBooks.forEach((b) => {
    byCategory[b.category] = (byCategory[b.category] || 0) + 1;
    byLanguage[b.language] = (byLanguage[b.language] || 0) + 1;
  });

  const preselect = LIB.param("category");

  document.getElementById("categoryFilters").innerHTML = Object.keys(byCategory)
    .sort()
    .map((c) => checkboxRow("category", c, c, byCategory[c], preselect === c))
    .join("");

  const statuses = [
    ["available", "Available Now"],
    ["issued", "Currently Issued"],
    ["reserved", "Reserved"],
  ];
  document.getElementById("statusFilters").innerHTML = statuses
    .map((s) => checkboxRow("status", s[0], s[1], allBooks.filter((b) => b.status === s[0]).length, false))
    .join("");

  document.getElementById("languageFilters").innerHTML = Object.keys(byLanguage)
    .sort()
    .map((l) => checkboxRow("language", l, l, byLanguage[l], false))
    .join("");

  document.querySelectorAll(".filter-input").forEach((input) => {
    input.addEventListener("change", function () {
      currentPage = 1;
      render();
    });
  });
}

function selectedValues(group) {
  return Array.from(document.querySelectorAll('.filter-input[data-group="' + group + '"]:checked')).map(
    (el) => el.value
  );
}

function applyFilters() {
  const term = searchInput.value.trim().toLowerCase();
  const categories = selectedValues("category");
  const statuses = selectedValues("status");
  const languages = selectedValues("language");

  let list = allBooks.filter((book) => {
    if (categories.length && !categories.includes(book.category)) return false;
    if (statuses.length && !statuses.includes(book.status)) return false;
    if (languages.length && !languages.includes(book.language)) return false;
    if (term) {
      const haystack = (book.title + " " + book.author + " " + book.isbn + " " + book.subject).toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const sort = sortSelect.value;
  if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "newest") list.sort((a, b) => b.addedOn.localeCompare(a.addedOn));
  else if (sort === "rating") list.sort((a, b) => b.rating - a.rating);

  return list;
}

function renderPagination(totalPages) {
  const holder = document.getElementById("pagination");
  if (totalPages <= 1) {
    holder.innerHTML = "";
    return;
  }

  let html =
    '<li class="page-item' + (currentPage === 1 ? " disabled" : "") + '">' +
    '<button class="page-link" data-page="' + (currentPage - 1) + '">Prev</button></li>';

  for (let i = 1; i <= totalPages; i++) {
    html +=
      '<li class="page-item' + (i === currentPage ? " active" : "") + '">' +
      '<button class="page-link" data-page="' + i + '">' + i + "</button></li>";
  }

  html +=
    '<li class="page-item' + (currentPage === totalPages ? " disabled" : "") + '">' +
    '<button class="page-link" data-page="' + (currentPage + 1) + '">Next</button></li>';

  holder.innerHTML = html;
  holder.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", function () {
      const page = parseInt(btn.dataset.page, 10);
      if (page < 1 || page > totalPages) return;
      currentPage = page;
      render();
      window.scrollTo({ top: 220, behavior: "smooth" });
    });
  });
}

function render() {
  const list = applyFilters();
  const totalPages = Math.ceil(list.length / PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PER_PAGE;
  const page = list.slice(start, start + PER_PAGE);

  if (!list.length) {
    grid.innerHTML =
      '<div class="col-12"><div class="empty-state">' +
      '<i class="bi bi-search fs-2 d-block mb-2 opacity-50"></i>' +
      "<strong>No books matched your search.</strong><br>Try clearing a filter or searching for something else." +
      "</div></div>";
    countLabel.textContent = "No books found";
    renderPagination(1);
    return;
  }

  grid.innerHTML = page.map((b) => LIB.bookCard(b, "col-sm-6 col-xl-4")).join("");
  countLabel.innerHTML =
    "Showing <strong>" + (start + 1) + "-" + (start + page.length) + "</strong> of <strong>" + list.length + "</strong> books";

  renderPagination(totalPages);
  LIB.initReveal();
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    allBooks = await LIB.load("books");
  } catch (err) {
    LIB.showLoadError(grid, err);
    countLabel.textContent = "";
    return;
  }

  // the home page quick search sends people here with ?q= and ?category=
  const q = LIB.param("q");
  if (q) searchInput.value = q;

  buildFilters();
  render();

  let debounce;
  searchInput.addEventListener("input", function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      currentPage = 1;
      render();
    }, 200);
  });

  document.getElementById("searchBtn").addEventListener("click", function () {
    currentPage = 1;
    render();
  });

  sortSelect.addEventListener("change", render);

  document.getElementById("resetBtn").addEventListener("click", function () {
    document.querySelectorAll(".filter-input").forEach((el) => (el.checked = false));
    searchInput.value = "";
    sortSelect.value = "relevance";
    currentPage = 1;
    render();
  });
});
