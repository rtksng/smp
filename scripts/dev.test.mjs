import assert from "node:assert/strict";
import test from "node:test";
import { createDevPlan, stopDevChildren } from "./dev.mjs";

test("createDevPlan gates frontend startup on API health before worker startup", () => {
  const plan = createDevPlan({});

  assert.deepEqual(
    plan.backendBeforeHealth.map((process) => process.name),
    ["api"]
  );
  assert.deepEqual(
    plan.backendAfterHealth.map((process) => process.name),
    ["worker"]
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

test("createDevPlan uses a default API health timeout that allows cold watch compilation", () => {
  const plan = createDevPlan({});

  assert.equal(plan.healthTimeoutMs, 120000);
});

test("stopDevChildren kills live child processes in reverse startup order", () => {
  const killed = [];
  const children = [
    {
      killed: false,
      kill() {
        killed.push("api");
      }
    },
    {
      killed: true,
      kill() {
        killed.push("worker");
      }
    },
    {
      killed: false,
      kill() {
        killed.push("web");
      }
    }
  ];

  stopDevChildren(children);

  assert.deepEqual(killed, ["web", "api"]);
});
