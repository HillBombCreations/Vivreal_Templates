import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.0.0.90'],
  transpilePackages: ['@hillbombcreations/site-renderer'],
  // ISR migration Phase 4, blocker 2 — the `stale-while-revalidate` window a CDN
  // is allowed to serve an ISR page past its `s-maxage`.
  //
  // Next's default is 31536000 (one year), and `getCacheControlHeader` emits
  // `expire - revalidate`, which is where the fleet's observed
  // `s-maxage=300, stale-while-revalidate=31535700` came from. Nobody chose that
  // number. CloudFront honours it, and on 2026-08-31 that is how an
  // `s-maxage=300` object was served at `Age: 599` as an ordinary `X-Cache: Hit`
  // (also seen at 509, 516, 519, 552) and how two POPs served two different
  // versions of the same URL simultaneously.
  //
  // 3600 is chosen, and the tradeoff is real in BOTH directions:
  //   - A very short window would have removed the thing that kept `/` and
  //     `/privacy` serving correct content at `Age: 552` while every dynamic
  //     route on the same site returned 504 during the same incident. That
  //     resilience is the strongest result the ISR pilot produced.
  //   - One year is indefensible: the post-edit and post-incident stale tail is
  //     unbounded in practice, and Amplify offers no edge invalidation, so there
  //     is no way to cut it short.
  // One hour caps the tail at something a human would tolerate while keeping
  // most of the outage resilience. It is defensible only BECAUSE the degraded
  // render can no longer enter the cache at all (blocker 1,
  // `bailOutOfCachingDegradedRender()` in src/lib/renderGate.ts) — a longer
  // stale window is only safe when what goes stale was correct to begin with.
  //
  // Matches the framework's own documented example
  // (`node_modules/next/dist/docs/.../expireTime.md`, "one hour in seconds").
  // Effect on a 300s route: `s-maxage=300, stale-while-revalidate=3300`.
  expireTime: 3600,
  // NOTE: `experimental.viewTransition` was REMOVED here in the Next 16.3.0
  // bump. The flag did not disappear because the feature was dropped — it
  // GRADUATED: "View transitions work in the Next.js App Router with no
  // configuration" (Next's view-transitions guide). 16.3.0 rejects the key as
  // unrecognized, and because `next build` typechecks next.config.ts that was
  // a hard build FAILURE (exit 1), not just the console warning.
  // The `<ViewTransition>` wrappers in src/app/layout.tsx are unaffected and
  // stay enabled — they import from `react`, not from a Next config surface.
  images: {
    // Pre-cutover migration previews carry source-domain media URLs
    // (e.g. abakeshop.com/cdn/...) that aren't in remotePatterns, so next/image
    // 400s them and pages 500 — which reads as broken/404 during QA. The env
    // gate emits plain <img> for those local preview runs only; unset (every
    // production/Amplify build) keeps optimization on, byte-identical config.
    unoptimized: process.env.VIVREAL_PREVIEW_UNOPTIMIZED === '1',
    // Serve SVG logos through next/image. The Vivreal media pipeline stores SVGs
    // as-is and the client API serves them as `image/svg+xml` (VR_CMS_API does
    // NOT rasterize vectors), so a migrated inline-<svg> or CSS-background SVG
    // logo reaches next/image as an SVG. next/image blocks SVG optimization by
    // default (HTTP 400), which rendered such logos broken on live sites. Enable
    // it, but neutralize the SVG-XSS vector the "dangerously" refers to: force a
    // download disposition and a locked-down CSP that forbids scripts and
    // sandboxes the response, so a hostile SVG cannot execute.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.vivreal.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.us-east-1.amazonaws.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname, "src");
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // Disable source map upload for template sites (no SENTRY_AUTH_TOKEN)
  sourcemaps: {
    disable: true,
  },
  silent: true,
});
