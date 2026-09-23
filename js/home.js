/* home page - pulls the newest books and most viewed resources out of the json files */

document.addEventListener("DOMContentLoaded", async function () {
  const booksSlot = document.getElementById("latestBooks");
  const resSlot = document.getElementById("topResources");

  try {
    const books = await LIB.load("books");
    const newest = books
      .slice()
      .sort((a, b) => b.addedOn.localeCompare(a.addedOn))
      .slice(0, 4);
    booksSlot.innerHTML = newest.map((b) => LIB.bookCard(b)).join("");
  } catch (err) {
    LIB.showLoadError(booksSlot, err);
    return;
  }

  try {
    const resources = await LIB.load("resources");
    const popular = resources
      .slice()
      .sort((a, b) => b.views - a.views)
      .slice(0, 3);
    resSlot.innerHTML = popular.map((r) => LIB.resourceCard(r)).join("");
  } catch (err) {
    LIB.showLoadError(resSlot, err);
  }

  LIB.initReveal();
});
