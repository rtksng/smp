import type { RedisOptions } from "ioredis";

export function createRedisConnectionOptions(
  env: Record<string, string | undefined> = process.env
): RedisOptions {
  const redisUrl = env.REDIS_URL;

  if (redisUrl) {
    const parsedUrl = new URL(redisUrl);
    const database = parsedUrl.pathname.replace("/", "");
    const usesTls = parsedUrl.protocol === "rediss:";

    return {
      db: database ? Number(database) : undefined,
      host: parsedUrl.hostname,
      maxRetriesPerRequest: null,
      password: parsedUrl.password
        ? decodeURIComponent(parsedUrl.password)
        : undefined,
      port: Number(parsedUrl.port || 6379),
      tls: usesTls ? {} : undefined,
      username: parsedUrl.username
        ? decodeURIComponent(parsedUrl.username)
        : undefined
    };
  }

  const redisPassword = env.REDIS_PASSWORD;

  return {
    host: env.REDIS_HOST ?? "localhost",
    maxRetriesPerRequest: null,
    password:
      redisPassword && redisPassword.length > 0 ? redisPassword : undefined,
    port: Number(env.REDIS_PORT ?? 6379)
  };
}
