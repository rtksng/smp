import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_POLL_INTERVAL_MS = 1_000;

const corepack = "corepack";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const useShell = process.platform === "win32";

export function createDevPlan(env = process.env) {
  const apiPort = env.API_PORT || "4000";
  const healthTimeoutMs = Number(
    env.DEV_API_HEALTH_TIMEOUT_MS || DEFAULT_HEALTH_TIMEOUT_MS
  );

  return {
    backend: [
      devProcess("api", "@surgical/api"),
      devProcess("worker", "@surgical/worker")
    ],
    frontend: [
      devProcess("web", "@surgical/web"),
      devProcess("admin", "@surgical/admin")
    ],
    healthTimeoutMs,
    healthUrl:
      env.DEV_API_HEALTH_URL || `http://localhost:${apiPort}/api/v1/health`,
    setup: {
      args: [
        "pnpm",
        "--filter",
        "@surgical/config",
        "--filter",
        "@surgical/types",
        "--filter",
        "@surgical/ui",
        "build"
      ],
      name: "setup"
    }
  };
}

async function main() {
  const plan = createDevPlan();
  const children = [];

  const stopChildren = () => {
    for (const child of children.toReversed()) {
      if (!child.killed) {
        child.kill();
      }
    }
  };

  process.once("SIGINT", () => {
    stopChildren();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    stopChildren();
    process.exit(143);
  });

  await runSetup(plan.setup);

  const backendChildren = plan.backend.map((definition) =>
    startLongRunning(definition, children)
  );
  await waitForApiHealth(plan.healthUrl, plan.healthTimeoutMs, backendChildren);

  for (const definition of plan.frontend) {
    startLongRunning(definition, children);
  }
}

function devProcess(name, packageName) {
  return {
    args: ["pnpm", "--filter", packageName, "dev"],
    name
  };
}

function runSetup(definition) {
  return new Promise((resolve, reject) => {
    const child = spawn(corepack, definition.args, {
      cwd: repoRoot,
      shell: useShell,
      stdio: ["ignore", "pipe", "pipe"]
    });

    pipeWithPrefix(child.stdout, definition.name);
    pipeWithPrefix(child.stderr, definition.name);

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${definition.name} exited before dev startup completed: ${formatExit(
            code,
            signal
          )}`
        )
      );
    });
  });
}

function startLongRunning(definition, children) {
  const child = spawn(corepack, definition.args, {
    cwd: repoRoot,
    shell: useShell,
    stdio: ["ignore", "pipe", "pipe"]
  });

  children.push(child);
  pipeWithPrefix(child.stdout, definition.name);
  pipeWithPrefix(child.stderr, definition.name);

  child.once("error", (error) => {
    console.error(`[${definition.name}] failed to start`, error);
  });

  return { child, definition };
}

async function waitForApiHealth(healthUrl, timeoutMs, backendChildren) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    const exited = backendChildren.find(({ child }) => child.exitCode !== null);

    if (exited) {
      throw new Error(
        `${exited.definition.name} exited before API health check passed.`
      );
    }

    try {
      if (await isHealthy(healthUrl)) {
        console.log(`[dev] API health check passed at ${healthUrl}`);
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(HEALTH_POLL_INTERVAL_MS);
  }

  throw new Error(
    `API did not become healthy at ${healthUrl} within ${timeoutMs}ms.${
      lastError instanceof Error ? ` Last error: ${lastError.message}` : ""
    }`
  );
}

function isHealthy(rawUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      { method: "GET", timeout: 2_000 },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      }
    );

    request.once("error", reject);
    request.once("timeout", () => {
      request.destroy(new Error("health check timed out"));
    });
    request.end();
  });
}

function pipeWithPrefix(stream, name) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        console.log(`[${name}] ${line}`);
      }
    }
  });
}

function formatExit(code, signal) {
  return signal ? `signal ${signal}` : `code ${code}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error("[dev] startup failed", error);
    process.exit(1);
  });
}
