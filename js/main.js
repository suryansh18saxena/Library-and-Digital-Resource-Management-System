const navAuth = document.getElementById("navAuth");

if (navAuth) {
  navAuth.innerHTML =
    '<a href="login.html" class="btn btn-outline-light-thin btn-sm">Login</a>' +
    '<a href="signup.html" class="btn btn-gold btn-sm">Sign Up</a>';
}

const currentPage = location.pathname.split("/").pop() || "index.html";

document.querySelectorAll(".site-nav .nav-link").forEach(function (link) {
  if (link.getAttribute("href") === currentPage || link.dataset.match === currentPage) {
    link.classList.add("active");
  }
});

function showError(box) {
  if (!box) return;
  box.innerHTML =
    '<div class="col-12"><div class="data-error">' +
    "Could not load the data files. Open the project through a local server " +
    "(VS Code Live Server, or <code>python3 -m http.server 5500</code>) instead of " +
    "double clicking the HTML file." +
    "</div></div>";
}
