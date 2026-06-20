import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiClientError,
  buildAdminApiUrl,
  requestAdminApi,
  type AdminSession
} from "./admin-api";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

function makeSession(accessToken = "access-token"): AdminSession {
  return {
    admin: {
      email: "admin@example.com",
      firstName: "Ritika",
      id: "admin_1",
      lastName: null,
      permissions: ["products.read"],
      role: {
        code: "SUPER_ADMIN",
        name: "Super Admin"
      }
    },
    tokens: {
      accessToken,
      accessTokenExpiresAt: "2099-05-25T10:15:00.000Z",
      accessTokenExpiresInSeconds: 900,
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: "2099-06-24T10:00:00.000Z",
      refreshTokenExpiresInSeconds: 2592000,
      tokenType: "Bearer"
    }
  };
}

describe("admin API client", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api/v1";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
  });

  it("builds admin API URLs from NEXT_PUBLIC_API_URL and query params", () => {
    const url = buildAdminApiUrl("/admin/products", {
      limit: 20,
      search: "surgical kit",
      status: "ACTIVE"
    });

    expect(url.toString()).toBe(
      "https://api.example.com/api/v1/admin/products?limit=20&search=surgical+kit&status=ACTIVE"
    );
  });

  it("routes browser requests for Railway API hosts through the admin app proxy", () => {
    process.env.NEXT_PUBLIC_API_URL =
      "https://smp-production-b700.up.railway.app/api/v1";

    const url = buildAdminApiUrl("/auth/admin/login");

    expect(url.toString()).toBe(
      `${window.location.origin}/api/v1/auth/admin/login`
    );
  });

  it("adds the admin JWT and retries once with refreshed tokens after a 401", async () => {
    let currentSession = makeSession("expired-access-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            error: {
              code: "UNAUTHORIZED",
              message: "Access token expired."
            },
            meta: {
              method: "GET",
              path: "/api/v1/admin/products",
              timestamp: "2026-05-25T10:00:00.000Z"
            },
            success: false
          }),
          { status: 401 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              items: []
            },
            meta: {
              method: "GET",
              path: "/api/v1/admin/products",
              timestamp: "2026-05-25T10:00:01.000Z"
            },
            success: true
          }),
          { status: 200 }
        )
      );
    const clearSession = vi.fn();

    await expect(
      requestAdminApi<{ items: unknown[] }>("/admin/products", {
        auth: {
          clearSession,
          getSession: () => currentSession,
          refreshSession: async () => {
            currentSession = makeSession("fresh-access-token");
            return currentSession;
          }
        }
      })
    ).resolves.toEqual({ items: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      new Headers(
        (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers
      ).get("Authorization")
    ).toBe("Bearer expired-access-token");
    expect(
      new Headers(
        (fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.headers
      ).get("Authorization")
    ).toBe("Bearer fresh-access-token");
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("throws typed API errors for failed envelopes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          error: {
            code: "FORBIDDEN",
            message: "Admin lacks products.read permission."
          },
          meta: {
            method: "GET",
            path: "/api/v1/admin/products",
            timestamp: "2026-05-25T10:00:00.000Z"
          },
          success: false
        }),
        { status: 403 }
      )
    );

    await expect(requestAdminApi("/admin/products")).rejects.toThrow(
      new AdminApiClientError(
        "Admin lacks products.read permission.",
        403,
        "FORBIDDEN"
      )
    );
  });

  it("normalizes network failures into typed admin API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(requestAdminApi("/admin/products")).rejects.toThrow(
      new AdminApiClientError(
        "Unable to reach the admin API. Make sure the backend is running and try again.",
        0,
        "NETWORK_ERROR"
      )
    );
  });
});
