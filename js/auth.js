/* login + signup form handling
 *
 * NOTE: this is a front-end simulation for Phase 1. There is no server, so
 * credentials are compared against data/members.json in the browser and the
 * "session" is just a localStorage key. Anyone can read that file, so never put
 * a real password in it. Actual authentication (hashed passwords, server-side
 * sessions) is a backend phase job.
 */

function setFieldError(id, message) {
  const box = document.getElementById(id + "Err");
  const input = document.getElementById(id);
  if (box) box.textContent = message || "";
  if (input) input.classList.toggle("is-invalid", Boolean(message));
  return !message;
}

function showAlert(slotId, message, variant) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  slot.innerHTML =
    '<div class="alert alert-' + variant + ' py-2 small d-flex align-items-center gap-2" role="alert">' +
    '<i class="bi bi-' + (variant === "danger" ? "exclamation-triangle" : "check-circle") + '"></i>' +
    '<span>' + LIB.escapeHtml(message) + "</span></div>";
}

/* ---------- login ---------- */

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  const toggle = document.getElementById("togglePw");
  toggle.addEventListener("click", function () {
    const pw = document.getElementById("password");
    const showing = pw.type === "text";
    pw.type = showing ? "password" : "text";
    toggle.innerHTML = '<i class="bi bi-eye' + (showing ? "" : "-slash") + '"></i>';
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    let ok = setFieldError("email", email ? "" : "Enter your email address.");
    ok = setFieldError("password", password ? "" : "Enter your password.") && ok;
    if (!ok) return;

    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Checking...';

    try {
      const members = await LIB.allMembers();
      const match = members.find(
        (m) => m.email.toLowerCase() === email && m.password === password
      );

      if (!match) {
        showAlert("loginAlert", "Email or password is incorrect. Try the demo login shown above.", "danger");
        btn.disabled = false;
        btn.textContent = "Log in";
        return;
      }

      const { password: _pw, ...safe } = match;
      LIB.session.set(safe);
      showAlert("loginAlert", "Logged in. Taking you to your dashboard...", "success");

      const next = LIB.param("next") || "member-dashboard.html";
      setTimeout(() => (location.href = next), 700);
    } catch (err) {
      showAlert("loginAlert", "Could not read the member list. Run the project through a local server, not file://.", "danger");
      btn.disabled = false;
      btn.textContent = "Log in";
    }
  });
}

/* ---------- signup ---------- */

const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("fullName").value.trim();
    const roll = document.getElementById("rollNo").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;
    const agreed = document.getElementById("terms").checked;

    let ok = setFieldError("fullName", name.length >= 3 ? "" : "Enter your full name.");
    ok = setFieldError("rollNo", /^\d{10}$/.test(roll) ? "" : "Roll number must be 10 digits.") && ok;
    ok = setFieldError("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Enter a valid email address.") && ok;
    ok = setFieldError("password", password.length >= 6 ? "" : "Password must be at least 6 characters.") && ok;
    ok = setFieldError("confirm", password === confirm ? "" : "Passwords do not match.") && ok;
    ok = setFieldError("terms", agreed ? "" : "Please accept the library rules.") && ok;
    if (!ok) return;

    try {
      const members = await LIB.allMembers();
      if (members.some((m) => m.email.toLowerCase() === email)) {
        setFieldError("email", "An account with this email already exists.");
        return;
      }
      if (members.some((m) => m.memberId === roll)) {
        setFieldError("rollNo", "This roll number is already registered.");
        return;
      }
    } catch (err) {
      showAlert("signupAlert", "Could not read the member list. Run the project through a local server, not file://.", "danger");
      return;
    }

    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

    const member = {
      memberId: roll,
      name: name,
      email: email,
      password: password,
      course: document.getElementById("course").value,
      year: document.getElementById("year").value,
      membership: "Student",
      joined: LIB.today(),
      bookLimit: 5,
      initials: initials,
      status: "active",
      savedResources: [],
    };

    LIB.addSignup(member);

    const { password: _pw, ...safe } = member;
    LIB.session.set(safe);

    showAlert("signupAlert", "Account created. Setting up your dashboard...", "success");
    signupForm.querySelector('button[type="submit"]').disabled = true;
    setTimeout(() => (location.href = "member-dashboard.html"), 900);
  });
}
