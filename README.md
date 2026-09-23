# Library and Digital Resource Management System

Mini project for GLA University (B.Tech CSE, 3rd year). Front-end built with
HTML, CSS, Bootstrap 5 and plain JavaScript. All the data comes from JSON files
in `data/`, which act as a dummy database until a real backend is added.

## Running it

The pages read `data/*.json` with `fetch()`, and browsers block that on
`file://` URLs. So **do not just double click index.html** - serve the folder:

```
python3 -m http.server 5500
```

then open <http://localhost:5500>. In VS Code the Live Server extension
(right click `index.html` > "Open with Live Server") does the same thing.

Bootstrap and Bootstrap Icons load from a CDN, so you need internet the first
time you open it.

## Demo logins

| Email | Password | Type |
|---|---|---|
| suryansh@gla.ac.in | library@642 | Student |
| tanishq@gla.ac.in | library@659 | Student |
| tanishka@gla.ac.in | library@654 | Student |
| sonu@gla.ac.in | library@590 | Student |
| rk.agarwal@gla.ac.in | faculty@118 | Faculty (10 book limit) |

Signing up creates a member in `localStorage` instead, because a static site
cannot write back into `members.json`.

> These passwords sit in a plain JSON file that anyone can open. That is fine
> for a Phase 1 demo but it is not real authentication - hashed passwords and
> server side sessions come with the backend phase.

## Pages

- `index.html` - home, hero, quick search, newest books and popular resources
- `login.html` / `signup.html` - member login and registration with validation
- `catalogue.html` - search, category/availability/language filters, sort, pagination
- `book-details.html` - single book via `?id=BK001`, tabs, reviews, similar books
- `digital-resources.html` - e-books, papers and journals with type tabs
- `member-dashboard.html` - profile, stats, issued books, history (login required)
- `issue-return.html` - issue and return flow with automatic due dates and fines

## Structure

```
library-management-system/
├── index.html, login.html, signup.html, catalogue.html,
│   book-details.html, digital-resources.html,
│   member-dashboard.html, issue-return.html
├── css/
│   └── style.css          custom layer on top of Bootstrap
├── js/
│   ├── main.js            shared: data loading, session, nav, animations, cards
│   ├── home.js            index page
│   ├── auth.js            login + signup
│   ├── catalogue.js       filters, search, sort, pagination
│   ├── book-details.js    single book page
│   ├── resources.js       digital resources page
│   ├── dashboard.js       member dashboard
│   └── issue-return.js    issue / return flow
├── data/
│   ├── books.json         12 books with covers, copies, reviews
│   ├── resources.json     12 digital resources
│   ├── members.json       5 members
│   └── transactions.json  issue / return history
└── img/
    ├── covers/            book cover images (svg)
    ├── icons/             ui and file type icons (svg)
    └── logo, avatar, hero and auth illustrations
```

## How the data layer works

`LIB.load("books")` fetches and caches `data/books.json`. Pages join the files
by id - a transaction points at a `memberId` and a `bookId`, and the dashboard
stitches all three together.

Anything the user changes (issuing, returning, signing up) is stored in
`localStorage` on top of the JSON, since the files are read only in the browser.
The "Reset demo data" button on the issue/return page clears that.

Rules used across the app: 14 day loan period, 5 book limit for students, 10 for
faculty, and a fine of Rs 10 per day once a book is overdue.

## Who did what

- **Suryansh (2415001642)** - repo setup, Bootstrap base, `css/style.css`,
  `js/main.js`, all JSON data files, home page, login and signup
- **Tanishq (2415001659)** - catalogue, book details and digital resources pages
  plus their JS
- **Tanishka (2415001654)** - member dashboard and `js/dashboard.js`
- **Sonu (2415001590)** - issue / return page, `js/issue-return.js`, responsive
  checks on mobile and tablet

Branching follows the team guide: `feature/*` -> PR -> `dev` -> PR -> `main`.

## Next phases

- Convert the pages to React components (navbar and footer become shared)
- Move the JSON layer behind a real API
- Proper authentication with hashed passwords
- Librarian/admin side for adding books and managing members
