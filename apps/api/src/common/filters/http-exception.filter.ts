import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { Request, Response } from "express";
import { StructuredLogger } from "../logging/structured-logger.service";
import { ErrorMonitoringService } from "../monitoring/error-monitoring.service";

type RequestWithId = Request & {
  requestId?: string;
};

type ErrorPayload = {
  message: string | string[];
  error?: string;
  statusCode?: number;
};

function normalizeException(exception: unknown) {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const statusCode = exception.getStatus();

    if (typeof response === "object" && response !== null) {
      const payload = response as ErrorPayload;

      return {
        error: payload.error ?? exception.name,
        message: payload.message ?? exception.message,
        statusCode
      };
    }

    return {
      error: exception.name,
      message: response,
      statusCode
    };
  }

  return {
    error: "InternalServerError",
    message: "Internal server error",
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: StructuredLogger,
    private readonly errorMonitoringService: ErrorMonitoringService
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const normalized = normalizeException(exception);

    if (normalized.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        {
          event: "http_exception",
          method: request.method,
          path: request.url,
          requestId: request.requestId,
          statusCode: normalized.statusCode
        },
        stack,
        HttpExceptionFilter.name
      );
      this.errorMonitoringService.captureException(exception, {
        method: request.method,
        path: request.url,
        requestId: request.requestId,
        statusCode: normalized.statusCode
      });
    }

    response.status(normalized.statusCode).json({
      data: null,
      error: {
        code: normalized.error,
        message: normalized.message
      },
      meta: {
        method: request.method,
        path: request.url,
        requestId: request.requestId,
        timestamp: new Date().toISOString()
      },
      success: false
    });
  }
}
