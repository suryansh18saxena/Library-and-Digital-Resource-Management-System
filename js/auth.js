/* Login and sign up (login.html, signup.html)
 * Owner: Suryansh Saxena
 * Client side validation, hashed password check, session start and
 * role based redirect after login.
 */

LIB.page({ guestOnly: true }, function (ctx) {
  const db = ctx.db;
  const $ = LIB.$;

  function setError(input, errBox, message) {
    input.classList.toggle("is-invalid", !!message);
    errBox.textContent = message || "";
    return !message;
  }

  function showAlert(box, type, html) {
    box.innerHTML = '<div class="alert alert-' + type + ' py-2 small" role="alert">' + html + "</div>";
  }

  // only allow redirects to a page of this site (no "https://evil.com")
  function safeNext() {
    const next = LIB.param("next");
    return next && /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(next) ? next : null;
  }

  /* ------------------------------ login ------------------------------ */

  const loginForm = $("loginForm");
  if (loginForm) {
    const email = $("email");
    const password = $("password");
    const alertBox = $("loginAlert");

    if (LIB.param("next")) {
      showAlert(alertBox, "info", '<i class="bi bi-lock me-1"></i> Please log in to continue.');
    }

    $("togglePw").addEventListener("click", function () {
      const show = password.type === "password";
      password.type = show ? "text" : "password";
      this.innerHTML = show ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
      this.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });

    $("forgotBtn").addEventListener("click", function () {
      showAlert(
        alertBox,
        "info",
        "Passwords are reset at the library desk. Visit the Central Library with your ID card, or email <strong>library@gla.ac.in</strong>."
      );
    });

    document.querySelectorAll("[data-demo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const parts = btn.dataset.demo.split("|");
        email.value = parts[0];
        password.value = parts[1];
        setError(email, $("emailErr"), "");
        setError(password, $("passwordErr"), "");
        password.focus();
      });
    });

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      alertBox.innerHTML = "";

      const okEmail = setError(
        email,
        $("emailErr"),
        !email.value.trim() ? "Enter your email address." : !/^\S+@\S+\.\S+$/.test(email.value.trim()) ? "That does not look like an email address." : ""
      );
      const okPw = setError(password, $("passwordErr"), password.value ? "" : "Enter your password.");
      if (!okEmail || !okPw) return;

      const result = LIB.login(email.value, password.value, $("remember").checked);
      if (!result.ok) {
        showAlert(alertBox, "danger", '<i class="bi bi-x-circle me-1"></i> ' + LIB.esc(result.error));
        password.value = "";
        password.focus();
        return;
      }

      $("loginBtn").disabled = true;
      $("loginBtn").textContent = "Logging in...";
      location.href = safeNext() || LIB.homeFor(result.user);
    });
  }

  /* ------------------------------ sign up ------------------------------ */

  const signupForm = $("signupForm");
  if (signupForm) {
    const f = {
      name: $("fullName"),
      roll: $("rollNo"),
      email: $("email"),
      password: $("password"),
      confirm: $("confirm"),
      terms: $("terms"),
    };

    // simple strength meter: length, digit, letter, symbol
    f.password.addEventListener("input", function () {
      const v = f.password.value;
      let score = 0;
      if (v.length >= 6) score++;
      if (v.length >= 10) score++;
      if (/\d/.test(v) && /[a-z]/i.test(v)) score++;
      if (/[^a-z0-9]/i.test(v)) score++;
      const colors = ["#c0392b", "#c0392b", "#c9932f", "#2e8b57", "#2e8b57"];
      $("pwMeter").style.width = (v ? Math.max(1, score) * 25 : 0) + "%";
      $("pwMeter").style.backgroundColor = colors[score];
    });

    f.roll.addEventListener("input", function () {
      f.roll.value = f.roll.value.replace(/\D/g, "");
    });

    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = f.name.value.trim().replace(/\s+/g, " ");
      const roll = f.roll.value.trim();
      const email = f.email.value.trim().toLowerCase();
      const pw = f.password.value;

      const checks = [
        setError(f.name, $("fullNameErr"),
          name.length < 3 ? "Enter your full name." : !/^[a-z .'-]+$/i.test(name) ? "Use letters and spaces only." : ""),
        setError(f.roll, $("rollNoErr"),
          !/^\d{10}$/.test(roll) ? "Roll number must be exactly 10 digits." : db.get("members", roll) ? "This roll number is already registered." : ""),
        setError(f.email, $("emailErr"),
          !/^[a-z0-9._%+-]+@gla\.ac\.in$/.test(email) ? "Use your university email (name@gla.ac.in)." : LIB.findByEmail(email) ? "An account with this email already exists." : ""),
        setError(f.password, $("passwordErr"),
          pw.length < 6 ? "Password must be at least 6 characters." : !(/\d/.test(pw) && /[a-z]/i.test(pw)) ? "Use at least one letter and one number." : ""),
        setError(f.confirm, $("confirmErr"), f.confirm.value !== pw || !pw ? "Passwords do not match." : ""),
        setError(f.terms, $("termsErr"), f.terms.checked ? "" : "Please accept the library rules."),
      ];
      if (checks.includes(false)) {
        const firstBad = signupForm.querySelector(".is-invalid");
        if (firstBad) firstBad.focus();
        return;
      }

      const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
      const member = {
        memberId: roll,
        name: name,
        email: email,
        passwordHash: LIB.hashPassword(email, pw),
        role: "student",
        course: $("course").value,
        year: $("year").value,
        joined: LIB.today(),
        bookLimit: 5,
        initials: initials,
        status: "active",
        savedResources: [],
      };
      db.insert("members", member);
      LIB.startSession(member, true);
      location.href = "member-dashboard.html?welcome=1";
    });
  }
});
