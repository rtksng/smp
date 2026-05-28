import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "./client";
import {
  API_QUERY_STALE_TIME_MS,
  createWebQueryClient,
  shouldRetryApiFailure
} from "./query-client";

describe("web TanStack Query defaults", () => {
  it("retries transient API failures and network failures only", () => {
    expect(shouldRetryApiFailure(0, new ApiClientError("Network", 0))).toBe(true);
    expect(shouldRetryApiFailure(1, new ApiClientError("Try later", 503))).toBe(true);
    expect(shouldRetryApiFailure(2, new ApiClientError("Try later", 503))).toBe(false);
    expect(shouldRetryApiFailure(0, new ApiClientError("Invalid", 400))).toBe(false);
    expect(shouldRetryApiFailure(0, new ApiClientError("Unauthorized", 401))).toBe(false);
  });

  it("centralizes query stale time and retry defaults", () => {
    const client = createWebQueryClient();
    const queryDefaults = client.getDefaultOptions().queries;
    const mutationDefaults = client.getDefaultOptions().mutations;

    expect(queryDefaults?.staleTime).toBe(API_QUERY_STALE_TIME_MS);
    expect(queryDefaults?.retry).toBe(shouldRetryApiFailure);
    expect(mutationDefaults?.retry).toBe(shouldRetryApiFailure);
  });

  it("logs query cache errors only in development", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      vi.stubEnv("NODE_ENV", "production");
      createWebQueryClient()
        .getQueryCache()
        .config.onError?.(new ApiClientError("Nope", 500), {
          queryHash: "products"
        } as never);
      expect(warnSpy).not.toHaveBeenCalled();

      vi.stubEnv("NODE_ENV", "development");
      createWebQueryClient()
        .getQueryCache()
        .config.onError?.(new ApiClientError("Nope", 500), {
          queryHash: "products"
        } as never);
      expect(warnSpy).toHaveBeenCalledWith(
        "[web-api]",
        "Query failed",
        expect.objectContaining({ error: expect.any(ApiClientError), key: "products" })
      );
    } finally {
      vi.unstubAllEnvs();
      warnSpy.mockRestore();
    }
  });
});
