/* Digital resources page (digital-resources.html)
 * Owner: Tanishq Rastogi
 * Type tabs, search, sort, open-access switch, "Open" with view counting,
 * and "Save" to the member's account (shown on the member dashboard).
 */

LIB.page({}, function (ctx) {
  const user = ctx.user;
  const db = ctx.db;
  const $ = LIB.$;
  const esc = LIB.esc;

  const state = {
    type: "All",
    q: LIB.param("q") || "",
    sort: "popular",
    openOnly: false,
    savedOnly: LIB.param("saved") === "1",
  };

  const canSave = LIB.can("resources.save", user);
  const canOpenAll = LIB.can("resources.open", user);

  function saved() {
    return canSave ? user.savedResources || [] : [];
  }

  /* ---------- type tabs built from the data ---------- */

  function renderTabs() {
    const all = db.all("resources");
    const counts = { All: all.length };
    all.forEach((r) => (counts[r.type] = (counts[r.type] || 0) + 1));
    $("typeTabs").innerHTML = Object.keys(counts)
      .map(function (type) {
        return (
          '<button type="button" class="pill-btn' + (state.type === type ? " active" : "") + '" data-type="' + esc(type) + '"' +
          ' aria-pressed="' + (state.type === type) + '">' + esc(type) + '<span class="count">' + counts[type] + "</span></button>"
        );
      })
      .join("");
  }

  /* ---------- one card ---------- */

  function card(r) {
    const isOpen = r.access === "open";
    const isSaved = saved().includes(r.id);
    const openBtn =
      isOpen || canOpenAll
        ? '<button type="button" class="btn btn-navy btn-sm" data-open="' + r.id + '"><i class="bi bi-box-arrow-up-right me-1"></i>Open</button>'
        : '<a class="btn btn-outline-secondary btn-sm" href="login.html?next=digital-resources.html"><i class="bi bi-lock me-1"></i>Log in to open</a>';
    const saveBtn = canSave
      ? '<button type="button" class="btn btn-outline-secondary btn-sm save-btn' + (isSaved ? " saved" : "") + '" data-save="' + r.id + '" aria-pressed="' + isSaved + '">' +
        '<i class="bi bi-bookmark' + (isSaved ? "-fill" : "") + ' me-1"></i>' + (isSaved ? "Saved" : "Save") + "</button>"
      : "";

    return (
      '<div class="col-sm-6 col-lg-4"><div class="card card-lift h-100">' +
      '<div class="resource-head position-relative"><img src="' + esc(r.icon) + '" alt="">' +
      '<span class="badge-soft position-absolute top-0 end-0 m-2 ' + (isOpen ? "access-open" : "access-subscription") + '">' +
      (isOpen ? "Open access" : "Members only") + "</span></div>" +
      '<div class="card-body d-flex flex-column">' +
      '<p class="card-category mb-1">' + esc(r.type) + "</p>" +
      '<h3 class="card-title-sm">' + esc(r.title) + "</h3>" +
      '<p class="text-muted-soft small mb-2">' + esc(r.author) + "</p>" +
      '<p class="small mb-3">' + esc(r.description) + "</p>" +
      '<div class="mb-3"><span class="chip">' + esc(r.format) + '</span> <span class="chip">' + esc(r.size) + "</span> " +
      '<span class="chip"><i class="bi bi-eye"></i> <span data-views="' + r.id + '">' + Number(r.views).toLocaleString("en-IN") + "</span></span></div>" +
      '<div class="mt-auto d-flex gap-2">' + openBtn + saveBtn + "</div>" +
      "</div></div></div>"
    );
  }

  /* ---------- list ---------- */

  function render() {
    const term = state.q.trim().toLowerCase();
    const sorters = {
      popular: (a, b) => b.views - a.views,
      newest: (a, b) => b.addedOn.localeCompare(a.addedOn),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    const list = db
      .where("resources", function (r) {
        if (state.type !== "All" && r.type !== state.type) return false;
        if (state.openOnly && r.access !== "open") return false;
        if (state.savedOnly && !saved().includes(r.id)) return false;
        return (r.title + " " + r.author + " " + r.type + " " + r.description).toLowerCase().includes(term);
      })
      .sort(sorters[state.sort]);

    $("resCount").textContent = list.length + (list.length === 1 ? " resource" : " resources") + " found";
    $("resourceGrid").innerHTML = list.length
      ? list.map(card).join("")
      : '<div class="col-12">' + LIB.emptyState(state.savedOnly ? "You have not saved any resources yet." : "No resources matched your search.", "cloud-slash") + "</div>";
  }

  /* ---------- events ---------- */

  $("resSearch").value = state.q;
  $("resSearch").addEventListener("input", function () {
    state.q = this.value;
    render();
  });

  $("resSort").addEventListener("change", function () {
    state.sort = this.value;
    render();
  });

  $("openOnly").addEventListener("change", function () {
    state.openOnly = this.checked;
    render();
  });

  if (canSave) {
    $("savedOnlyWrap").hidden = false;
    $("savedOnly").checked = state.savedOnly;
    $("savedOnly").addEventListener("change", function () {
      state.savedOnly = this.checked;
      render();
    });
  }

  $("typeTabs").addEventListener("click", function (e) {
    const btn = e.target.closest("[data-type]");
    if (!btn) return;
    state.type = btn.dataset.type;
    renderTabs();
    render();
  });

  $("resourceGrid").addEventListener("click", function (e) {
    const openBtn = e.target.closest("[data-open]");
    if (openBtn) {
      const r = db.get("resources", openBtn.dataset.open);
      db.update("resources", r.id, { views: r.views + 1 });
      const counter = document.querySelector('[data-views="' + r.id + '"]');
      if (counter) counter.textContent = Number(r.views).toLocaleString("en-IN");
      window.open(r.url, "_blank", "noopener");
      return;
    }

    const saveBtn = e.target.closest("[data-save]");
    if (saveBtn) {
      const id = saveBtn.dataset.save;
      const list = saved().slice();
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
      else list.push(id);
      db.update("members", user.memberId, { savedResources: list });
      LIB.toast(i >= 0 ? "Removed from your saved resources." : "Saved to your dashboard.", i >= 0 ? "info" : "success");
      render();
    }
  });

  renderTabs();
  render();
});
