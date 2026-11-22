import type { MetadataRoute } from "next";

// Only public prototype pages (/p/*) are crawlable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/p/", "/og/"], disallow: "/" }],
  };
}
