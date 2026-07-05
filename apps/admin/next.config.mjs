/* global process, URL */

const apiUploadRemotePattern = remotePatternFromUrl(
  process.env.NEXT_PUBLIC_API_URL
);
const storageUploadRemotePattern = remotePatternFromUrl(
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL ??
    process.env.STORAGE_PUBLIC_BASE_URL
);

/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: uniqueRemotePatterns([
      {
        hostname: "smp-production-b700.up.railway.app",
        protocol: "https"
      },
      {
        hostname: "localhost",
        protocol: "http"
      },
      {
        hostname: "127.0.0.1",
        protocol: "http"
      },
      apiUploadRemotePattern,
      storageUploadRemotePattern,
      {
        hostname: "d268wazo8qmwd.cloudfront.net",
        protocol: "https"
      }
    ])
  },
  transpilePackages: ["@surgical/config", "@surgical/types", "@surgical/ui"]
};

export default nextConfig;

function remotePatternFromUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    const protocol = url.protocol.replace(":", "");

    if (protocol !== "http" && protocol !== "https") {
      return null;
    }

    return {
      hostname: url.hostname,
      port: url.port || undefined,
      protocol
    };
  } catch {
    return null;
  }
}

function uniqueRemotePatterns(patterns) {
  const seen = new Set();

  return patterns.filter((pattern) => {
    if (!pattern) {
      return false;
    }

    const key = [
      pattern.protocol,
      pattern.hostname,
      pattern.port ?? "",
      pattern.pathname ?? ""
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
