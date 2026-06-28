import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Redis, { type RedisOptions } from "ioredis";
import { Pool } from "pg";
import { createRedisConnectionOptions } from "../config/redis";

const DEFAULT_TIMEOUT_MS = 5000;
const REQUIRED_ENVIRONMENT = ["DATABASE_URL", "RAZORPAY_WEBHOOK_SECRET"] as const;

export type WorkerReadinessStatus = "error" | "ok";

export type WorkerReadinessCheck = {
  durationMs: number;
  message?: string;
  name: "environment" | "postgres" | "redis";
  status: WorkerReadinessStatus;
};

export type WorkerReadinessResult = {
  checks: WorkerReadinessCheck[];
  durationMs: number;
  service: "worker";
  status: WorkerReadinessStatus;
  timestamp: string;
};

export type WorkerReadinessDependencies = {
  checkDatabase?: (databaseUrl: string, timeoutMs: number) => Promise<void>;
  checkRedis?: (redisOptions: RedisOptions, timeoutMs: number) => Promise<void>;
  env?: Record<string, string | undefined>;
  now?: () => Date;
};

export async function runWorkerReadinessCheck(
  dependencies: WorkerReadinessDependencies = {}
): Promise<WorkerReadinessResult> {
  const env = dependencies.env ?? process.env;

  if (!dependencies.env) {
    loadWorkerEnvironment({ env });
  }

  const now = dependencies.now ?? (() => new Date());
  const startedAtMs = Date.now();
  const timeoutMs = parsePositiveInteger(
    env.WORKER_PREFLIGHT_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !env[name]);

  if (missing.length > 0) {
    return {
      checks: [
        {
          durationMs: 0,
          message: `Missing required environment variables: ${missing.join(", ")}`,
          name: "environment",
          status: "error"
        }
      ],
      durationMs: Date.now() - startedAtMs,
      service: "worker",
      status: "error",
      timestamp: now().toISOString()
    };
  }

  const checks: WorkerReadinessCheck[] = [
    {
      durationMs: 0,
      name: "environment",
      status: "ok"
    }
  ];
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL readiness invariant failed.");
  }

  checks.push(
    await runTimedCheck("postgres", () =>
      (dependencies.checkDatabase ?? checkPostgres)(databaseUrl, timeoutMs)
    )
  );
  checks.push(
    await runTimedCheck("redis", () =>
      (dependencies.checkRedis ?? checkRedis)(
        createRedisConnectionOptions(env),
        timeoutMs
      )
    )
  );

  return {
    checks,
    durationMs: Date.now() - startedAtMs,
    service: "worker",
    status: checks.every((check) => check.status === "ok") ? "ok" : "error",
    timestamp: now().toISOString()
  };
}

export function formatReadinessResult(result: WorkerReadinessResult) {
  return JSON.stringify(result);
}

export function shouldRunStartupPreflight(
  env: Record<string, string | undefined> = process.env
) {
  return env.WORKER_PREFLIGHT_ON_STARTUP !== "false";
}

export function loadWorkerEnvironment({
  cwd = process.cwd(),
  env = process.env
}: {
  cwd?: string;
  env?: Record<string, string | undefined>;
} = {}) {
  const protectedKeys = new Set(Object.keys(env));

  for (const directory of collectEnvironmentDirectories(cwd)) {
    loadEnvFile(join(directory, ".env"), env, protectedKeys);
  }
}

async function runTimedCheck(
  name: WorkerReadinessCheck["name"],
  check: () => Promise<void>
): Promise<WorkerReadinessCheck> {
  const startedAtMs = Date.now();

  try {
    await check();

    return {
      durationMs: Date.now() - startedAtMs,
      name,
      status: "ok"
    };
  } catch (error) {
    return {
      durationMs: Date.now() - startedAtMs,
      message: sanitizeReadinessError(error),
      name,
      status: "error"
    };
  }
}

async function checkPostgres(databaseUrl: string, timeoutMs: number) {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: timeoutMs,
    max: 1
  });

  try {
    await withTimeout(pool.query("SELECT 1"), timeoutMs, "Postgres readiness timed out.");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function checkRedis(redisOptions: RedisOptions, timeoutMs: number) {
  const redis = new Redis({
    ...redisOptions,
    connectTimeout: timeoutMs,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null
  });

  redis.on("error", () => undefined);

  try {
    await withTimeout(
      redis.connect().then(() => redis.ping()),
      timeoutMs,
      "Redis readiness timed out."
    );
  } finally {
    redis.disconnect();
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function collectEnvironmentDirectories(cwd: string) {
  const directories: string[] = [];
  let current = resolve(cwd);
  let reachedRoot = false;

  while (!reachedRoot) {
    directories.push(current);

    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      break;
    }

    const parent = dirname(current);

    reachedRoot = parent === current;
    current = parent;
  }

  return directories.reverse();
}

function loadEnvFile(
  filePath: string,
  env: Record<string, string | undefined>,
  protectedKeys: Set<string>
) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (!key || protectedKeys.has(key)) {
      continue;
    }

    env[key] = parseEnvValue(rawValue ?? "");
  }
}

function parseEnvValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function sanitizeReadinessError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const fallbackMessage =
    message.trim().length > 0
      ? message
      : code
        ? `${error instanceof Error ? error.name : "Error"}: ${code}`
        : "Readiness check failed.";

  return fallbackMessage
    .replace(/(postgres(?:ql)?:\/\/)(?:[^@\s]+@)/gi, "$1[redacted]@")
    .replace(/(redis(?:s)?:\/\/)(?:[^@\s]*@)/gi, "$1[redacted]@")
    .replace(/(password=)[^\s]+/gi, "$1[redacted]")
    .replace(/(token=)[^\s]+/gi, "$1[redacted]")
    .replace(/(secret=)[^\s]+/gi, "$1[redacted]");
}
