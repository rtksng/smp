// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fetchMock = vi.fn<typeof fetch>();
const imagePath = "catalog/products/images/product.png";
const storageOrigin = "https://pxseurailproxy-production-1f3a.up.railway.app";

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_STORAGE_PUBLIC_URL", storageOrigin);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

function requestImage() {
  return GET(
    new NextRequest(`https://smp-admin.vercel.app/uploads/${imagePath}`, {
      headers: { authorization: "Bearer test", cookie: "admin-session=test" }
    }),
    { params: Promise.resolve({ path: imagePath.split("/") }) }
  );
}

describe("admin catalog image proxy", () => {
  it("follows storage redirects without forwarding admin credentials", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const location = `https://storage.railway.app/catalog-bucket/${imagePath}`;
    fetchMock.mockResolvedValueOnce(
      new Response(null, { headers: { location }, status: 302 })
    );
    fetchMock.mockResolvedValueOnce(
      new Response(png, { headers: { "content-type": "image/png" } })
    );

    const response = await requestImage();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${storageOrigin}/${imagePath}`);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(location);
    for (const [, options] of fetchMock.mock.calls) {
      expect(new Headers(options?.headers).has("cookie")).toBe(false);
      expect(new Headers(options?.headers).has("authorization")).toBe(false);
    }
  });

  it("does not cache missing images", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Missing", { status: 404 }));
    const response = await requestImage();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a non-cacheable response for storage network failures", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection failed"));
    const response = await requestImage();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
