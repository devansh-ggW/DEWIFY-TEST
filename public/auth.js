(() => {
  "use strict";

  // Replace this after the Cloudflare Worker is deployed.
  const API = String(
    window.DEWIFY_AUTH_API || ""
  ).replace(/\/$/, "");

  const state = {
    authenticated: false,
    email: "",
    mode: "login"
  };

  function api(path, options = {}) {
    return fetch(API + path, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  }

  function setAuthMode(mode) {
    state.mode = mode === "signup" ? "signup" : "login";

    const title = document.getElementById("authTitle");
    const copy = document.getElementById("authCopy");
    const submit = document.getElementById("authSubmit");
    const loginTab = document.getElementById("authLoginTab");
    const signupTab = document.getElementById("authSignupTab");

    if (!title || !copy || !submit || !loginTab || !signupTab) return;

    const signup = state.mode === "signup";
    title.textContent = signup ? "Create your account." : "Welcome back.";
    copy.textContent = signup
      ? "Enter your email and we’ll send a secure sign-in link."
      : "Enter your email and we’ll send a secure login link.";
    submit.textContent = signup
      ? "CREATE ACCOUNT ↗"
      : "SEND LOGIN LINK ↗";

    loginTab.classList.toggle("active", !signup);
    signupTab.classList.toggle("active", signup);
    loginTab.setAttribute("aria-pressed", String(!signup));
    signupTab.setAttribute("aria-pressed", String(signup));

    const message = document.getElementById("authMessage");
    if (message) {
      message.className = "auth-message";
      message.textContent = "";
    }
  }

  function openAuth(mode = "login") {
    const modal = document.getElementById("authModal");
    if (!modal) return;

    setAuthMode(mode);

    const input = document.getElementById("authEmail");
    modal.hidden = false;
    setTimeout(() => input?.focus(), 0);
  }

  function closeAuth() {
    const modal = document.getElementById("authModal");
    if (modal) modal.hidden = true;
  }

  function injectUi() {
    if (document.getElementById("authSlot")) return;

    const nav = document.querySelector(".nav");
    if (!nav) return;

    const slot = document.createElement("div");
    slot.id = "authSlot";
    slot.className = "auth-slot";
    slot.innerHTML = `
      <div class="auth-actions">
        <button id="loginButton" class="auth-button" type="button">LOGIN</button>
        <button id="signupButton" class="auth-button auth-button-primary" type="button">SIGN UP</button>
      </div>

      <div id="authModal" class="auth-modal" hidden>
        <div class="auth-backdrop" data-auth-close></div>

        <section class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
          <button class="auth-close" type="button" data-auth-close aria-label="Close">×</button>

          <p class="eyebrow">DEWIFY / ACCOUNT</p>

          <div class="auth-tabs" role="group" aria-label="Account mode">
            <button id="authLoginTab" class="auth-tab active" type="button" aria-pressed="true">LOGIN</button>
            <button id="authSignupTab" class="auth-tab" type="button" aria-pressed="false">SIGN UP</button>
          </div>

          <h2 id="authTitle">Welcome back.</h2>
          <p id="authCopy" class="auth-copy">Enter your email and we’ll send a secure login link.</p>

          <form id="authForm">
            <label>
              <span>Email</span>
              <input
                id="authEmail"
                type="email"
                maxlength="254"
                autocomplete="email"
                placeholder="you@example.com"
                required
              >
            </label>

            <button id="authSubmit" class="auth-submit" type="submit">
              SEND LOGIN LINK ↗
            </button>
          </form>

          <p id="authMessage" class="auth-message" role="status" aria-live="polite"></p>
        </section>
      </div>
    `;

    nav.appendChild(slot);

    document.getElementById("loginButton").addEventListener("click", () => {
      if (state.authenticated) {
        window.location.href = "account.html";
        return;
      }
      openAuth("login");
    });

    document.getElementById("signupButton").addEventListener("click", () => {
      if (state.authenticated) {
        window.location.href = "account.html";
        return;
      }
      openAuth("signup");
    });

    document.getElementById("authLoginTab").addEventListener("click", () => {
      setAuthMode("login");
    });

    document.getElementById("authSignupTab").addEventListener("click", () => {
      setAuthMode("signup");
    });

    slot.querySelectorAll("[data-auth-close]").forEach((el) => {
      el.addEventListener("click", closeAuth);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAuth();
    });

    document.getElementById("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      const input = document.getElementById("authEmail");
      const submit = document.getElementById("authSubmit");
      const message = document.getElementById("authMessage");
      const email = input.value.trim();

      submit.disabled = true;
      message.className = "auth-message";
      message.textContent = "Sending…";

      try {
        const response = await api("/api/auth/request", {
          method: "POST",
          body: JSON.stringify({
            email,
            mode: state.mode
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Could not send the email.");
        }

        message.className = "auth-message success";
        message.textContent =
          state.mode === "signup"
            ? "Check your inbox. Your account link expires in 10 minutes."
            : "Check your inbox. Your login link expires in 10 minutes.";
      } catch (error) {
        message.className = "auth-message error";
        message.textContent =
          error.message || "Something went wrong. Please try again.";
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function loadSession() {
    if (API.includes("YOUR-WORKER")) return;

    try {
      const response = await api("/api/auth/me");
      if (!response.ok) return;

      const data = await response.json();
      state.authenticated = Boolean(data.authenticated);
      state.email = data.email || "";
    } catch {
      state.authenticated = false;
      state.email = "";
    }

    const loginButton = document.getElementById("loginButton");
    const signupButton = document.getElementById("signupButton");

    if (loginButton && signupButton) {
      if (state.authenticated) {
        loginButton.textContent = "ACCOUNT ↗";
        signupButton.textContent = "ACCOUNT ↗";
        loginButton.title = state.email;
        signupButton.title = state.email;
      } else {
        loginButton.textContent = "LOGIN";
        signupButton.textContent = "SIGN UP";
        loginButton.title = "";
        signupButton.title = "";
      }
    }
  }

  function handleLoginResult() {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("login");
    if (!reason) return;

    const messageMap = {
      expired: "That login link expired. Request a new one.",
      used: "That login link was already used. Request a new one.",
      invalid: "That login link is invalid. Request a new one."
    };

    const message = messageMap[reason];
    if (!message) return;

    const target = new URL(window.location.href);
    target.searchParams.delete("login");
    history.replaceState({}, "", target.toString());

    const status = document.getElementById("accountStatus");
    if (status) status.textContent = message;
  }

  async function loadAccountPage() {
    if (document.body.dataset.page !== "account") return;

    const status = document.getElementById("accountStatus");
    const email = document.getElementById("accountEmail");
    const logout = document.getElementById("logoutButton");

    handleLoginResult();

    if (API.includes("YOUR-WORKER")) {
      status.textContent = "Set DEWIFY_AUTH_API in auth.js after deploying the Worker.";
      return;
    }

    try {
      const response = await api("/api/auth/me");
      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        if (!status.textContent || status.textContent === "Checking session…") {
          status.textContent = "Not signed in.";
        }
        email.textContent = "";
        logout.hidden = true;
        return;
      }

      status.textContent = "SIGNED IN";
      email.textContent = data.email;
      logout.hidden = false;
    } catch {
      status.textContent = "Could not reach the auth service.";
    }

    logout.addEventListener("click", async () => {
      logout.disabled = true;
      await api("/api/auth/logout", { method: "POST" }).catch(() => {});
      window.location.href = "./";
    });
  }

  function init() {
    injectUi();
    loadSession();
    loadAccountPage();
  }

  window.DEWIFY_AUTH = {
    api,
    state,
    open: openAuth,
    close: closeAuth
  };

  init();
})();
