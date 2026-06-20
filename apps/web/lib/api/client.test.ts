import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ApiClientError,
  ApiValidationError,
  type ApiResponseEnvelope,
  buildApiUrl,
  requestApi
} from "./client";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe("web API client", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api/v1";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
  });

  it("builds customer API URLs from NEXT_PUBLIC_API_URL and query params", () => {
    const url = buildApiUrl("/products", {
      limit: 6,
      search: "forceps kit",
      sterile: true,
      unused: undefined
    });

    expect(url.toString()).toBe(
      "https://api.example.com/api/v1/products?limit=6&search=forceps+kit&sterile=true"
    );
  });

  it("routes browser calls for Railway API hosts through the same-origin proxy", () => {
    process.env.NEXT_PUBLIC_API_URL =
      "https://smp-production-b700.up.railway.app/api/v1";

    const url = buildApiUrl("/products/demo-forceps/related", {
      limit: 4
    });

    expect(url.toString()).toBe(
      `${window.location.origin}/api/v1/products/demo-forceps/related?limit=4`
    );
  });

  it("parses successful API envelopes through the supplied Zod schema", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { name: "Surgical Forceps" },
          meta: {
            method: "GET",
            path: "/api/v1/products",
            timestamp: "2026-05-25T10:00:00.000Z"
          },
          success: true
        }),
        { status: 200 }
      )
    );

    await expect(
      requestApi("/products", z.object({ name: z.string() }))
    ).resolves.toEqual({ name: "Surgical Forceps" });
  });

  it("disables fetch caching by default for customer API reads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { name: "Surgical Forceps" },
          meta: {
            method: "GET",
            path: "/api/v1/products",
            timestamp: "2026-05-25T10:00:00.000Z"
          },
          success: true
        }),
        { status: 200 }
      )
    );

    await requestApi("/products", z.object({ name: z.string() }));

    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.cache).toBe(
      "no-store"
    );
  });

  it("throws a typed API error for failed envelopes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          error: {
            code: "NOT_FOUND",
            message: "Product was not found."
          },
          meta: {
            method: "GET",
            path: "/api/v1/products/missing",
            timestamp: "2026-05-25T10:00:00.000Z"
          },
          success: false
        }),
        { status: 404 }
      )
    );

    await expect(requestApi("/products/missing", z.unknown())).rejects.toThrow(
      new ApiClientError("Product was not found.", 404, "NOT_FOUND")
    );
  });

  it("throws validation errors with all backend validation messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          error: {
            code: "Bad Request",
            message: [
              "shippingAddressId must be a string",
              "paymentMethod must be one of COD, ONLINE"
            ]
          },
          meta: {
            method: "POST",
            path: "/api/v1/orders",
            timestamp: "2026-05-25T10:00:00.000Z"
          },
          success: false
        }),
        { status: 400 }
      )
    );

    await expect(requestApi("/orders", z.unknown())).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      messages: [
        "shippingAddressId must be a string",
        "paymentMethod must be one of COD, ONLINE"
      ],
      message:
        "shippingAddressId must be a string, paymentMethod must be one of COD, ONLINE",
      status: 400
    } satisfies Partial<ApiValidationError>);
  });

  it("normalizes network failures into typed API client errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(requestApi("/products", z.unknown())).rejects.toThrow(
      new ApiClientError(
        "Unable to reach the customer API. Check your connection and try again.",
        0,
        "NETWORK_ERROR"
      )
    );
  });

  it("exports typed API response envelope wrappers", () => {
    const response = {
      data: { id: "product_1" },
      meta: {
        method: "GET",
        path: "/api/v1/products/product_1",
        timestamp: "2026-05-25T10:00:00.000Z"
      },
      success: true
    } satisfies ApiResponseEnvelope<{ id: string }>;

    expect(response.data.id).toBe("product_1");
  });

  it("adds bearer auth and retries once with a refreshed token after unauthorized responses", async () => {
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
              path: "/api/v1/account/profile",
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
            data: { id: "user_1" },
            meta: {
              method: "GET",
              path: "/api/v1/account/profile",
              timestamp: "2026-05-25T10:00:01.000Z"
            },
            success: true
          }),
          { status: 200 }
        )
      );
    const clearSession = vi.fn();

    await expect(
      requestApi("/account/profile", z.object({ id: z.string() }), {
        auth: {
          clearSession,
          getAccessToken: () => "expired-access-token",
          refreshAccessToken: async () => "fresh-access-token"
        }
      })
    ).resolves.toEqual({ id: "user_1" });

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
});
