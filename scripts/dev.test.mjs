import assert from "node:assert/strict";
import test from "node:test";
import { createDevPlan } from "./dev.mjs";

test("createDevPlan starts API and worker before web and admin", () => {
  const plan = createDevPlan({});

  assert.deepEqual(
    plan.backend.map((process) => process.name),
    ["api", "worker"]
  );
  assert.deepEqual(
    plan.frontend.map((process) => process.name),
    ["web", "admin"]
  );
});

test("createDevPlan waits for the configured API health URL before frontends", () => {
  const plan = createDevPlan({
    API_PORT: "4100",
    DEV_API_HEALTH_TIMEOUT_MS: "15000"
  });

  assert.equal(plan.healthUrl, "http://localhost:4100/api/v1/health");
  assert.equal(plan.healthTimeoutMs, 15000);
});

