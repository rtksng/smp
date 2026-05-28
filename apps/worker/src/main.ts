import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { StructuredLogger } from "./structured-logger.service";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true
  });
  app.useLogger(app.get(StructuredLogger));
  app.enableShutdownHooks();
}

void bootstrap();
