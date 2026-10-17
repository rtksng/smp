/* global process, URL */

// Browser security headers for the customer site.
//
// Clickjacking protection is enforced now. The full Content Security Policy
// starts in report-only mode: Next.js inline scripts and Razorpay Checkout
// need allowances that are easy to get wrong, and a mistake would block
// payments. Once reports are clean, set CSP_ENFORCE=true and rebuild.

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com";
const RAZORPAY_FRAMES = ["https://api.razorpay.com", "https://checkout.razorpay.com"];
const RAZORPAY_CONNECT = ["https://api.razorpay.com", "https://lumberjack.razorpay.com"];

export function securityHeaders(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const connectSources = [
    "'self'",
    originOf(env.NEXT_PUBLIC_API_URL),
    originOf(env.NEXT_PUBLIC_SENTRY_DSN),
    ...RAZORPAY_CONNECT
  ];
  const policy = [
    "default-src 'self'",
    // 'unsafe-inline' covers Next.js's inline bootstrap scripts; nonces would
    // force every page to render per request.
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} ${RAZORPAY_SCRIPT}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${unique(connectSources).join(" ")}`,
    `frame-src ${RAZORPAY_FRAMES.join(" ")}`,
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
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
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
