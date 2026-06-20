const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

export function buildCustomerApiProxyUrl(
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

export function buildCustomerApiProxyHeaders(input: Headers) {
  const headers = new Headers();

  input.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

export async function buildCustomerApiProxyResponse(upstreamResponse: Response) {
  const body = await upstreamResponse.arrayBuffer();

  return new Response(body, {
    headers: buildCustomerApiProxyHeaders(upstreamResponse.headers),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText
  });
}
