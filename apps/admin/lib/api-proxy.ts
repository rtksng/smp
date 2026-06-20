const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "etag",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

export function buildAdminApiProxyUrl(
  apiBaseUrl: string,
  pathSegments: string[],
  search = ""
) {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const path = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(path ? `${baseUrl}/${path}` : baseUrl);
  url.search = search;

  return url;
}

export function buildAdminApiProxyHeaders(input: Headers) {
  const headers = new Headers();

  input.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

export async function buildAdminApiProxyResponse(upstreamResponse: Response) {
  const body = new Uint8Array(await upstreamResponse.arrayBuffer());
  const status = upstreamResponse.status === 201 ? 200 : upstreamResponse.status;
  const statusText =
    upstreamResponse.status === 201 ? "OK" : upstreamResponse.statusText;

  return new Response(body, {
    headers: buildAdminApiProxyHeaders(upstreamResponse.headers),
    status,
    statusText
  });
}
