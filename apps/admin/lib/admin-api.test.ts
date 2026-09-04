import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiClientError,
  buildAdminApiUrl,
  requestAdminApi,
  requestAdminApiResponse,
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
    vi.useRealTimers();
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

  it.each([
    ["text/csv", "date,orders\r\n2026-09-03,5\r\n"],
    ["application/pdf", "%PDF-1.4\nreport bytes\n%%EOF"]
  ])("preserves %s downloads through the shared request retry", async (contentType, body) => {
    let currentSession = makeSession();
    const refreshSession = vi.fn(async () => {
      currentSession = makeSession("refreshed-test-session");
      return currentSession;
    });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": 'attachment; filename="orders-report.csv"'
        }
      }));

    const response = await requestAdminApiResponse("/admin/reports/dashboard/export", {
      auth: {
        clearSession: vi.fn(),
        getSession: () => currentSession,
        refreshSession
      },
      headers: { Accept: contentType }
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Content-Type")).toBe(contentType);
    expect(response.headers.get("Content-Disposition")).toContain("orders-report");
    expect(response.bodyUsed).toBe(false);
    expect(await response.text()).toBe(body);
  });

  it("uses the shared preflight refresh before requesting a download", async () => {
    const currentSession = makeSession();
    currentSession.tokens.accessTokenExpiresAt = "2000-01-01T00:00:00.000Z";
    const refreshSession = vi.fn(async () => makeSession("refreshed-test-session"));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("date,orders\n2026-09-03,5", { headers: { "Content-Type": "text/csv" } })
    );

    await requestAdminApiResponse("/admin/reports/dashboard/export", {
      auth: { clearSession: vi.fn(), getSession: () => currentSession, refreshSession }
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshSession.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]!);
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

  it("aborts slow admin API requests with a typed timeout error", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      const signal = (init as RequestInit | undefined)?.signal;

      if (!signal) {
        return Promise.reject(new Error("missing abort signal"));
      }

      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("Request aborted.", "AbortError"));
        });
      });
    });

    const request = requestAdminApi("/admin/products", {
      timeoutMs: 25
    });
    const expectation = expect(request).rejects.toThrow(
      new AdminApiClientError(
        "Admin API request timed out. Try again in a moment.",
        0,
        "TIMEOUT"
      )
    );

    await vi.advanceTimersByTimeAsync(25);

    await expectation;
  });
});
