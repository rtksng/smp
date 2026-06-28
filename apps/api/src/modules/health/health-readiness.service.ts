import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { API_VERSION_PREFIX, APP_NAMES } from "@surgical/config";
import Redis from "ioredis";
import { PrismaService } from "../../database/prisma.service";

type DependencyStatus = "ok" | "error";

export type HealthReadinessResponse = {
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
  service: string;
  status: "ready" | "degraded";
  timestamp: string;
  versionPrefix: string;
};

const READINESS_TIMEOUT_MS = 1500;

@Injectable()
export class HealthReadinessService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService
  ) {
    this.redis = new Redis(configService.getOrThrow<string>("redisUrl"), {
      commandTimeout: READINESS_TIMEOUT_MS,
      connectTimeout: READINESS_TIMEOUT_MS,
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });
  }

  async check(): Promise<HealthReadinessResponse> {
    const [database, redis] = await Promise.all([
      toDependencyStatus(
        withTimeout(this.prisma.$queryRaw`SELECT 1`, READINESS_TIMEOUT_MS)
      ),
      toDependencyStatus(withTimeout(this.redis.ping(), READINESS_TIMEOUT_MS))
    ]);

    return {
      checks: {
        database,
        redis
      },
      service: APP_NAMES.api,
      status: database === "ok" && redis === "ok" ? "ready" : "degraded",
      timestamp: new Date().toISOString(),
      versionPrefix: API_VERSION_PREFIX
    };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}

async function toDependencyStatus(
  operation: Promise<unknown>
): Promise<DependencyStatus> {
  try {
    await operation;
    return "ok";
  } catch {
    return "error";
  }
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Health check timed out.")),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
