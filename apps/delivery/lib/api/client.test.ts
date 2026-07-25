import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {}
    }
  }
}));

describe("delivery API client", () => {
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  test("wraps network failures in a safe ApiError", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api/v1";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Network request failed")
    );
    const { apiRequest, ApiError } = await import("./client");

    await expect(apiRequest("/delivery/me", z.unknown())).rejects.toMatchObject({
      message: "Unable to connect to the server.",
      name: "ApiError",
      status: 0
    });
    await expect(apiRequest("/delivery/me", z.unknown())).rejects.toBeInstanceOf(
      ApiError
    );
  });

  test("passes an abort signal to fetch when a timeout is configured", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api/v1";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { apiRequest } = await import("./client");

    await apiRequest("/health", z.unknown(), { timeoutMs: 1_000 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/health",
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });

  test("removes trailing slashes from configured API base URLs", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api/v1///";
    const { API_BASE_URL } = await import("./client");

    expect(API_BASE_URL).toBe("https://api.example.com/api/v1");
  });

  test("notifies auth when the API rejects an access token", async () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api/v1";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
    );
    const { apiRequest, setUnauthorizedHandler } = await import("./client");
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiRequest("/delivery/me", z.unknown())).rejects.toMatchObject({
      status: 401
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    setUnauthorizedHandler(null);
  });
});
