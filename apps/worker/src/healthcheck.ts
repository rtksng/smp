import "reflect-metadata";
import {
  formatReadinessResult,
  runWorkerReadinessCheck
} from "./health/readiness";

async function main() {
  const result = await runWorkerReadinessCheck();
  const line = `${formatReadinessResult(result)}\n`;

  if (result.status === "ok") {
    process.stdout.write(line);
    return;
  }

  process.stderr.write(line);
  process.exitCode = 1;
}

void main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      checks: [
        {
          message: error instanceof Error ? error.message : String(error),
          name: "environment",
          status: "error"
        }
      ],
      service: "worker",
      status: "error",
      timestamp: new Date().toISOString()
    })}\n`
  );
  process.exitCode = 1;
});
