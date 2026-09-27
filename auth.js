(() => {
  "use strict";

  // Set this to the URL of the Cloudflare Worker after deployment.
  const API = String(window.DEWIFY_AUTH_API || "https://YOUR-WORKER.workers.dev").replace(/\/$/, "");

  const state = { authenticated: false, email: "" };

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

  function injectUi() {
    if (document.getElementById("authSlot")) return;

    const nav = document.querySelector(".nav");
    if (!nav) return;

    const slot = document.createElement("div");
    slot.id = "authSlot";
    slot.className = "auth-slot";
    slot.innerHTML = `
      <button id="authButton" class="auth-button" type="button">LOGIN</button>
      <div id="authModal" class="auth-modal" hidden>
        <div class="auth-backdrop" data-auth-close></div>
        <section class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
          <button class="auth-close" type="button" data-auth-close aria-label="Close">×</button>
          <p class="eyebrow">DEWIFY / ACCOUNT</p>
          <h2 id="authTitle">Sign in with email.</h2>
          <p class="auth-copy">No password. We’ll email a secure sign-in link.</p>

          <form id="authForm">
            <label>
              <span>Email</span>
              <input id="authEmail" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com" required>
            </label>
            <button id="authSubmit" class="auth-submit" type="submit">SEND SIGN-IN LINK ↗</button>
          </form>

          <p id="authMessage" class="auth-message" role="status"></p>
        </section>
      </div>
    `;

    nav.appendChild(slot);

    const button = document.getElementById("authButton");
    const modal = document.getElementById("authModal");
    const close = () => { modal.hidden = true; };

    button.addEventListener("click", () => {
      if (state.authenticated) {
        window.location.href = "account.html";
        return;
      }
      modal.hidden = false;
      setTimeout(() => document.getElementById("authEmail")?.focus(), 0);
    });

    slot.querySelectorAll("[data-auth-close]").forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });

    document.getElementById("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const emailInput = document.getElementById("authEmail");
      const submit = document.getElementById("authSubmit");
      const message = document.getElementById("authMessage");
      const email = emailInput.value.trim();

      submit.disabled = true;
      message.className = "auth-message";
      message.textContent = "Sending…";

      try {
        const response = await api("/api/auth/request", {
          method: "POST",
          body: JSON.stringify({ email })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(data.error || "Could not send the sign-in email.");

        message.className = "auth-message success";
        message.textContent = "Check your inbox. The sign-in link expires in 10 minutes.";
      } catch (error) {
        message.className = "auth-message error";
        message.textContent = error.message || "Something went wrong.";
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
    }

    const button = document.getElementById("authButton");
    if (button) {
      button.textContent = state.authenticated ? "ACCOUNT ↗" : "LOGIN";
      button.title = state.email || "";
    }
  }

  async function loadAccountPage() {
    if (document.body.dataset.page !== "account") return;

    const status = document.getElementById("accountStatus");
    const email = document.getElementById("accountEmail");
    const logout = document.getElementById("logoutButton");

    if (API.includes("YOUR-WORKER")) {
      status.textContent = "Set DEWIFY_AUTH_API in auth.js after deploying the Worker.";
      return;
    }

    try {
      const response = await api("/api/auth/me");
      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        status.textContent = "Not signed in.";
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

  window.DEWIFY_AUTH = { api, state };
  init();
})();
