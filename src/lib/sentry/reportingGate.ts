/**
 * V7.319: decides whether this runtime SENDS to Sentry, and under which
 * environment label. The same rule as the portal's
 * `src/lib/sentry/reportingGate.ts`, which has the measurements: 70.8% of the
 * org's error budget was once developers' laptops.
 *
 * Templates had no gate at all: every runtime with a DSN sent, labelled
 * `production` by the SDK's default. It was latent only because no local env
 * file here carries a DSN.
 *
 * VERIFIED BEFORE WRITING THE PREDICATE (2026-10-17, key names only): 26
 * Amplify apps and 24 branches in us-east-1, 0 of them set
 * `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ENVIRONMENT` or `NODE_ENV`, and 21
 * apps set `NEXT_PUBLIC_SENTRY_DSN`. So every live site resolves through
 * `NODE_ENV`, which a Next production build and server set to `production`,
 * and keeps sending. Getting this wrong in the other direction would silence
 * production, so re-check before changing the rule.
 *
 * No imports, so it runs under `node --test`.
 */

/** The one environment whose errors are worth quota. */
export const REPORTING_ENVIRONMENT = 'production';

/** Last-resort label when neither the explicit var nor NODE_ENV is set. */
export const FALLBACK_ENVIRONMENT = 'development';

/**
 * The explicit var wins, so a preview or QA app (built with NODE_ENV
 * production) can be told apart from production with no code change.
 */
export function resolveSentryEnvironment(
  explicit: string | undefined,
  nodeEnv: string | undefined,
): string {
  return explicit?.trim() || nodeEnv?.trim() || FALLBACK_ENVIRONMENT;
}

/**
 * `devOptIn` (`NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV=true`, the portal's name) is
 * the one supported way to test Sentry locally, so nobody comments the gate
 * out to do it.
 */
export function isSentryReportingEnabled({
  environment,
  devOptIn,
}: {
  environment: string;
  devOptIn?: string;
}): boolean {
  if (environment === REPORTING_ENVIRONMENT) return true;
  return devOptIn === 'true';
}
