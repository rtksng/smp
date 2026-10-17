import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/node";

export type ErrorMonitoringContext = {
  method?: string;
  path?: string;
  requestId?: string;
  statusCode?: number;
};

// Reports unexpected (5xx) errors to Sentry when src/instrument.ts started it;
// otherwise does nothing, since the exception filter already logs them.
@Injectable()
export class ErrorMonitoringService {
  captureException(exception: unknown, context: ErrorMonitoringContext) {
    if (!Sentry.isInitialized()) {
      return;
    }

    Sentry.withScope((scope) => {
      scope.setTag("method", context.method);
      scope.setTag("statusCode", context.statusCode);
      scope.setContext("request", {
        // Query strings can carry search terms or phone numbers.
        path: context.path?.split("?")[0],
        requestId: context.requestId
      });
      Sentry.captureException(exception);
    });
  }
}
