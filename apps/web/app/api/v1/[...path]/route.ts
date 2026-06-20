import { NextRequest } from "next/server";
import { z } from "zod";
import {
  buildCustomerApiProxyHeaders,
  buildCustomerApiProxyResponse,
  buildCustomerApiProxyUrl
} from "../../../../lib/api/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const apiUrlSchema = z.string().url();
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

type CustomerApiProxyContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function proxyCustomerApi(
  request: NextRequest,
  { params }: CustomerApiProxyContext
) {
  const apiBaseUrl = getApiBaseUrl();
  const { path = [] } = await params;
  const upstreamUrl = buildCustomerApiProxyUrl(
    apiBaseUrl,
    path,
    request.nextUrl.search
  );
  const body = BODYLESS_METHODS.has(request.method)
    ? undefined
    : await request.arrayBuffer();

  const upstreamResponse = await fetch(upstreamUrl, {
    body,
    cache: "no-store",
    headers: buildCustomerApiProxyHeaders(request.headers),
    method: request.method,
    redirect: "manual"
  });

  return buildCustomerApiProxyResponse(upstreamResponse);
}

function getApiBaseUrl() {
  const parsed = apiUrlSchema.safeParse(process.env.NEXT_PUBLIC_API_URL);

  if (!parsed.success) {
    throw new Error("NEXT_PUBLIC_API_URL must be set to proxy customer API calls.");
  }

  return parsed.data;
}

export const GET = proxyCustomerApi;
export const POST = proxyCustomerApi;
export const PUT = proxyCustomerApi;
export const PATCH = proxyCustomerApi;
export const DELETE = proxyCustomerApi;
