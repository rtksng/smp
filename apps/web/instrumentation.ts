import * as Sentry from "@sentry/nextjs";

// Server-side error reporting for pages and route handlers. Off unless
// SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is set.
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  Sentry.init({
    dataCollection: {
      cookies: false,
      databaseQueryData: false,
      httpBodies: [],
      httpHeaders: false,
      stackFrameVariables: false,
      urlQueryParams: false,
      userInfo: false
    },
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV,
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: 0
  });
}

export const onRequestError = Sentry.captureRequestError;
