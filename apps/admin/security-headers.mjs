/* global process, URL */

// Browser security headers for the admin dashboard.
//
// Clickjacking protection is enforced now; the dashboard must never be framed.
// The full Content Security Policy starts in report-only mode because a wrong
// allowance would break the dashboard. Once reports are clean, set
// CSP_ENFORCE=true and rebuild.

export function securityHeaders(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const connectSources = [
    "'self'",
    originOf(env.NEXT_PUBLIC_API_URL),
    originOf(env.NEXT_PUBLIC_SENTRY_DSN)
  ];
  const policy = [
    "default-src 'self'",
    // 'unsafe-inline' covers Next.js's inline bootstrap scripts.
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${unique(connectSources).join(" ")}`,
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    env.CSP_REPORT_URI ? `report-uri ${env.CSP_REPORT_URI}` : null
  ];
  const fullPolicy = policy.filter(Boolean).join("; ");
  const enforceAll = env.CSP_ENFORCE === "true";
  const headers = [
    {
      key: "Content-Security-Policy",
      value: enforceAll
        ? fullPolicy
        : "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    // The dashboard has nothing for search engines.
    { key: "X-Robots-Tag", value: "noindex, nofollow" }
  ];

  if (!enforceAll) {
    headers.push({ key: "Content-Security-Policy-Report-Only", value: fullPolicy });
  }

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains"
    });
  }

  return headers;
}

function originOf(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
