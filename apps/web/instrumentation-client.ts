import * as Sentry from "@sentry/nextjs";

// Browser error reporting. Off unless NEXT_PUBLIC_SENTRY_DSN is set at build
// time.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    // Sentry would otherwise attach cookies, headers, query strings and
    // stack-frame variables, which can hold tokens and phone numbers.
    dataCollection: {
      cookies: false,
      httpBodies: [],
      httpHeaders: false,
      stackFrameVariables: false,
      urlQueryParams: false,
      userInfo: false
    },
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV,
    tracesSampleRate: 0
  });
}
