import { NextRequest } from "next/server";
import { z } from "zod";
import {
  buildCustomerApiProxyHeaders,
  buildCustomerApiProxyResponse,
  fetchCustomerApiProxy
} from "../../../lib/api/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const urlSchema = z.string().url();

type UploadProxyContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: NextRequest, { params }: UploadProxyContext) {
  const parsedUploadBaseUrl = urlSchema.safeParse(getUploadBaseUrl());

  if (!parsedUploadBaseUrl.success) {
    return new Response("Upload service is not configured.", { status: 503 });
  }

  const { path = [] } = await params;
  const uploadPath = path.map(encodeURIComponent).join("/");
  const upstreamUrl = new URL(
    `/${uploadPath}${request.nextUrl.search}`,
    new URL(parsedUploadBaseUrl.data).origin
  );

  try {
    let upstreamResponse = await fetchCustomerApiProxy(upstreamUrl, {
      cache: "no-store",
      headers: buildCustomerApiProxyHeaders(request.headers),
      method: "GET",
      redirect: "manual"
    });

    const redirectLocation = upstreamResponse.headers.get("location");

    if (
      upstreamResponse.status >= 300 &&
      upstreamResponse.status < 400 &&
      redirectLocation
    ) {
      upstreamResponse = await fetch(new URL(redirectLocation, upstreamUrl), {
        cache: "no-store",
        redirect: "follow"
      });
    }

    return buildCustomerApiProxyResponse(upstreamResponse);
  } catch {
    return new Response("Unable to load the requested image.", { status: 502 });
  }
}

function getUploadBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ??
    process.env.STORAGE_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL
  );
}
