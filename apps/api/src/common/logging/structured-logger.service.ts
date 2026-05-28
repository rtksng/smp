import { Injectable, LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type LogLevel = "debug" | "error" | "log" | "verbose" | "warn";

@Injectable()
export class StructuredLogger implements LoggerService {
  constructor(private readonly configService: ConfigService) {}

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
    if (this.configService.get<string>("environment") === "production") {
      return;
    }

    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string) {
    if (this.configService.get<string>("environment") === "production") {
      return;
    }

    this.write("verbose", message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string) {
    const record = stripUndefined({
      context,
      environment: this.configService.get<string>("environment", "development"),
      level,
      message: normalizeMessage(message),
      service: "api",
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

function normalizeMessage(message: unknown) {
  if (typeof message === "string") {
    return message;
  }

  return message;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
