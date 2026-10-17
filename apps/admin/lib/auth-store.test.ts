import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshAdminSession } from "./admin-api";
import { useAdminAuthStore } from "./auth-store";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

function envelope(status: number, data: unknown) {
  return new Response(
    JSON.stringify(
      status < 400
        ? { data, meta: { method: "POST", path: "/", timestamp: "" }, success: true }
        : {
            data: null,
            error: { code: "CONFLICT", message: "This session was just refreshed." },
            meta: { method: "POST", path: "/", timestamp: "" },
            success: false
          }
    ),
    { headers: { "Content-Type": "application/json" }, status }
  );
}

const refreshed = {
  admin: {
    email: "admin@example.com",
    firstName: "Ritika",
    id: "admin_1",
    lastName: null,
    permissions: ["products.read"],
    role: { code: "SUPER_ADMIN", name: "Super Admin" }
  },
  tokens: {
    accessToken: "fresh-access-token",
    accessTokenExpiresAt: "2099-05-25T10:15:00.000Z",
    accessTokenExpiresInSeconds: 900,
    refreshTokenExpiresAt: "2099-06-24T10:00:00.000Z",
    refreshTokenExpiresInSeconds: 2592000,
    tokenType: "Bearer"
  }
};

describe("admin session refresh", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api/v1";
    useAdminAuthStore.setState({ isHydrated: false, session: null });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("sends one cookie-based refresh for concurrent callers in a tab", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(envelope(200, refreshed));

    const [first, second] = await Promise.all([refreshAdminSession(), refreshAdminSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe("include");
    expect(init.body).toBeUndefined();
    expect(first).toEqual(refreshed);
    expect(second).toBe(first);
  });

  it("retries once when another tab refreshed the session a moment earlier", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(envelope(409, null))
      .mockResolvedValueOnce(envelope(200, refreshed));

    await expect(refreshAdminSession()).resolves.toEqual(refreshed);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("restores the session from the cookie and removes the old stored copy", async () => {
    window.localStorage.setItem(
      "surgical.admin.auth.session",
      JSON.stringify({ state: { session: { tokens: { refreshToken: "old" } } } })
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope(200, refreshed));

    await useAdminAuthStore.getState().restoreSession();

    expect(useAdminAuthStore.getState().session).toEqual(refreshed);
    expect(useAdminAuthStore.getState().isHydrated).toBe(true);
    expect(window.localStorage.getItem("surgical.admin.auth.session")).toBeNull();
  });

  it("finishes loading signed out when there is no valid cookie", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token." },
          meta: { method: "POST", path: "/", timestamp: "" },
          success: false
        }),
        { status: 401 }
      )
    );

    await useAdminAuthStore.getState().restoreSession();

    expect(useAdminAuthStore.getState().session).toBeNull();
    expect(useAdminAuthStore.getState().isHydrated).toBe(true);
  });

  it("never keeps the session in browser storage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope(200, refreshed));

    await useAdminAuthStore.getState().login("admin@example.com", "Correct-Horse-42");

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
