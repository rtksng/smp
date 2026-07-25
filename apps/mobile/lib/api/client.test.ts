import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  buildApiUrl,
  getDevelopmentApiBaseUrl,
  requestApi
} from "./client";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {}
    }
  }
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildApiUrl", () => {
  it("joins a normalized path and omits empty query values", () => {
    expect(
      buildApiUrl(
        "/products",
        { inStock: true, page: 2, search: "", sort: undefined },
        "https://api.example.com/api/v1/"
      )
    ).toBe("https://api.example.com/api/v1/products?inStock=true&page=2");
  });
});

describe("getDevelopmentApiBaseUrl", () => {
  it("uses the iOS simulator loopback address on iOS", () => {
    expect(getDevelopmentApiBaseUrl("ios")).toBe(
      "http://localhost:4000/api/v1"
    );
  });

  it("uses the Android emulator host bridge on Android", () => {
    expect(getDevelopmentApiBaseUrl("android")).toBe(
      "http://10.0.2.2:4000/api/v1"
    );
  });
});

describe("requestApi", () => {
  it("parses the repository success envelope against the requested schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: "product-1", name: "Forceps" },
            meta: {
              method: "GET",
              path: "/api/v1/products/product-1",
              timestamp: "2026-07-25T00:00:00.000Z"
            },
            success: true
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 }
        )
      )
    );

    await expect(
      requestApi(
        "/products/product-1",
        z.object({ id: z.string(), name: z.string() }),
        { baseUrl: "https://api.example.com/api/v1" }
      )
    ).resolves.toEqual({ id: "product-1", name: "Forceps" });
  });

  it("surfaces backend validation messages as a typed API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: null,
            error: {
              code: "BAD_REQUEST",
              message: ["phone must be E.164", "pincode must be 6 digits"]
            },
            meta: {
              method: "POST",
              path: "/api/v1/me/addresses",
              timestamp: "2026-07-25T00:00:00.000Z"
            },
            success: false
          }),
          { headers: { "Content-Type": "application/json" }, status: 400 }
        )
      )
    );

    await expect(
      requestApi("/me/addresses", z.unknown(), {
        baseUrl: "https://api.example.com/api/v1",
        body: {},
        method: "POST"
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "phone must be E.164, pincode must be 6 digits",
      status: 400
    });
  });
});
