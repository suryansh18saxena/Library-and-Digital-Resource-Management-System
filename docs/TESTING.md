# Testing checklist

Owner: Sonu Raj. Run every check with **Reset demo data** first, so the data
starts from the JSON seed.

## Responsive checks

| Width | Device | Pages checked | Result |
|---|---|---|---|
| 360 px | Android phone | all 9 pages | pass - no sideways scrolling; tables scroll inside their card |
| 390 px | iPhone 12-15 | all 9 pages | pass - navbar collapses, the user menu goes full width |
| 768 px | iPad portrait | all 9 pages | pass - filters fold into a "Show filters" button, tabs scroll |
| 1366 px | laptop | all 9 pages | pass |

Fixes these checks led to (in `css/responsive.css`):

- The tabs on the Librarian Desk wrapped into two rows on phones. They now scroll sideways.
- The resource type pills wrapped into three rows. They now sit in one row that scrolls.
- The hero stat tiles overflowed at 360 px, so the font and padding are smaller.
- The step bar labels crowded each other, so the labels are smaller.
- Toasts were off screen on phones. They now span the full width.
- Pages print without the navbar, footer and buttons (useful for desk reports).

## Functional checks

**Guest**
- [ ] Home shows 4 newest books, 3 popular resources, and the counters animate
- [ ] Catalogue: 8 per page, filters and sort work, `?category=Mathematics` works
- [ ] Book page asks the guest to log in to request
- [ ] Opening `member-dashboard.html` or `admin.html` redirects to login

**Student (suryansh@gla.ac.in)**
- [ ] Wrong password shows an error, the right one opens the dashboard
- [ ] Dashboard shows 3 loans, 1 overdue with a running fine, history and saved resources
- [ ] Renew works once per loan and is blocked on overdue books
- [ ] Request a book from its page; it appears under My Book Requests and can be cancelled
- [ ] Post a review; the rating updates
- [ ] Save / unsave a digital resource
- [ ] `issue-return.html` shows "Access restricted"
- [ ] Change password, log out, log in with the new password

**Librarian (librarian@gla.ac.in)**
- [ ] Approve a pending request; copies go down by 1
- [ ] Issue to a faculty member gives a 30 day due date; issuing the same book twice is blocked
- [ ] Return an overdue book: the fine is shown; untick "collected", then later use "Mark paid"
- [ ] Add, edit and delete a book (deleting a book that is on loan is blocked; a duplicate ISBN is blocked)
- [ ] Add a member, suspend a member (they can no longer log in), then activate them again
- [ ] Add a digital resource, export a JSON collection, reset demo data

**Sign up**
- [ ] An empty form shows all 6 errors; a duplicate roll number or email is rejected
- [ ] A valid sign up logs straight into the dashboard
