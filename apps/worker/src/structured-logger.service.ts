import { Injectable, LoggerService } from "@nestjs/common";

type LogLevel = "debug" | "error" | "log" | "verbose" | "warn";

@Injectable()
export class StructuredLogger implements LoggerService {
  log(message: unknown, context?: string) {
    this.write("log", message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string) {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string) {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    this.write("verbose", message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string) {
    const record = stripUndefined({
      context,
      environment: process.env.NODE_ENV ?? "development",
      level,
      message,
      service: "worker",
      timestamp: new Date().toISOString(),
      trace
    });
    const line = `${JSON.stringify(record)}\n`;

    if (level === "error" || level === "warn") {
      process.stderr.write(line);
      return;
    }

    process.stdout.write(line);
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
