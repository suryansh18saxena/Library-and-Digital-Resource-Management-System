/* Book details page (book-details.html?id=BK001)
 * Owner: Tanishq Rastogi
 * Shows one book with live availability, an action panel that changes by
 * role (guest / member / librarian), tabs for overview, details and reviews,
 * and similar books from the same category.
 */

LIB.page({}, function (ctx) {
  const user = ctx.user;
  const db = ctx.db;
  const $ = LIB.$;
  const esc = LIB.esc;
  const bookId = LIB.param("id");

  function stars(rating) {
    const full = Math.round(rating);
    return '<span class="stars" aria-label="' + rating + ' out of 5">' + "&#9733;".repeat(full) + "&#9734;".repeat(5 - full) + "</span>";
  }

  /* ---------------- action panel: different for each role ---------------- */

  function actionPanel(book) {
    if (!user) {
      return (
        '<p class="small text-muted-soft mb-2">Log in with your member account to request this book.</p>' +
        '<a class="btn btn-gold w-100" href="login.html?next=' + encodeURIComponent("book-details.html?id=" + book.id) + '">' +
        '<i class="bi bi-box-arrow-in-right me-1"></i> Log in to request</a>'
      );
    }

    if (user.role === "librarian") {
      const holders = db.where("transactions", (t) => t.bookId === book.id && t.status === "issued");
      return (
        '<div class="d-grid gap-2 mb-3">' +
        '<a class="btn btn-gold" href="issue-return.html?book=' + book.id + '"><i class="bi bi-box-arrow-up-right me-1"></i> Issue this book</a>' +
        '<a class="btn btn-outline-secondary" href="admin.html?tab=books&edit=' + book.id + '"><i class="bi bi-pencil me-1"></i> Edit book record</a></div>' +
        '<h3 class="h6 small text-uppercase text-muted-soft fw-bold">Currently with (' + holders.length + ")</h3>" +
        (holders.length
          ? '<ul class="list-unstyled small mb-0">' +
            holders
              .map(function (t) {
                const m = db.get("members", t.memberId);
                return "<li class='d-flex justify-content-between py-1'><span>" + esc(m ? m.name : t.memberId) + "</span>" + LIB.badge(LIB.loanState(t)) + "</li>";
              })
              .join("") +
            "</ul>"
          : '<p class="small text-muted-soft mb-0">No copies are out right now.</p>')
      );
    }

    // student / faculty
    const myLoan = LIB.openLoans(user.memberId).find((t) => t.bookId === book.id);
    if (myLoan) {
      return (
        '<div class="alert alert-success small mb-2"><i class="bi bi-check-circle me-1"></i> You have this book. Due on <strong>' +
        LIB.fmtDate(myLoan.dueDate) + "</strong>.</div>" +
        '<a href="member-dashboard.html" class="btn btn-outline-secondary w-100">View in my dashboard</a>'
      );
    }

    const myRequest = LIB.pendingRequests(user.memberId).find((r) => r.bookId === book.id);
    if (myRequest) {
      return (
        '<div class="alert alert-warning small mb-2"><i class="bi bi-hourglass-split me-1"></i> Request sent on ' +
        LIB.fmtDate(myRequest.requestedOn) + ". Collect the book from the desk once it is approved.</div>" +
        '<button class="btn btn-outline-danger w-100" id="cancelRequest" data-id="' + myRequest.id + '">Cancel request</button>'
      );
    }

    const check = LIB.canBorrow(user, book.id);
    if (!check.ok) {
      return (
        '<button class="btn btn-gold w-100" disabled>Request this book</button>' +
        '<p class="small text-muted-soft mt-2 mb-0"><i class="bi bi-info-circle me-1"></i>' + esc(check.reason) + "</p>"
      );
    }

    return (
      '<form id="requestForm">' +
      '<label for="reqNote" class="form-label small fw-semibold">Note for the librarian (optional)</label>' +
      '<input type="text" class="form-control form-control-sm mb-2" id="reqNote" maxlength="200" placeholder="e.g. needed for lab on Monday">' +
      '<button class="btn btn-gold w-100" type="submit"><i class="bi bi-bookmark-plus me-1"></i> Request this book</button>' +
      '<p class="small text-muted-soft mt-2 mb-0">Loan period: ' + LIB.loanDaysFor(user) + " days once issued. Fine: " +
      LIB.money(LIB.RULES.FINE_PER_DAY) + " per day late.</p></form>"
    );
  }

  /* ---------------- reviews ---------------- */

  function reviewList(book) {
    const reviews = (book.reviews || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    if (!reviews.length) return LIB.emptyState("No reviews yet. Be the first to review this book.", "chat-left-text");
    return reviews
      .map(function (r) {
        const initials = r.member.split(" ").map((p) => p[0]).join("").slice(0, 2);
        return (
          '<div class="review-item d-flex gap-3">' +
          '<div class="review-avatar">' + esc(initials) + "</div>" +
          '<div class="flex-grow-1"><div class="d-flex flex-wrap justify-content-between gap-2">' +
          "<strong>" + esc(r.member) + "</strong>" +
          '<span class="small text-muted-soft">' + LIB.fmtDate(r.date) + "</span></div>" +
          stars(r.rating) + '<p class="mb-0 mt-1">' + esc(r.text) + "</p></div></div>"
        );
      })
      .join("");
  }

  function reviewForm(book) {
    if (!LIB.can("books.review", user)) {
      return user ? "" : '<p class="small text-muted-soft mt-3"><a href="login.html?next=' +
        encodeURIComponent("book-details.html?id=" + book.id) + '">Log in</a> to write a review.</p>';
    }
    if ((book.reviews || []).some((r) => r.memberId === user.memberId)) {
      return '<p class="small text-muted-soft mt-3"><i class="bi bi-check2-circle me-1"></i>You have already reviewed this book.</p>';
    }
    return (
      '<form id="reviewForm" class="action-panel mt-3" novalidate>' +
      '<h3 class="h6">Write a review</h3>' +
      '<div class="row g-2"><div class="col-sm-4"><label class="form-label small fw-semibold" for="revRating">Rating</label>' +
      '<select class="form-select" id="revRating"><option value="5">5 - Excellent</option><option value="4">4 - Good</option>' +
      '<option value="3">3 - Average</option><option value="2">2 - Poor</option><option value="1">1 - Bad</option></select></div>' +
      '<div class="col-sm-8"><label class="form-label small fw-semibold" for="revText">Your review</label>' +
      '<textarea class="form-control" id="revText" rows="2" maxlength="400" placeholder="What did you think of this book?"></textarea>' +
      '<div class="invalid-feedback">Write at least 10 characters.</div></div></div>' +
      '<button type="submit" class="btn btn-navy btn-sm mt-2">Post review</button></form>'
    );
  }

  /* ---------------- page ---------------- */

  function render() {
    const book = db.get("books", bookId);
    if (!book) {
      $("bookDetail").innerHTML =
        LIB.emptyState("We could not find that book. It may have been removed from the catalogue.", "journal-x") +
        '<div class="text-center mt-3"><a href="catalogue.html" class="btn btn-navy">Back to catalogue</a></div>';
      return;
    }

    $("crumbTitle").textContent = book.title;
    document.title = book.title + " | GLA Central Library";
    const pct = book.copiesTotal ? Math.round((book.copiesAvailable / book.copiesTotal) * 100) : 0;

    $("bookDetail").innerHTML =
      '<div class="row g-4 g-lg-5">' +
      '<div class="col-sm-5 col-md-4 col-lg-3"><div class="detail-cover"><img src="' + esc(book.cover) + '" alt="Cover of ' + esc(book.title) + '"></div></div>' +
      '<div class="col-sm-7 col-md-8 col-lg-6">' +
      '<p class="card-category mb-1">' + esc(book.category) + " &middot; " + esc(book.subject) + "</p>" +
      '<h1 class="h2 mb-1">' + esc(book.title) + "</h1>" +
      '<p class="text-muted-soft mb-2">by ' + esc(book.author) + "</p>" +
      '<div class="d-flex flex-wrap align-items-center gap-2 mb-3">' + stars(book.rating) +
      '<span class="rating">' + Number(book.rating).toFixed(1) + '</span><span class="small text-muted-soft">(' + book.reviewCount + " reviews)</span></div>" +
      '<div class="mb-3" style="max-width:360px"><div class="d-flex justify-content-between small mb-1"><span class="fw-semibold">' +
      (book.copiesAvailable > 0 ? book.copiesAvailable + " of " + book.copiesTotal + " copies available" : "All " + book.copiesTotal + " copies are issued") +
      '</span><span class="text-muted-soft">' + esc(book.shelf) + "</span></div>" +
      '<div class="copies-bar"><span style="width:' + pct + '%"></span></div></div>' +
      '<div class="mb-3">' + (book.tags || []).map((t) => '<span class="chip me-1">' + esc(t) + "</span>").join("") + "</div>" +

      '<ul class="nav nav-tabs mt-4" role="tablist">' +
      '<li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabOverview" type="button" role="tab">Overview</button></li>' +
      '<li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabDetails" type="button" role="tab">Details</button></li>' +
      '<li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabReviews" type="button" role="tab">Reviews (' + (book.reviews || []).length + ")</button></li></ul>" +
      '<div class="tab-content pt-3">' +
      '<div class="tab-pane fade show active" id="tabOverview" role="tabpanel"><p class="mb-0">' + esc(book.description) + "</p></div>" +
      '<div class="tab-pane fade" id="tabDetails" role="tabpanel"><div class="meta-grid">' +
      [["ISBN", book.isbn], ["Publisher", book.publisher], ["Edition", book.edition], ["Pages", book.pages], ["Language", book.language], ["Shelf", book.shelf], ["Book ID", book.id], ["Added on", LIB.fmtDate(book.addedOn)]]
        .map((p) => "<div><span>" + p[0] + "</span><strong>" + esc(p[1]) + "</strong></div>")
        .join("") +
      "</div></div>" +
      '<div class="tab-pane fade" id="tabReviews" role="tabpanel">' + reviewList(book) + reviewForm(book) + "</div>" +
      "</div></div>" +

      '<div class="col-lg-3"><div class="action-panel"><h2 class="h6 mb-3"><i class="bi bi-lightning-charge text-warning me-1"></i>Borrow</h2>' +
      actionPanel(book) + "</div></div></div>";

    bindActions(book);
    renderSimilar(book);
  }

  function bindActions(book) {
    const requestForm = $("requestForm");
    if (requestForm) {
      requestForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const result = LIB.requestBook(user, book.id, $("reqNote").value.trim());
        if (!result.ok) return LIB.toast(result.reason, "danger");
        LIB.toast("Request sent. The librarian will approve it at the desk.");
        render();
      });
    }

    const cancelBtn = $("cancelRequest");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async function () {
        const ok = await LIB.confirmDialog({ title: "Cancel this request?", message: "Your place for this book will be released.", confirmText: "Cancel request", danger: true });
        if (!ok) return;
        LIB.closeRequest(cancelBtn.dataset.id, "cancelled");
        LIB.toast("Request cancelled.", "info");
        render();
      });
    }

    const reviewFormEl = $("reviewForm");
    if (reviewFormEl) {
      reviewFormEl.addEventListener("submit", function (e) {
        e.preventDefault();
        const text = $("revText").value.trim();
        $("revText").classList.toggle("is-invalid", text.length < 10);
        if (text.length < 10) return;

        const rating = Number($("revRating").value);
        const reviews = (book.reviews || []).concat({ memberId: user.memberId, member: user.name, rating: rating, date: LIB.today(), text: text });
        const count = book.reviewCount + 1;
        const newRating = Math.round(((book.rating * book.reviewCount + rating) / count) * 10) / 10;
        db.update("books", book.id, { reviews: reviews, reviewCount: count, rating: newRating });
        LIB.toast("Thanks! Your review is posted.");
        render();
        bootstrap.Tab.getOrCreateInstance(document.querySelector('[data-bs-target="#tabReviews"]')).show();
      });
    }
  }

  function renderSimilar(book) {
    const similar = db
      .where("books", (b) => b.id !== book.id && b.category === book.category)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 4);
    $("similarWrap").hidden = similar.length === 0;
    $("similarBooks").innerHTML = similar.map((b) => LIB.bookCard(b)).join("");
    $("similarMore").href = "catalogue.html?category=" + encodeURIComponent(book.category);
  }

  render();
});
