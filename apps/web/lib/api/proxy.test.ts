import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CustomerApiProxyTimeoutError,
  buildCustomerApiProxyHeaders,
  buildCustomerApiProxyErrorResponse,
  buildCustomerApiProxyResponse,
  buildCustomerApiProxyUrl,
  fetchCustomerApiProxy,
  normalizeCustomerApiBaseUrl
} from "./proxy";

describe("customer API proxy helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("builds upstream API URLs from path segments and the original query string", () => {
    const url = buildCustomerApiProxyUrl(
      "https://api.example.com/api/v1/",
      ["products", "demo forceps", "related"],
      "?limit=4"
    );

    expect(url.toString()).toBe(
      "https://api.example.com/api/v1/products/demo%20forceps/related?limit=4"
    );
  });

  it("normalizes Railway API origins that omit the version path", () => {
    expect(
      normalizeCustomerApiBaseUrl("https://smp-production-bfda.up.railway.app")
    ).toBe("https://smp-production-bfda.up.railway.app/api/v1");
    expect(
      normalizeCustomerApiBaseUrl(
        "https://smp-production-bfda.up.railway.app/api/v1/"
      )
    ).toBe("https://smp-production-bfda.up.railway.app/api/v1");
  });

  it("keeps API headers while removing hop-by-hop request headers", () => {
    const headers = buildCustomerApiProxyHeaders(
      new Headers({
        Accept: "application/json",
        Authorization: "Bearer token",
        Connection: "keep-alive",
        "Content-Length": "100",
        "Content-Type": "application/json",
        Host: "shop.example"
      })
    );

    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.has("Connection")).toBe(false);
    expect(headers.has("Content-Length")).toBe(false);
    expect(headers.has("Host")).toBe(false);
  });

  it("returns the upstream response body from the proxy response", async () => {
    const response = await buildCustomerApiProxyResponse(
      new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Encoding": "br",
          "Content-Type": "application/json",
          "Content-Length": "16",
          Etag: 'W/"10-demo"',
          Server: "railway-hikari",
          "X-Hikari-Trace": "sin1.tr00",
          "X-Railway-Edge": "sin1",
          "X-Railway-Request-Id": "request-id"
        },
        status: 200
      })
    );

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.has("Content-Encoding")).toBe(false);
    expect(response.headers.has("Content-Length")).toBe(false);
    expect(response.headers.has("Etag")).toBe(false);
    expect(response.headers.has("Server")).toBe(false);
    expect(response.headers.has("X-Hikari-Trace")).toBe(false);
    expect(response.headers.has("X-Railway-Edge")).toBe(false);
    expect(response.headers.has("X-Railway-Request-Id")).toBe(false);
  });

  it("normalizes created responses so customer mutation bodies are preserved", async () => {
    const response = await buildCustomerApiProxyResponse(
      new Response(JSON.stringify({ data: { id: "address_1" }, success: true }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 201,
        statusText: "Created"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        id: "address_1"
      },
      success: true
    });
  });

  it("aborts slow upstream proxy requests", async () => {
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

    const request = fetchCustomerApiProxy(
      new URL("https://api.example.com/api/v1/products"),
      {
        method: "GET"
      },
      25
    );
    const expectation = expect(request).rejects.toThrow(
      CustomerApiProxyTimeoutError
    );

    await vi.advanceTimersByTimeAsync(25);

    await expectation;
  });

  it("returns sanitized proxy error envelopes without leaking upstream internals", async () => {
    const response = buildCustomerApiProxyErrorResponse(
      new CustomerApiProxyTimeoutError(),
      {
        method: "GET",
        path: "/api/v1/products"
      }
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      data: null,
      error: {
        code: "CUSTOMER_API_TIMEOUT",
        message: "Customer API request timed out. Try again in a moment."
      },
      meta: {
        method: "GET",
        path: "/api/v1/products"
      },
      success: false
    });
  });
});
