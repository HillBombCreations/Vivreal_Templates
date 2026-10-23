import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";
import { routerHeaderRefusalRewrites } from "./src/lib/routerHeaderGuard.ts";
import { KEY_FILE_REWRITE } from "./src/lib/indexnow/keyFileRewrite.ts";

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
  // v5 search R4: HSTS on every response. Every fleet host (custom domains,
  // *.vivreal.io subdomains, vivreal.io) is already HTTPS-only behind a 301,
  // so this only tells a browser to skip the plain-HTTP hop next time. One
  // year, the conventional value. NO `includeSubDomains` and NO `preload`:
  // vivreal.io itself is served by this app, and either directive there would
  // bind every *.vivreal.io host, which this app does not own. A browser
  // ignores the header over plain HTTP, so local dev is unaffected.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }],
      },
    ];
  },
  // A request carrying a Next router header without exactly `RSC: 1` (and
  // without `Next-Action`) is answered from the route's prerendered flight,
  // under the page's own `s-maxage`, and Amplify's CDN ignores `Vary`, so one
  // forged request poisons that URL for every visitor. These rules send that
  // shape to a no-store 400 instead. `beforeFiles`, because an `afterFiles`
  // rule never runs for `/` or any filesystem match. See
  // src/lib/routerHeaderGuard.ts.
  async rewrites() {
    return {
      // Discovery batch 2.2: /<32 hex>.txt is the IndexNow key file, answered
      // by /api/indexnow/key/<name> (see src/lib/indexnow/keyFile.ts).
      beforeFiles: [...routerHeaderRefusalRewrites(), KEY_FILE_REWRITE],
      afterFiles: [],
      fallback: [],
    };
  },
  // NOTE: `experimental.viewTransition` was REMOVED here in the Next 16.3.0
  // bump. The flag did not disappear because the feature was dropped — it
  // GRADUATED: "View transitions work in the Next.js App Router with no
  // configuration" (Next's view-transitions guide). 16.3.0 rejects the key as
  // unrecognized, and because `next build` typechecks next.config.ts that was
  // a hard build FAILURE (exit 1), not just the console warning.
  // The `<ViewTransition>` wrappers in src/app/layout.tsx are unaffected and
  // stay enabled — they import from `react`, not from a Next config surface.
  experimental: {
    // BOTH OFF ON PURPOSE. These are security settings, not speed ones. Next
    // 16.3.8 defaults both to true (next/dist/server/config-shared.js) and
    // creates the Turbopack project with `env: process.env`, the WHOLE build
    // environment, for `next build` (next/dist/build/turbopack-build/impl.js)
    // and for `next dev` (next/dist/server/dev/hot-reloader-turbopack.js). So
    // either cache writes every env value into its `*.sst` files, under
    // `.next/cache/turbopack` for a build and `.next/dev/cache/turbopack` for dev.
    // On Amplify, that cache sits in `.next/cache/**`, which every site's
    // generated buildspec (Vivreal_EventHandler src/shared/amplify/buildSpec.js)
    // saved to the app's build cache, together with that site's API_KEY,
    // REVALIDATE_WEBHOOK_SECRET and possibly the fleet packages token
    // (vivreal-hq docs/projects/admin-restyle/
    // research-next-cache-templates-portal-2026-10-21.md). Local dev and build
    // caches did the same thing in worktrees on disk.
    // Cost: no incremental Turbopack reuse between builds and no warm
    // `next dev` restarts. src/lib/turbopackCacheConfig.test.ts fails if
    // either key is removed or set to true, or if the installed Next stops
    // recognising the key name.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
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
      // P0C structural fix (docs/projects/marketing-and-portal-refresh/
      // plan.md, phase P0C, vivreal-hq). VR_Client_API's buildMediaUrl.js no
      // longer hands this app a pre-signed media.vivreal.io URL; it hands a
      // stable link to its own GET /media route, which signs fresh per
      // request and redirects to the real signed media.vivreal.io object.
      // next/image needs the intermediate host allowlisted too, or it 400s
      // an image it has never seen before optimizing.
      {
        protocol: 'https',
        hostname: 'client.vivreal.io',
        pathname: '/media',
      },
      // RT5-164: kit demo content carries Unsplash photo URLs (Old Mill's
      // menu items among them), which next/image answered with a 400 because
      // the host was not listed. Both of Unsplash's image hosts, nothing wider.
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
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
