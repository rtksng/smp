import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { StructuredLogger } from "../logging/structured-logger.service";

type RequestWithId = Request & {
  requestId?: string;
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLogger) {}

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = requestIdFromHeader(request.headers["x-request-id"]);
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        {
          durationMs,
          event: "http_request",
          ipAddress: request.ip,
          method: request.method,
          path: request.originalUrl,
          requestId,
          statusCode: response.statusCode,
          userAgent: request.headers["user-agent"]
        },
        RequestLoggingMiddleware.name
      );
    });

    next();
  }
}

function requestIdFromHeader(value: Request["headers"]["x-request-id"]) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return randomUUID();
}
