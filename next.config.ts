import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.0.0.90'],
  transpilePackages: ['@hillbombcreations/site-renderer'],
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
