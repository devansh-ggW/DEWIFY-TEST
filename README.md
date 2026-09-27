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
The experiment includes a Cloudflare Worker auth API:

- `POST /api/auth/request` — validates an email, creates a short-lived D1 token record, and sends a magic link with Resend.
- `GET /api/auth/verify` — hashes the supplied token, atomically consumes the D1 record, creates/finds the user, and creates a 7-day signed session cookie.
- `GET /api/auth/me` — validates the session cookie and confirms the user still exists in D1.
- `POST /api/auth/logout` — clears the session cookie.

The actual Resend API key stays server-side as a Cloudflare Worker secret. Magic-link tokens are random opaque values; only their SHA-256 hashes are stored in D1.

### D1 schema
`db/schema.sql` contains:

- `users` — persistent accounts.
- `magic_tokens` — expiring, single-use login links.
- `projects` — reserved for saved website projects.

There is intentionally no project-saving UI yet. The next stage can use `projects` so users can save a customized website and return to edit it later.

## Cloudflare Worker setup

Deploy `worker.js` as the Worker.

### Worker variables

- `RESEND_FROM` = `digitalproducts@dewify.shop`
- `WEB_ORIGIN` = the exact browser origin serving the test app.
- `APP_URL` = the account page URL.

### Worker secret

- `RESEND_API_KEY` = the Resend API key.

An optional separate `AUTH_SECRET` Worker secret can be added later. The current Worker falls back to `RESEND_API_KEY` for signing the session cookie so the prototype can run with the requested secret only.

### D1 binding

Bind the D1 database in Cloudflare as:

`Variable name: DB`

The Worker expects `env.DB`.

If deploying with Wrangler, `wrangler.toml` contains a commented D1 binding template. Add the real database ID from Cloudflare before using that configuration for a Wrangler deployment.

### Frontend

After the Worker is deployed, replace the placeholder in `auth.js`:

`https://YOUR-WORKER.workers.dev`

with the real Worker URL.

The frontend uses credentialed cross-origin requests because GitHub Pages and the Worker are separate origins.

## Files

- `index.html` — customizer UI + live preview + auth mount point
- `app.js` — local template generator
- `styles.css` — UI styles
- `stars.js` — lightweight background
- `auth.js` — passwordless login client
- `account.html` — account/session page
- `worker.js` — Resend + D1 + signed session auth API
- `wrangler.toml` — Worker configuration
- `db/schema.sql` — D1 tables and indexes
