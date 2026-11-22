# Library and Digital Resource Management System

Mini project for GLA University (B.Tech CSE, 3rd year). A web portal for the
university's central library: a searchable book catalogue, digital resources,
online book requests, issue and return with automatic fines, member dashboards
and a librarian desk. It has **role based access control** for students,
faculty and librarians.

Front end only: HTML, CSS, Bootstrap 5 and plain JavaScript. The JSON files in
`data/` act as the database.

## Running it

The pages read `data/*.json` with `fetch()`, which browsers block on `file://`
URLs, so **do not double click index.html**. Serve the folder instead:

```
python3 -m http.server 5500
```

then open <http://localhost:5500>. In VS Code, right click `index.html` and
choose **Open with Live Server**. Bootstrap and its icons load from a CDN, so
you need internet the first time.

## Demo accounts

| Role | Email | Password | What they can do |
|---|---|---|---|
| Student | suryansh@gla.ac.in | library@642 | request books, renew, review, save e-resources, dashboard |
| Student | tanishq@gla.ac.in | library@659 | same as above |
| Student | tanishka@gla.ac.in | library@654 | same as above |
| Student | sonu@gla.ac.in | library@590 | same as above |
| Faculty | rk.agarwal@gla.ac.in | faculty@118 | 10 book limit, 30 day loans |
| Librarian | librarian@gla.ac.in | admin@123 | issue/return, approve requests, manage books, members, resources and data |

The login page has a **Use** button next to each demo account.

## Features

- **Catalogue**: search across title, author, ISBN and tags. Filter by category, availability and language, sort five ways, paginate. Filters are kept in the URL.
- **Book details**: live copy count, tabs for overview, details and reviews, members can post reviews, and similar books are suggested.
- **Borrowing flow**: a member requests a book, the librarian approves it, the book is issued with an automatic due date, and it is returned with an automatic fine.
- **Member dashboard**: stats, overdue alert, renew once (+7 days), request tracking, history with paid/unpaid fines, saved e-resources and change password.
- **Digital resources**: type tabs, search, sort, an open-access switch, view counting, and save to your account. "Members only" items need a login.
- **Issue / Return desk**: 4-step flow with limit checks, return with a fine preview, fine collection, request approval and a searchable transaction log.
- **Librarian Desk**: KPIs, an overdue list, add/edit/delete for books and resources, add/edit/suspend for members, JSON export and a permission matrix.
- **Responsive design**: tested at 360, 390, 768 and 1366 px wide (see `docs/TESTING.md`).

## Role based access control

All permissions live in one place, `LIB.PERMISSIONS` in `js/main.js`. Each page
declares which roles may open it:

```js
LIB.page({ roles: ["librarian"] }, function (ctx) { ... });
```

- A guest who opens a protected page is sent to `login.html?next=...` and comes back after logging in.
- A logged in user with the wrong role gets an **Access restricted** screen.
- The navbar only shows the links that role is allowed to use.
- Buttons check `LIB.can("books.request")` and similar permissions before showing.
- A suspended member is logged out right away and cannot log in.

> This is a front end project, so RBAC is enforced in the browser. That is
> enough for a demo, but a real deployment needs the same checks on a server
> (see `ROADMAP.md`).

## How the JSON database works

`data/books.json`, `members.json`, `resources.json`, `transactions.json` and
`requests.json` are the seed data. On the first visit `js/main.js` loads all
five files and keeps them in `localStorage` as one database. Every issue,
return, request, review, sign up and edit goes through `LIB.db`, which has
`get`, `where`, `insert`, `update`, `remove` and `nextId`, so changes survive
refreshes.

- **Reset demo data** (desk or Librarian Desk > JSON Data) reloads the original files.
- **Export** downloads the current state of any collection as a `.json` file. Copy it into `data/` to make it the new seed.
- Passwords are stored as salted SHA-256 hashes (`passwordHash`), never as plain text.

Library rules: students can hold 5 books for 14 days, faculty 10 books for 30
days. The fine is Rs 10 per day late. Each loan can be renewed once for 7 days.

## Structure

```
library-management-system/
├── index.html               home
├── login.html, signup.html  authentication
├── catalogue.html           book catalogue
├── book-details.html        single book (?id=BK001)
├── digital-resources.html   e-books, papers, journals
├── member-dashboard.html    student / faculty dashboard
├── issue-return.html        librarian: issue, return, requests
├── admin.html               librarian: manage books, members, resources, data
├── css/
│   ├── style.css            design system (colours, components)
│   └── responsive.css       mobile and tablet layer
├── js/
│   ├── main.js              core: JSON DB, auth, RBAC, loan rules, navbar, helpers
│   ├── home.js  auth.js  catalogue.js
│   ├── book-details.js  resources.js
│   ├── dashboard.js
│   └── issue-return.js  admin.js
├── data/                    JSON database (seed)
├── docs/TESTING.md          responsive + functional test checklist
├── ROADMAP.md               future phases
└── img/                     covers, icons, illustrations (svg)
```

## Team

| Member | Roll no. | Contribution |
|---|---|---|
| **Suryansh Saxena** | 2415001642 | Architecture (`js/main.js`: JSON DB, auth, RBAC, shared layout), `css/style.css` design system, JSON data, Home, Login/Sign up, Catalogue |
| **Tanishq Rastogi** | 2415001659 | Book Details page (`book-details.js`) and Digital Resources page (`resources.js`) |
| **Tanishka Chaudhary** | 2415001654 | Member Dashboard (`member-dashboard.html`, `dashboard.js`) |
| **Sonu Raj** | 2415001590 | Issue/Return desk, Librarian Desk (`issue-return.js`, `admin.js`), `css/responsive.css`, responsive testing, `ROADMAP.md` |

Branching: `feature/*` -> pull request -> `main`.
