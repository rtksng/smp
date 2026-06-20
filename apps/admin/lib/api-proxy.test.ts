import { describe, expect, it } from "vitest";
import {
  buildAdminApiProxyHeaders,
  buildAdminApiProxyResponse,
  buildAdminApiProxyUrl
} from "./api-proxy";

describe("admin API proxy helpers", () => {
  it("builds upstream API URLs from path segments and the original query string", () => {
    const url = buildAdminApiProxyUrl(
      "https://api.example.com/api/v1/",
      ["admin", "products", "demo forceps"],
      "?limit=4"
    );

    expect(url.toString()).toBe(
      "https://api.example.com/api/v1/admin/products/demo%20forceps?limit=4"
    );
  });

  it("keeps API headers while removing hop-by-hop request headers", () => {
    const headers = buildAdminApiProxyHeaders(
      new Headers({
        Accept: "application/json",
        Authorization: "Bearer token",
        Connection: "keep-alive",
        "Content-Length": "100",
        "Content-Type": "application/json",
        Host: "admin.example"
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
    const response = await buildAdminApiProxyResponse(
      new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Encoding": "br",
          "Content-Length": "16",
          "Content-Type": "application/json",
          Etag: 'W/"10-demo"'
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
  });

  it("normalizes created responses so Vercel preserves successful login bodies", async () => {
    const response = await buildAdminApiProxyResponse(
      new Response(JSON.stringify({ data: { tokens: {} }, success: true }), {
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
        tokens: {}
      },
      success: true
    });
  });
});
