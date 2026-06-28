import type { QueueName } from "@surgical/config";
import type { Job } from "bullmq";
import type { StructuredLogger } from "../structured-logger.service";

type WorkerLogger = Pick<StructuredLogger, "error" | "log">;

export function assertJobName(job: Job, expectedName: string, label: string) {
  if (job.name !== expectedName) {
    throw new Error(`Unsupported ${label} job: ${job.name}`);
  }
}

export function requireRecordPayload(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} payload must be an object`);
  }

  return value;
}

export function requireString(
  data: Record<string, unknown>,
  field: string
) {
  const value = data[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value;
}

export function requireOptionalString(
  data: Record<string, unknown>,
  field: string
) {
  const value = data[field];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be null or a non-empty string`);
  }

  return value;
}

export function requireNonNegativeNumber(
  data: Record<string, unknown>,
  field: string
) {
  const value = data[field];

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative finite number`);
  }

  return value;
}

export function requireVersionOne(data: Record<string, unknown>) {
  if (data.version !== 1) {
    throw new Error("version must be 1");
  }
}

export function requireIsoDateString(
  data: Record<string, unknown>,
  field: string
) {
  const value = requireString(data, field);

  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO date string`);
  }

  return value;
}

export function requireOneOf<T extends readonly string[]>(
  data: Record<string, unknown>,
  field: string,
  allowed: T
): T[number] {
  const value = requireString(data, field);

  if (!allowed.includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }

  return value;
}

export function requireBase64String(
  data: Record<string, unknown>,
  field: string
) {
  const value = requireString(data, field).trim();

  if (
    value.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw new Error(`${field} must be valid base64`);
  }

  return value;
}

export function logJobCompleted(
  logger: WorkerLogger,
  context: string,
  queueName: QueueName,
  job: Job,
  event: string,
  startedAtMs: number,
  details: Record<string, unknown> = {}
) {
  logger.log(
    stripUndefined({
      attemptsMade: job.attemptsMade ?? 0,
      durationMs: Date.now() - startedAtMs,
      event,
      jobId: job.id?.toString(),
      jobName: job.name,
      queueName,
      status: "completed",
      ...details
    }),
    context
  );
}

export function logJobFailed(
  logger: WorkerLogger,
  context: string,
  queueName: QueueName,
  job: Job,
  startedAtMs: number,
  error: unknown
) {
  logger.error(
    stripUndefined({
      attemptsMade: job.attemptsMade ?? 0,
      durationMs: Date.now() - startedAtMs,
      errorName: error instanceof Error ? error.name : undefined,
      event: "job.failed",
      failureReason: sanitizeErrorMessage(error),
      jobId: job.id?.toString(),
      jobName: job.name,
      queueName,
      status: "failed"
    }),
    undefined,
    context
  );
}

export function redactMobileNumber(mobileNumber: string) {
  const lastFour = mobileNumber.slice(-4);

  return `${"*".repeat(Math.max(mobileNumber.length - 4, 0))}${lastFour}`;
}

export function sanitizeErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  return message
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[redacted]@")
    .replace(/(password=)[^\s]+/gi, "$1[redacted]")
    .replace(/(token=)[^\s]+/gi, "$1[redacted]")
    .replace(/(secret=)[^\s]+/gi, "$1[redacted]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
