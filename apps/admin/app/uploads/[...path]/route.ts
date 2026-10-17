import { NextRequest } from "next/server";
import { z } from "zod";
import { buildAdminApiProxyResponse, fetchAdminApiProxy } from "../../../lib/api-proxy";

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
    let upstreamResponse = await fetchAdminApiProxy(upstreamUrl, {
      cache: "no-store",
      method: "GET",
      redirect: "manual"
    });
    const redirectLocation = upstreamResponse.headers.get("location");

    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      const redirectTarget = redirectLocation
        ? allowedRedirect(redirectLocation, upstreamUrl)
        : null;

      if (!redirectTarget) {
        return imageUnavailable();
      }

      upstreamResponse = await fetchAdminApiProxy(redirectTarget, {
        cache: "no-store",
        method: "GET",
        redirect: "manual"
      });

      if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
        return imageUnavailable();
      }
    }

    const response = await buildAdminApiProxyResponse(upstreamResponse);
    response.headers.delete("set-cookie");
    const isImage = response.headers.get("content-type")?.startsWith("image/");
    response.headers.set(
      "cache-control",
      response.ok && isImage
        ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
        : "no-store"
    );
    return response;
  } catch {
    return imageUnavailable();
  }
}

// The storage proxy answers with one redirect to the bucket host. Only that
// single hop is followed, and only to the storage origin or an allowed bucket
// host, so a redirect can never make this server fetch an arbitrary URL.
function allowedRedirect(location: string, storageUrl: URL) {
  try {
    const target = new URL(location, storageUrl);
    const allowedHosts = (process.env.STORAGE_REDIRECT_HOSTS ?? "storage.railway.app")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);

    if (target.origin === storageUrl.origin) {
      return target;
    }

    return target.protocol === "https:" && allowedHosts.includes(target.hostname)
      ? target
      : null;
  } catch {
    return null;
  }
}

function getUploadBaseUrl() {
  // Local development serves uploads from the API itself.
  return (
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ??
    process.env.STORAGE_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL
  );
}

function imageUnavailable() {
  return new Response("Unable to load the requested image.", {
    headers: { "cache-control": "no-store" },
    status: 502
  });
}
