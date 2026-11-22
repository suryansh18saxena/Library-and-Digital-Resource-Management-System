/* Home page (index.html)
 * Owner: Suryansh Saxena
 * Animated hero counters, quick search categories, newest books,
 * most viewed digital resources and a call to action that changes per role.
 */

LIB.page({}, function (ctx) {
  const user = ctx.user;
  const db = ctx.db;
  const books = db.all("books");
  const resources = db.all("resources");

  /* hero counters count up from 0 when they scroll into view */
  function animateCounter(el) {
    const target = Number(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || "";
    const start = performance.now();
    const duration = 1200;
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-IN") + (p === 1 ? suffix : "");
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          io.unobserve(entry.target);
        }
      });
    });
    counters.forEach((c) => io.observe(c));
  } else {
    counters.forEach(animateCounter);
  }

  /* quick search categories come from the data, not hard coded */
  const categories = [...new Set(books.map((b) => b.category))].sort();
  LIB.$("cat").innerHTML +=
    categories.map((c) => '<option value="' + LIB.esc(c) + '">' + LIB.esc(c) + "</option>").join("");

  /* four newest books */
  const newest = books
    .slice()
    .sort((a, b) => b.addedOn.localeCompare(a.addedOn))
    .slice(0, 4);
  LIB.$("latestBooks").innerHTML = newest.map((b) => LIB.bookCard(b)).join("");

  /* three most viewed resources */
  const popular = resources
    .slice()
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);
  LIB.$("topResources").innerHTML = popular.map(LIB.resourceCard).join("");

  /* call to action depends on who is looking */
  if (user) {
    const isLibrarian = user.role === "librarian";
    LIB.$("ctaBox").innerHTML =
      '<div class="col-lg-8"><h2 class="h4 text-white mb-2">Welcome back, ' + LIB.esc(LIB.shortName(user.name)) + "</h2>" +
      '<p class="mb-0 text-light opacity-75">' +
      (isLibrarian
        ? LIB.pendingRequests().length + " book request(s) are waiting for approval at the desk."
        : "You have " + LIB.openLoans(user.memberId).length + " book(s) on loan. Check due dates and fines on your dashboard.") +
      "</p></div>" +
      '<div class="col-lg-4 text-lg-end"><a href="' + LIB.homeFor(user) + '" class="btn btn-gold px-4">' +
      (isLibrarian ? "Open Librarian Desk" : "Go to My Dashboard") + "</a></div>";
  }
});
