/* Catalogue page (catalogue.html)
 * Owner: Suryansh Saxena
 * Search + category / availability / language filters + sort + pagination.
 * The search and filters are kept in the URL, so a filtered list can be
 * bookmarked or shared (e.g. catalogue.html?category=Mathematics).
 */

LIB.page({}, function (ctx) {
  const books = ctx.db.all("books");
  const $ = LIB.$;
  const PAGE_SIZE = 8;

  const state = {
    q: LIB.param("q") || "",
    categories: LIB.param("category") ? [LIB.param("category")] : [],
    availability: "all",
    languages: [],
    sort: LIB.param("sort") || "relevance",
    page: 1,
  };

  /* --------- build the filter checkboxes from the data --------- */

  function countBy(field) {
    const counts = {};
    books.forEach((b) => (counts[b[field]] = (counts[b[field]] || 0) + 1));
    return counts;
  }

  function checkboxList(container, name, counts, selected) {
    container.innerHTML = Object.keys(counts)
      .sort()
      .map(function (value, i) {
        const id = name + i;
        return (
          '<div class="form-check d-flex justify-content-between">' +
          '<span><input class="form-check-input me-2" type="checkbox" name="' + name + '" id="' + id + '" value="' + LIB.esc(value) + '"' +
          (selected.includes(value) ? " checked" : "") + ">" +
          '<label class="form-check-label" for="' + id + '">' + LIB.esc(value) + "</label></span>" +
          '<span class="text-muted-soft small">' + counts[value] + "</span></div>"
        );
      })
      .join("");
  }

  function renderFilters() {
    checkboxList($("categoryFilters"), "category", countBy("category"), state.categories);
    checkboxList($("languageFilters"), "language", countBy("language"), state.languages);

    const options = [
      ["all", "All books"],
      ["available", "Available now"],
      ["issued", "All copies issued"],
    ];
    $("statusFilters").innerHTML = options
      .map(function (o) {
        return (
          '<div class="form-check"><input class="form-check-input" type="radio" name="availability" id="av-' + o[0] + '" value="' + o[0] + '"' +
          (state.availability === o[0] ? " checked" : "") + '><label class="form-check-label" for="av-' + o[0] + '">' + o[1] + "</label></div>"
        );
      })
      .join("");
  }

  /* --------- filtering, sorting, paging --------- */

  function matches(book, term) {
    if (!term) return true;
    const haystack = [book.title, book.author, book.isbn, book.subject, book.publisher].concat(book.tags || []).join(" ").toLowerCase();
    return term.split(/\s+/).every((word) => haystack.includes(word));
  }

  // relevance: title hits score higher than author or tag hits
  function score(book, term) {
    if (!term) return 0;
    const title = book.title.toLowerCase();
    return (title.startsWith(term) ? 3 : 0) + (title.includes(term) ? 2 : 0) + (book.author.toLowerCase().includes(term) ? 1 : 0);
  }

  function results() {
    const term = state.q.trim().toLowerCase();
    const found = books.filter(function (b) {
      if (!matches(b, term)) return false;
      if (state.categories.length && !state.categories.includes(b.category)) return false;
      if (state.languages.length && !state.languages.includes(b.language)) return false;
      if (state.availability === "available" && b.copiesAvailable < 1) return false;
      if (state.availability === "issued" && b.copiesAvailable > 0) return false;
      return true;
    });

    const sorters = {
      relevance: (a, b) => score(b, term) - score(a, term) || b.rating - a.rating,
      title: (a, b) => a.title.localeCompare(b.title),
      newest: (a, b) => b.addedOn.localeCompare(a.addedOn),
      rating: (a, b) => b.rating - a.rating,
      available: (a, b) => b.copiesAvailable - a.copiesAvailable,
    };
    return found.sort(sorters[state.sort] || sorters.relevance);
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      $("pagination").innerHTML = "";
      return;
    }
    let html =
      '<li class="page-item' + (state.page === 1 ? " disabled" : "") + '"><button class="page-link" data-page="' + (state.page - 1) + '" aria-label="Previous">&laquo;</button></li>';
    for (let p = 1; p <= totalPages; p++) {
      html +=
        '<li class="page-item' + (p === state.page ? " active" : "") + '"><button class="page-link" data-page="' + p + '"' +
        (p === state.page ? ' aria-current="page"' : "") + ">" + p + "</button></li>";
    }
    html +=
      '<li class="page-item' + (state.page === totalPages ? " disabled" : "") + '"><button class="page-link" data-page="' + (state.page + 1) + '" aria-label="Next">&raquo;</button></li>';
    $("pagination").innerHTML = html;
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.categories.length === 1) params.set("category", state.categories[0]);
    if (state.sort !== "relevance") params.set("sort", state.sort);
    const qs = params.toString();
    history.replaceState(null, "", "catalogue.html" + (qs ? "?" + qs : ""));
  }

  function render() {
    const list = results();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);

    $("resultCount").textContent = list.length
      ? "Showing " + (start + 1) + "-" + (start + pageItems.length) + " of " + list.length + " books"
      : "0 books found";

    $("bookGrid").innerHTML = pageItems.length
      ? pageItems.map((b) => LIB.bookCard(b, "col-sm-6 col-xl-3")).join("")
      : '<div class="col-12">' + LIB.emptyState("No books matched your search. Try fewer words or reset the filters.", "search") + "</div>";

    renderPagination(totalPages);
    syncUrl();
  }

  /* --------- events --------- */

  let timer = null;
  $("searchInput").value = state.q;
  $("searchInput").addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.q = $("searchInput").value;
      state.page = 1;
      render();
    }, 200);
  });
  $("searchForm").addEventListener("submit", function (e) {
    e.preventDefault();
    state.q = $("searchInput").value;
    state.page = 1;
    render();
  });

  $("sortSelect").value = state.sort;
  $("sortSelect").addEventListener("change", function () {
    state.sort = this.value;
    state.page = 1;
    render();
  });

  document.querySelector(".filter-card").addEventListener("change", function (e) {
    const t = e.target;
    if (t.name === "category" || t.name === "language") {
      const key = t.name === "category" ? "categories" : "languages";
      state[key] = [...document.querySelectorAll('input[name="' + t.name + '"]:checked')].map((i) => i.value);
    } else if (t.name === "availability") {
      state.availability = t.value;
    }
    state.page = 1;
    render();
  });

  $("resetBtn").addEventListener("click", function () {
    state.q = "";
    state.categories = [];
    state.languages = [];
    state.availability = "all";
    state.sort = "relevance";
    state.page = 1;
    $("searchInput").value = "";
    $("sortSelect").value = "relevance";
    renderFilters();
    render();
  });

  $("pagination").addEventListener("click", function (e) {
    const btn = e.target.closest("[data-page]");
    if (!btn || btn.parentElement.classList.contains("disabled")) return;
    state.page = Number(btn.dataset.page);
    render();
    $("bookGrid").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  renderFilters();
  render();
});
