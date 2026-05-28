import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StructuredLogger } from "../logging/structured-logger.service";

export type ErrorMonitoringContext = {
  method?: string;
  path?: string;
  requestId?: string;
  statusCode?: number;
};

@Injectable()
export class ErrorMonitoringService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLogger
  ) {}

  captureException(exception: unknown, context: ErrorMonitoringContext) {
    if (!this.configService.get<boolean>("errorMonitoringEnabled", false)) {
      return;
    }

    this.logger.warn(
      {
        dsnConfigured: Boolean(this.configService.get<string>("errorMonitoringDsn")),
        errorName: exception instanceof Error ? exception.name : "UnknownError",
        event: "error_monitoring.capture_placeholder",
        ...context
      },
      ErrorMonitoringService.name
    );
  }
}
