import "reflect-metadata";
import "dotenv/config";
import { resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { setupSwagger } from "./config/swagger.config";
import { createValidationPipe } from "./config/validation.config";
import { StructuredLogger } from "./common/logging/structured-logger.service";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true
  });
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>("apiPrefix", "api/v1");
  const corsOrigins = configService.get<string[]>("corsOrigins", []);
  const port = configService.get<number>("port", 4000);
  const storageProvider = configService.get<string>("storageProvider", "local");
  const swaggerEnabled = configService.get<boolean>("swaggerEnabled", false);
  const trustProxy = configService.get<boolean | number>("trustProxy", false);
  const logger = app.get(StructuredLogger);

  app.useLogger(logger);
  app.enableShutdownHooks();
  app.set("trust proxy", trustProxy);
  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: "cross-origin"
      }
    })
  );
  app.enableCors({
    allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-Request-Id"],
    credentials: true,
    exposedHeaders: [
      "Content-Disposition",
      "Retry-After",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "X-Request-Id"
    ],
    maxAge: 86400,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  });

  if (storageProvider === "local") {
    const publicPath = configService
      .get<string>("storagePublicPath", "uploads")
      .replace(/^\/+|\/+$/g, "");

    app.useStaticAssets(
      resolve(configService.get<string>("storageLocalRoot", "storage/uploads")),
      {
        prefix: `/${publicPath}/`
      }
    );
  }

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(createValidationPipe());
  if (swaggerEnabled) {
    setupSwagger(app);
  }

  await app.listen(port);
}

void bootstrap();
