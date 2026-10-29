function resourceCard(resource) {
  return `
    <div class="col-sm-6 col-lg-4">
      <div class="card card-lift h-100">
        <div class="resource-head"><img src="${resource.icon}" alt=""></div>
        <div class="card-body">
          <p class="card-category mb-1">${resource.type}</p>
          <h3 class="card-title-sm">${resource.title}</h3>
          <p class="text-muted-soft small mb-3">${resource.author}</p>
          <span class="chip">${resource.format}</span>
          <span class="chip">${resource.size}</span>
          <span class="chip">${resource.views} views</span>
        </div>
      </div>
    </div>`;
}

const topResources = document.getElementById("topResources");
const resourceGrid = document.getElementById("resourceGrid");

fetch("data/resources.json")
  .then(function (res) {
    return res.json();
  })
  .then(function (resources) {
    if (topResources) {
      const popular = resources
        .slice()
        .sort(function (a, b) {
          return b.views - a.views;
        })
        .slice(0, 3);
      topResources.innerHTML = popular.map(resourceCard).join("");
    }

    if (resourceGrid) {
      setUpResources(resources);
    }
  })
  .catch(function () {
    showError(topResources);
    showError(resourceGrid);
  });

function setUpResources(resources) {
  const resSearch = document.getElementById("resSearch");
  const resCount = document.getElementById("resCount");

  function search() {
    const term = resSearch.value.trim().toLowerCase();

    const found = resources.filter(function (resource) {
      return (resource.title + " " + resource.author + " " + resource.type)
        .toLowerCase()
        .includes(term);
    });

    resCount.textContent = found.length + " resources available";
    resourceGrid.innerHTML = found.length
      ? found.map(resourceCard).join("")
      : '<div class="col-12"><div class="empty-state">No resources matched your search.</div></div>';
  }

  resSearch.addEventListener("input", search);
  search();
}
