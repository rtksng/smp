/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
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
      }
    ]
  },
  transpilePackages: ["@surgical/config", "@surgical/types", "@surgical/ui"]
};

export default nextConfig;
