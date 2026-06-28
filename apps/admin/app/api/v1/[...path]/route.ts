import { NextRequest } from "next/server";
import { z } from "zod";
import {
  buildAdminApiProxyErrorResponse,
  buildAdminApiProxyHeaders,
  buildAdminApiProxyResponse,
  buildAdminApiProxyUrl,
  fetchAdminApiProxy
} from "../../../../lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const apiUrlSchema = z.string().url();
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

type AdminApiProxyContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function proxyAdminApi(
  request: NextRequest,
  { params }: AdminApiProxyContext
) {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const { path = [] } = await params;
    const upstreamUrl = buildAdminApiProxyUrl(
      apiBaseUrl,
      path,
      request.nextUrl.search
    );
    const body = BODYLESS_METHODS.has(request.method)
      ? undefined
      : await request.arrayBuffer();

    const upstreamResponse = await fetchAdminApiProxy(upstreamUrl, {
      body,
      cache: "no-store",
      headers: buildAdminApiProxyHeaders(request.headers),
      method: request.method,
      redirect: "manual"
    });

    return buildAdminApiProxyResponse(upstreamResponse);
  } catch (error) {
    return buildAdminApiProxyErrorResponse(error, {
      method: request.method,
      path: request.nextUrl.pathname
    });
  }
}

function getApiBaseUrl() {
  const parsed = apiUrlSchema.safeParse(process.env.NEXT_PUBLIC_API_URL);

  if (!parsed.success) {
    throw new Error("NEXT_PUBLIC_API_URL must be set to proxy admin API calls.");
  }

  return parsed.data;
}

export const GET = proxyAdminApi;
export const POST = proxyAdminApi;
export const PUT = proxyAdminApi;
export const PATCH = proxyAdminApi;
export const DELETE = proxyAdminApi;
