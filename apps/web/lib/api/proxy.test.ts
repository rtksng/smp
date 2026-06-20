import { describe, expect, it } from "vitest";
import {
  buildCustomerApiProxyHeaders,
  buildCustomerApiProxyResponse,
  buildCustomerApiProxyUrl
} from "./proxy";

describe("customer API proxy helpers", () => {
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
          "Content-Type": "application/json",
          "Content-Length": "16"
        },
        status: 200
      })
    );

    await expect(response.json()).resolves.toEqual({ success: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.has("Content-Length")).toBe(false);
  });
});
