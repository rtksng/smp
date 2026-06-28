import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  formatReadinessResult,
  loadWorkerEnvironment,
  runWorkerReadinessCheck,
  type WorkerReadinessDependencies
} from "../src/health/readiness";

const HEALTHY_ENV = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/surgical_platform",
  RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
  REDIS_QUEUE_PREFIX: "surgical-platform",
  REDIS_URL: "redis://localhost:6379"
};

test("runWorkerReadinessCheck reports ok when required env, database, and Redis pass", async () => {
  const calls: string[] = [];
  const result = await runWorkerReadinessCheck({
    checkDatabase: async () => {
      calls.push("database");
    },
    checkRedis: async () => {
      calls.push("redis");
    },
    env: HEALTHY_ENV,
    now: fixedNow
  });

  assert.equal(result.status, "ok");
  assert.deepEqual(
    result.checks.map((check) => [check.name, check.status]),
    [
      ["environment", "ok"],
      ["postgres", "ok"],
      ["redis", "ok"]
    ]
  );
  assert.deepEqual(calls, ["database", "redis"]);
});

test("runWorkerReadinessCheck reports missing required environment before network checks", async () => {
  const result = await runWorkerReadinessCheck({
    checkDatabase: failIfCalled("database"),
    checkRedis: failIfCalled("redis"),
    env: {
      REDIS_URL: "redis://localhost:6379"
    },
    now: fixedNow
  });

  assert.equal(result.status, "error");
  assert.deepEqual(result.checks, [
    {
      durationMs: 0,
      message: "Missing required environment variables: DATABASE_URL, RAZORPAY_WEBHOOK_SECRET",
      name: "environment",
      status: "error"
    }
  ]);
});

test("runWorkerReadinessCheck reports database and Redis failures without leaking credentials", async () => {
  const result = await runWorkerReadinessCheck({
    checkDatabase: async () => {
      throw new Error("connect failed postgresql://user:secret@localhost:5432/db");
    },
    checkRedis: async () => {
      throw new Error("connect failed redis://:secret@localhost:6379");
    },
    env: HEALTHY_ENV,
    now: fixedNow
  });

  assert.equal(result.status, "error");
  assert.match(
    result.checks.find((check) => check.name === "postgres")?.message ?? "",
    /postgresql:\/\/\[redacted\]@localhost/
  );
  assert.match(
    result.checks.find((check) => check.name === "redis")?.message ?? "",
    /redis:\/\/\[redacted\]@localhost/
  );
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});

test("runWorkerReadinessCheck gives blank dependency errors a safe fallback message", async () => {
  const result = await runWorkerReadinessCheck({
    checkDatabase: async () => {
      throw new Error("");
    },
    checkRedis: async () => undefined,
    env: HEALTHY_ENV,
    now: fixedNow
  });

  assert.equal(result.status, "error");
  assert.equal(
    result.checks.find((check) => check.name === "postgres")?.message,
    "Readiness check failed."
  );
});

test("runWorkerReadinessCheck reports dependency error codes when messages are blank", async () => {
  const result = await runWorkerReadinessCheck({
    checkDatabase: async () => {
      throw Object.assign(new AggregateError([], ""), { code: "ECONNREFUSED" });
    },
    checkRedis: async () => undefined,
    env: HEALTHY_ENV,
    now: fixedNow
  });

  assert.equal(result.status, "error");
  assert.equal(
    result.checks.find((check) => check.name === "postgres")?.message,
    "AggregateError: ECONNREFUSED"
  );
});

test("formatReadinessResult emits structured JSON", async () => {
  const result = await runWorkerReadinessCheck({
    checkDatabase: async () => undefined,
    checkRedis: async () => undefined,
    env: HEALTHY_ENV,
    now: fixedNow
  });

  const parsed = JSON.parse(formatReadinessResult(result)) as {
    service: string;
    status: string;
  };

  assert.equal(parsed.service, "worker");
  assert.equal(parsed.status, "ok");
});

test("loadWorkerEnvironment loads nearest env files without overriding process env", async () => {
  const root = await mkdtemp(join(tmpdir(), "worker-env-"));
  const nested = join(root, "apps", "worker");
  await mkdir(nested, { recursive: true });
  await writeFile(
    join(root, ".env"),
    "DATABASE_URL=postgresql://root:root@localhost:5432/root\nREDIS_URL=redis://root:6379\n"
  );
  await writeFile(
    join(nested, ".env"),
    "DATABASE_URL=postgresql://worker:worker@localhost:5432/worker\nRAZORPAY_WEBHOOK_SECRET=worker-secret\n"
  );
  const env: Record<string, string | undefined> = {
    REDIS_URL: "redis://process:6379"
  };

  loadWorkerEnvironment({ cwd: nested, env });

  assert.equal(
    env.DATABASE_URL,
    "postgresql://worker:worker@localhost:5432/worker"
  );
  assert.equal(env.RAZORPAY_WEBHOOK_SECRET, "worker-secret");
  assert.equal(env.REDIS_URL, "redis://process:6379");
});

function fixedNow() {
  return new Date("2026-06-27T10:00:00.000Z");
}

function failIfCalled(name: string): WorkerReadinessDependencies["checkRedis"] {
  return async () => {
    throw new Error(`${name} should not be called`);
  };
}
