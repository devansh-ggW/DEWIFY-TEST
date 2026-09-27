const encoder = new TextEncoder();
const MAGIC_TTL = 10 * 60;
const SESSION_TTL = 7 * 24 * 60 * 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    try {
      if (url.pathname === "/api/auth/request" && request.method === "POST") {
        return await requestMagicLink(request, env, origin);
      }

      if (url.pathname === "/api/auth/verify" && request.method === "GET") {
        return await verifyMagicLink(url, env);
      }

      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        return await me(request, env, origin);
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        return logout(origin, env);
      }

      return json({ error: "Not found" }, 404, origin, env);
    } catch (error) {
      console.error(error);
      return json({ error: "Something went wrong." }, 500, origin, env);
    }
  }
};

function corsHeaders(origin, env) {
  const allowed = env.WEB_ORIGIN || "";
  const headers = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin"
  };

  if (origin && origin === allowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(data, status, origin, env) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin, env)
  };
  return new Response(JSON.stringify(data), { status, headers });
}

async function requestMagicLink(request, env, origin) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);

  if (!email || !isEmail(email)) {
    return json({ error: "Enter a valid email address." }, 400, origin, env);
  }

  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    return json({ error: "Email service is not configured yet." }, 500, origin, env);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signToken(
    { typ: "magic", email, exp: now + MAGIC_TTL, nonce: randomBytes(16) },
    env
  );

  const apiBase = new URL(request.url).origin;
  const verifyUrl = new URL("/api/auth/verify", apiBase);
  verifyUrl.searchParams.set("token", token);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [email],
      subject: "Sign in to DEWIFY",
      html: emailHtml(email, verifyUrl.toString()),
      text: "Sign in to DEWIFY: " + verifyUrl.toString() + "\n\nThis link expires in 10 minutes."
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Resend error:", detail);
    return json({ error: "We couldn't send the sign-in email." }, 502, origin, env);
  }

  return json(
    { ok: true, message: "Check your inbox for a sign-in link." },
    200,
    origin,
    env
  );
}

async function verifyMagicLink(url, env) {
  const token = url.searchParams.get("token") || "";
  const payload = await verifyToken(token, env);

  if (!payload || payload.typ !== "magic") {
    return redirectToApp(env, "login=invalid");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.email || payload.exp < now) {
    return redirectToApp(env, "login=expired");
  }

  const session = await signToken(
    { typ: "session", email: payload.email, exp: now + SESSION_TTL },
    env
  );

  const response = new Response(null, {
    status: 302,
    headers: {
      "Location": appUrl(env),
      "Set-Cookie": [
        "__Host-dewify_session=" + session,
        "Max-Age=" + SESSION_TTL,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=None"
      ].join("; ")
    }
  });

  return response;
}

async function me(request, env, origin) {
  const cookie = getCookie(request.headers.get("Cookie") || "", "__Host-dewify_session");
  const payload = cookie ? await verifyToken(cookie, env) : null;
  const now = Math.floor(Date.now() / 1000);

  if (!payload || payload.typ !== "session" || payload.exp < now) {
    return json({ authenticated: false }, 200, origin, env);
  }

  return json(
    { authenticated: true, email: payload.email },
    200,
    origin,
    env
  );
}

function logout(origin, env) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": "__Host-dewify_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None",
      ...corsHeaders(origin, env)
    }
  });
}

function redirectToApp(env, status) {
  const target = new URL(appUrl(env));
  target.searchParams.set(status.split("=")[0], status.split("=")[1]);
  return new Response(null, {
    status: 302,
    headers: { "Location": target.toString() }
  });
}

function appUrl(env) {
  return env.APP_URL || (env.WEB_ORIGIN || "") + "/DEWIFY-TEST/account.html";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function getCookie(header, name) {
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key === name) return part.slice(index + 1).trim();
  }
  return null;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes) {
  return base64UrlEncode(bytes);
}

async function getKey(env) {
  const secret = env.AUTH_SECRET || env.RESEND_API_KEY;
  if (!secret) throw new Error("Missing AUTH_SECRET or RESEND_API_KEY");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signToken(payload, env) {
  const data = base64UrlEncode(JSON.stringify(payload));
  const key = await getKey(env);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return data + "." + base64UrlEncode(signature);
}

async function verifyToken(token, env) {
  const [data, signature] = String(token).split(".");
  if (!data || !signature) return null;

  let signatureBytes;
  try {
    signatureBytes = base64UrlDecode(signature);
  } catch {
    return null;
  }

  const key = await getKey(env);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(data)
  );

  if (!valid) return null;

  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(data)));
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailHtml(email, link) {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#070707;color:#f5f5f5;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px">
    <p style="font-size:11px;letter-spacing:.18em;color:#929292">DEWIFY / SIGN IN</p>
    <h1 style="font-size:42px;line-height:1;letter-spacing:-.05em;margin:18px 0">Welcome back.</h1>
    <p style="color:#aaa;line-height:1.7">Use the button below to sign in to DEWIFY as <strong style="color:#f5f5f5">${escapeHtml(email)}</strong>.</p>
    <p style="margin:32px 0">
      <a href="${link}" style="display:inline-block;padding:14px 18px;background:#f5f5f5;color:#070707;text-decoration:none;font-weight:700">SIGN IN TO DEWIFY ↗</a>
    </p>
    <p style="font-size:12px;color:#707070;line-height:1.6">This link expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  </div>
</body>
</html>`;
}
