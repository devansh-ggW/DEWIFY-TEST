# DEWIFY-TEST

Experimental browser-first website customizer for DEWIFY.

## Current prototype

### Website customizer
1. User fills a short business/site survey.
2. User chooses a visual theme.
3. The template updates live in the browser.
4. "Generate website" exports a standalone HTML file.
5. The website brief stays in the browser; it is not submitted by the customizer.

### Passwordless email login
The experiment now includes a small Cloudflare Worker auth API:

- POST /api/auth/request — validates an email and sends a magic link with Resend.
- GET /api/auth/verify — verifies the signed magic token and creates a 7-day session cookie.
- GET /api/auth/me — returns the signed-in email.
- POST /api/auth/logout — clears the session cookie.

The login uses Web Crypto HMAC signing in the Worker. Cloudflare Workers supports Web Crypto directly, and Cloudflare recommends encrypted Worker secrets for credentials. Resend supports sending mail from Cloudflare Workers and its email API supports the from, to, subject and html fields used here.

## Cloudflare Worker setup

Deploy worker.js as a Cloudflare Worker.

Set these Worker variables:

- RESEND_FROM = digitalproducts@dewify.shop
- WEB_ORIGIN = https://devansh-ggw.github.io
- APP_URL = https://devansh-ggw.github.io/DEWIFY-TEST/account.html

Add this as a Worker secret:

- RESEND_API_KEY = the Resend API key

For stronger separation later, add a separate AUTH_SECRET Worker secret. The current Worker falls back to RESEND_API_KEY for HMAC signing so the prototype can run with the requested secret set only.

After the Worker is deployed, replace the placeholder in auth.js:

https://YOUR-WORKER.workers.dev

with the real Worker URL.

The GitHub Pages site and Worker are separate origins, so the Worker uses CORS plus credentialed requests. WEB_ORIGIN must match the browser origin exactly (origin only, with no path).

## Files

- index.html — customizer UI + live preview + login button
- app.js — local template generator
- styles.css — UI styles
- stars.js — lightweight background
- auth.js — email login client
- account.html — account/session page
- worker.js — Resend + signed magic-link auth API
- wrangler.toml — Worker configuration
