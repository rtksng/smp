import * as Sentry from "@sentry/node";
import { sanitizeErrorMessage } from "./queues/job-processing";

// Imported first by main.ts. Reporting is on when ERROR_MONITORING_DSN is set
// in production, or when ERROR_MONITORING_ENABLED=true.
const dsn = process.env.ERROR_MONITORING_DSN?.trim();
const enabledSetting = process.env.ERROR_MONITORING_ENABLED?.trim().toLowerCase();
const enabled =
  enabledSetting === undefined
    ? process.env.NODE_ENV === "production" && Boolean(dsn)
    : ["1", "true", "yes", "on"].includes(enabledSetting);

if (enabled && dsn) {
  Sentry.init({
    // Job data carries OTPs, phone numbers and email addresses; Sentry would
    // otherwise attach queue arguments and stack-frame variables.
    beforeSend(event) {
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) {
          exception.value = sanitizeErrorMessage(exception.value);
        }
      }

      return event;
    },
    dataCollection: {
      cookies: false,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
      httpBodies: [],
      httpHeaders: false,
      queues: false,
      stackFrameVariables: false,
      urlQueryParams: false,
      userInfo: false
    },
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: 0
  });
}
