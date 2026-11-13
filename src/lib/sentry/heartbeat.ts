/**
 * SW-9 (hotfix 2026-11-13, vivreal-hq hotfix plan T-3, F263, owner OD-3
 * option A): one Sentry Logs line per server process start, so a release can
 * be proved from Sentry. Templates samples every transaction out
 * (`tracesSampleRate: 0`) and a healthy site raises no error, so before this a
 * deployed release left nothing in Sentry to find it by.
 *
 * The line is `service.started` with `{ service, release }`, the same words as
 * the Outreach repos' heartbeat. It is the ONLY Sentry Logs line allowed out
 * of this server: turning logs on for it would otherwise let any
 * `Sentry.logger` call anywhere in the app ship, so `beforeSendLog` drops
 * every other line.
 *
 * Plain module, no `server-only`, so `node --test` drives it.
 */

export const HEARTBEAT_MESSAGE = 'service.started';

/** The repository name, as SW-9 names the service. */
export const HEARTBEAT_SERVICE = 'Vivreal_Templates';

/**
 * How long the heartbeat's own flush may take. Started, never awaited, so it
 * costs a cold start nothing: Amplify compute freezes the process between
 * requests, and the SDK's 5 s log timer alone could wait out a frozen or
 * reclaimed process and never send the line.
 */
export const HEARTBEAT_FLUSH_MS = 2_000;

/**
 * `beforeSendLog`: the heartbeat leaves, every other line is dropped (a
 * `null` answer, `@sentry/core` `logs/internal.js`). Matched on the exact
 * plain-string message, so a parameterised or look-alike line is dropped too.
 */
export function allowOnlyHeartbeat<T extends { message?: unknown }>(log: T): T | null {
  return log.message === HEARTBEAT_MESSAGE ? log : null;
}
