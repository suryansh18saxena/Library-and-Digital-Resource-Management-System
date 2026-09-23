/* digital resources page - type tabs, search and sort over resources.json */

let allResources = [];
let activeType = "All";

const resGrid = document.getElementById("resourceGrid");
const resCount = document.getElementById("resCount");
const resSearch = document.getElementById("resSearch");
const resSort = document.getElementById("resSort");

function buildTypeTabs() {
  const types = ["All"].concat(Array.from(new Set(allResources.map((r) => r.type))).sort());
  document.getElementById("typeTabs").innerHTML = types
    .map(function (type) {
      const active = type === activeType;
      return (
        '<button type="button" class="btn btn-sm rounded-pill px-3 type-tab ' +
        (active ? "btn-navy" : "btn-outline-secondary") +
        '" data-type="' + LIB.escapeHtml(type) + '">' +
        LIB.escapeHtml(type === "All" ? "All Resources" : type) +
        "</button>"
      );
    })
    .join("");

  document.querySelectorAll(".type-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeType = btn.dataset.type;
      buildTypeTabs();
      render();
    });
  });
}

function render() {
  const term = resSearch.value.trim().toLowerCase();

  let list = allResources.filter(function (res) {
    if (activeType !== "All" && res.type !== activeType) return false;
    if (term) {
      const haystack = (res.title + " " + res.author + " " + res.format + " " + res.type).toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const sort = resSort.value;
  if (sort === "newest") list.sort((a, b) => b.addedOn.localeCompare(a.addedOn));
  else if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
  else list.sort((a, b) => b.views - a.views);

  if (!list.length) {
    resGrid.innerHTML =
      '<div class="col-12"><div class="empty-state">' +
      '<i class="bi bi-folder2-open fs-2 d-block mb-2 opacity-50"></i>' +
      "<strong>Nothing matched that search.</strong><br>Try a different keyword or switch back to All Resources." +
      "</div></div>";
    resCount.textContent = "No resources found";
    return;
  }

  resGrid.innerHTML = list
    .map(function (res) {
      const open = res.access === "open";
      const action = open
        ? '<a href="#" class="btn btn-navy btn-sm w-100 mt-3 res-open" data-title="' + LIB.escapeHtml(res.title) + '">View Resource</a>'
        : '<a href="#" class="btn btn-outline-secondary btn-sm w-100 mt-3 res-request" data-title="' + LIB.escapeHtml(res.title) + '">Request Access</a>';

      return (
        '<div class="col-sm-6 col-lg-4 reveal"><div class="card card-lift h-100">' +
        '<div class="resource-head"><img src="' + res.icon + '" alt=""></div>' +
        '<div class="card-body d-flex flex-column">' +
        '<div class="card-category mb-1">' + LIB.escapeHtml(res.type) + "</div>" +
        '<h3 class="card-title-sm">' + LIB.escapeHtml(res.title) + "</h3>" +
        '<div class="text-muted-soft small mb-2">' + LIB.escapeHtml(res.author) + "</div>" +
        '<p class="small text-muted-soft mb-3">' + LIB.escapeHtml(res.description) + "</p>" +
        '<div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">' +
        '<span class="badge-soft ' + (open ? "badge-available" : "badge-reserved") + '">' +
        (open ? "Open Access" : "Subscription") + "</span>" +
        '<span class="chip">' + LIB.escapeHtml(res.format) + " &middot; " + LIB.escapeHtml(res.size) + "</span>" +
        "</div>" + action +
        "</div></div></div>"
      );
    })
    .join("");

  resCount.innerHTML =
    "Showing <strong>" + list.length + "</strong> of <strong>" + allResources.length + "</strong> digital resources";

  resGrid.querySelectorAll(".res-open").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      LIB.toast("Opening " + link.dataset.title + ". (Demo link, no file attached yet.)", "dark");
    });
  });

  resGrid.querySelectorAll(".res-request").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      LIB.toast("Access request sent to the librarian for " + link.dataset.title + ".", "success");
    });
  });

  LIB.initReveal();
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    allResources = await LIB.load("resources");
  } catch (err) {
    LIB.showLoadError(resGrid, err);
    resCount.textContent = "";
    return;
  }

  buildTypeTabs();
  render();

  let debounce;
  resSearch.addEventListener("input", function () {
    clearTimeout(debounce);
    debounce = setTimeout(render, 200);
  });

  resSort.addEventListener("change", render);
});
