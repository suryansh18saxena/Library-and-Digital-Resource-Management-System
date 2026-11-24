# Roadmap

Owner: Sonu Raj

Phase 1 (this submission) is a complete front end. Every feature works
end to end on top of a JSON database kept in the browser. The phases below
turn it into a production system.

## Phase 2 - Real backend (next semester)

- **Node.js + Express REST API** that reads and writes the same JSON shapes
  (`/api/books`, `/api/members`, `/api/transactions`, `/api/requests`).
  `LIB.db` in `js/main.js` is the only file that has to change, because every
  page already goes through it.
- **Move from JSON to a database**: MongoDB (the documents map 1:1) or
  PostgreSQL with tables for books, members, loans and requests.
- **Server side RBAC**: the same `PERMISSIONS` table enforced as API middleware,
  so the browser checks become a convenience rather than the security boundary.
- **Real authentication**: bcrypt password hashing, JWT or session cookies,
  password reset by email.

## Phase 3 - Better experience

- Convert the pages to **React** components. The navbar and footer are already
  shared through `main.js`, so they become the first components.
- **Email / SMS reminders** two days before a due date and on overdue.
- **Online fine payment** through a payment gateway (UPI).
- **Reservations queue**: join a waitlist when all copies are issued, and get
  notified when one is returned.
- **Barcode / QR scanning** at the desk to issue and return books faster.

## Phase 4 - Library analytics

- Charts for monthly circulation, the most borrowed subjects and fine collection.
- Recommendations based on borrowing history ("students who borrowed X also
  borrowed Y").
- Integration with the university ERP for student and faculty records.
- Hosting on a university server or cloud (Render, Railway, AWS) with HTTPS.
