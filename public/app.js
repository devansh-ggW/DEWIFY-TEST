const state = {
  theme: "obsidian",
  accent: "#a78bfa"
};

const $ = (id) => document.getElementById(id);
const form = $("siteForm");
const previewSite = $("previewSite");
const previewStatus = $("previewStatus");
const toast = $("toast");

const themes = {
  obsidian: {
    bg: "#0b0b0c", text: "#f7f7f5", muted: "#a2a2a2",
    border: "rgba(255,255,255,.14)", buttonText: "#080808", kicker: "BUILT FOR THE NEXT MOVE"
  },
  paper: {
    bg: "#f4f1ea", text: "#161616", muted: "#68645d",
    border: "rgba(0,0,0,.16)", buttonText: "#ffffff", kicker: "A SIMPLE WEBSITE FOR A REAL BUSINESS"
  },
  signal: {
    bg: "#111016", text: "#f6f2ff", muted: "#aaa0bb",
    border: "rgba(219,194,255,.18)", buttonText: "#0a070d", kicker: "MAKE NOISE FOR THE RIGHT REASONS"
  }
};

function clean(value, fallback = "") {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeUrl(value) {
  const raw = clean(value);
  if (!raw) return "#";
  return /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
}

function getData() {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    businessName: clean(data.businessName, "Your Brand"),
    headline: clean(data.headline, "Build something people remember"),
    about: clean(data.about, "A focused website for a business, service or personal brand."),
    email: clean(data.email),
    phone: clean(data.phone),
    link: normalizeUrl(data.link),
    accent: state.accent,
    theme: state.theme
  };
}

function renderPreview() {
  const data = getData();
  const t = themes[state.theme];
  previewStatus.textContent = state.theme.toUpperCase();

  previewSite.innerHTML = `
    <div class="preview-content"
      style="--site-bg:${t.bg};--site-text:${t.text};--site-muted:${t.muted};--site-border:${t.border};--site-accent:${escapeHtml(data.accent)};--site-button-text:${t.buttonText};background:${t.bg};color:${t.text}">
      <nav class="preview-nav">
        <div class="preview-logo">${escapeHtml(data.businessName)}</div>
        <a href="${escapeHtml(data.link)}" target="_blank" rel="noopener">VISIT / SOCIAL ↗</a>
      </nav>

      <div class="preview-hero">
        <div class="preview-kicker">${t.kicker}</div>
        <h3>${escapeHtml(data.headline)}</h3>
        <p>${escapeHtml(data.about)}</p>
        <div class="preview-actions">
          <a class="preview-button" href="${data.email ? "mailto:" + encodeURIComponent(data.email) : "#"}">Contact</a>
          <a class="preview-button secondary" href="${escapeHtml(data.link)}" target="_blank" rel="noopener">Explore</a>
        </div>
      </div>

      <footer class="preview-footer">
        <span>${escapeHtml(data.businessName)}</span>
        <span>${escapeHtml(data.email || data.phone || "YOUR CONTACT")}</span>
      </footer>
    </div>
  `;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function buildStandaloneHtml(data) {
  const t = themes[data.theme];
  const contactHref = data.email ? "mailto:" + encodeURIComponent(data.email) : "#";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="${t.bg}">
<title>${escapeHtml(data.businessName)} — ${escapeHtml(data.headline)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{background:${t.bg};color:${t.text}}main{min-height:100vh;max-width:1200px;margin:auto;padding:52px 6vw;display:flex;flex-direction:column}
nav{display:flex;justify-content:space-between;gap:20px;align-items:center}nav strong{font-size:20px;letter-spacing:-.04em}nav a,footer{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.hero{margin:auto 0;max-width:780px}.kicker{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;opacity:.65}.hero h1{font-size:clamp(48px,8vw,100px);line-height:.9;letter-spacing:-.07em;margin:14px 0 22px}.hero p{max-width:680px;color:${t.muted};font-size:16px;line-height:1.75}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.button{display:inline-block;padding:13px 16px;background:${data.accent};color:${t.buttonText};font:900 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase}.button.secondary{background:transparent;color:${t.text};border:1px solid ${t.border}}footer{display:flex;justify-content:space-between;gap:20px;border-top:1px solid ${t.border};padding-top:15px;opacity:.7}
</style>
</head>
<body>
<main>
<nav><strong>${escapeHtml(data.businessName)}</strong><a href="${escapeHtml(data.link)}" target="_blank" rel="noopener">VISIT / SOCIAL ↗</a></nav>
<section class="hero">
<div class="kicker">${t.kicker}</div>
<h1>${escapeHtml(data.headline)}</h1>
<p>${escapeHtml(data.about)}</p>
<div class="actions">
<a class="button" href="${contactHref}">Contact</a>
<a class="button secondary" href="${escapeHtml(data.link)}" target="_blank" rel="noopener">Explore</a>
</div>
</section>
<footer><span>${escapeHtml(data.businessName)}</span><span>${escapeHtml(data.email || data.phone || "YOUR CONTACT")}</span></footer>
</main>
</body>
</html>`;
}

$("accent").addEventListener("input", (event) => {
  state.accent = event.target.value;
  $("accentHex").textContent = state.accent.toUpperCase();
  renderPreview();
});

document.querySelectorAll(".theme-card").forEach((button) => {
  button.addEventListener("click", () => {
    state.theme = button.dataset.theme;
    document.querySelectorAll(".theme-card").forEach((b) => {
      const active = b === button;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderPreview();
  });
});

form.querySelectorAll("input, textarea").forEach((field) => {
  field.addEventListener("input", renderPreview);
});

$("generateBtn").addEventListener("click", () => {
  if (!form.reportValidity()) return;
  const data = getData();
  const html = buildStandaloneHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const filename = (data.businessName || "my-website").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "my-website";

  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast("Website generated locally.");
});

renderPreview();
