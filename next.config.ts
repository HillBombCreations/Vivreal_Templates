import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";
import { routerHeaderRefusalRewrites } from "./src/lib/routerHeaderGuard.ts";
import { KEY_FILE_REWRITE } from "./src/lib/indexnow/keyFileRewrite.ts";
import { ISR_REVALIDATE_SECONDS } from "./src/lib/renderMode.ts";
import { parseSiteCacheTtlSeconds } from "./src/lib/siteCacheTtl.ts";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.0.0.90'],
  transpilePackages: ['@hillbombcreations/site-renderer'],
  // `expireTime` decides whether an ISR page regenerates in the BACKGROUND or
  // in the FOREGROUND, and it must never exceed the page's effective
  // `revalidate`: `ISR_REVALIDATE_SECONDS`, or the data TTL when that is lower.
  //
  // 2026-10-21: at most the route `revalidate` (300), was 3600. Reason, from
  // vivreal-hq research-stale-nostore-2026-10-21.md and
  // design-isr-foreground-regeneration-2026-10-21.md:
  //   - Between `revalidate` and `expireTime` Next answers the visitor with the
  //     STALE page at once and regenerates in the background. Amplify compute
  //     freezes the process as soon as the response is sent, so that
  //     background regeneration's reads to VR_Client_API are frozen mid flight,
  //     their sockets are dead by the next request, every retry dies the same
  //     way, and Next keeps the old page and tries again. On a quiet site the
  //     page stayed STALE (sent by Amplify as bare `no-store`, so nothing was
  //     cached at the edge) until a new instance started. Fleet wide since
  //     10-07, 1,825 of 1,830 `[clientFetch]` failures had been in flight
  //     across a freeze.
  //   - Past `expireTime` Next regenerates in the FOREGROUND, inside the
  //     visitor's own request, which Amplify keeps awake until the response
  //     is sent, so it finishes like any per-request page.
  //   - Equal is the largest safe value. Anything above the page's
  //     `revalidate` reopens a background window between the two, and a
  //     request landing there starts a regeneration that starves. Below it
  //     there is no background window either; the page just regenerates in
  //     the foreground sooner. Next accepts equality: its header composer only
  //     appends `stale-while-revalidate` when `revalidate < expire`, so the
  //     header is plain `s-maxage=<revalidate>`.
  //   - The page's effective `revalidate` is the LOWEST of the route literal
  //     and every cached read it makes, and every cached read uses the one
  //     `SITE_CACHE_TTL_SECONDS`, so a TTL below 300 lowers it too. Measured:
  //     with that env unset (the code default, 60) and `expireTime` 300, the
  //     build listed `/` as Revalidate 1m, Expire 5m, a background window
  //     from 60 s to 300 s. So this is `min(300, TTL)`, parsed by the same
  //     function client.ts uses (`src/lib/siteCacheTtl.ts`): 60 when unset,
  //     300 at the provisioner's 300 (Vivreal_EventHandler serverless.yml)
  //     and above. It clamps `expireTime` DOWN, never the data TTL UP, which
  //     has to stay under the signed media URL lifetime (client.ts).
  //     src/lib/renderMode.test.ts evaluates the shipped config at TTL unset,
  //     60, 300 and 86400.
  //   - Not covered: after a FAILED render Next re-stores the old page with
  //     revalidate 3..30 against the same expire (`response-cache/index.js`),
  //     so until that expire a background regeneration can still start. That
  //     residual window predates this setting.
  //
  // What this gives up, accepted by the owner on 2026-10-21: the edge
  // `stale-while-revalidate` cushion. The 3600 it replaces was chosen in ISR
  // migration Phase 4 (blocker 2) because on 2026-08-31 that window kept `/`
  // and `/privacy` serving correct content at `Age: 552` while dynamic routes
  // returned 504, and because Next's default (one year,
  // `stale-while-revalidate=31535700`) left an unbounded stale tail. Measured
  // locally on 2026-10-21 (`next start`, upstream made unreachable): the first
  // request after a 300 s window answers 500 (21 bytes, no Cache-Control),
  // warm instance or cold, because Next marks a past-`expireTime`
  // regeneration as on-demand and `unstable_cache` then skips the data cache
  // entirely, so there is no last good data to fall back to. The next request
  // gets the last good page for up to 30 s. A degraded render still never
  // enters the page cache that way (`bailOutOfCachingDegradedRender()` in
  // src/lib/renderGate.ts). The first visitor after each 300 s window waits
  // for one render (0.6 to 2.6 s measured locally).
  expireTime: Math.min(ISR_REVALIDATE_SECONDS, parseSiteCacheTtlSeconds(process.env.SITE_CACHE_TTL_SECONDS)),
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
