import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.0.0.90'],
  transpilePackages: ['@hillbombcreations/site-renderer'],
  experimental: {
    // Enables React's View Transitions API integration — used by
    // `<ViewTransition>` wrappers in the root layout to animate route
    // changes. Browsers without support (Safari <18) degrade gracefully.
    viewTransition: true,
  },
  images: {
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
