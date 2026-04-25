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
