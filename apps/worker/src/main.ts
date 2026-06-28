import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  formatReadinessResult,
  runWorkerReadinessCheck,
  shouldRunStartupPreflight
} from "./health/readiness";
import { StructuredLogger } from "./structured-logger.service";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  if (shouldRunStartupPreflight()) {
    const readiness = await runWorkerReadinessCheck();
    const line = `${formatReadinessResult(readiness)}\n`;

    if (readiness.status !== "ok") {
      process.stderr.write(line);
      process.exitCode = 1;
      return;
    }

    process.stdout.write(line);
  }

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true
  });
  app.useLogger(app.get(StructuredLogger));
  app.enableShutdownHooks();
}

void bootstrap().catch((error) => {
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
