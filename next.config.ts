import type { NextConfig } from "next";

/**
 * Two build targets.
 *
 * DEFAULT — the real app. Server-rendered room pages and on-demand OG image
 * generation. Deploy to Vercel (or Cloudflare via OpenNext).
 *
 * PAGES_BUILD=1 — a static export for GitHub Pages previews. GitHub Pages is
 * static-only hosting, so this target CANNOT serve:
 *   · on-demand unfurl cards for arbitrary room codes (only prebuilt ones)
 *   · WebSocket rooms (those live in the Cloudflare Worker regardless)
 * It exists so the UI and the `/demo` flow can be viewed on a real phone over
 * HTTPS — which matters because getUserMedia requires a secure context, so mic
 * recording cannot be tested over plain HTTP at all.
 */
const isPagesBuild = process.env.PAGES_BUILD === "1";

// Project Pages are served from /<repo>, so assets need the prefix.
const repoBase = process.env.PAGES_BASE_PATH ?? "/Aux";

const nextConfig: NextConfig = {
  ...(isPagesBuild
    ? {
        output: "export" as const,
        basePath: repoBase,
        assetPrefix: repoBase,
        // The export target has no Image Optimization server
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
