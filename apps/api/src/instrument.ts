import * as Sentry from "@sentry/node";
import { resolveErrorMonitoring } from "./config/api.config";

// Imported first by main.ts so errors are reported from startup onwards.
// Reporting is on when ERROR_MONITORING_DSN is set in production, or when
// ERROR_MONITORING_ENABLED=true.
const monitoring = resolveErrorMonitoring(process.env);

if (monitoring.enabled && monitoring.dsn) {
  Sentry.init({
    // Sentry collects all of these by default. Stack-frame variables and
    // request bodies would include OTPs, passwords and tokens, so only the
    // error, its stack and the tags we set are sent.
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
    dsn: monitoring.dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0)
  });
}
