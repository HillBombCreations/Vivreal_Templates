/**
 * V7.319: browser errors that are noise, dropped before they count against the
 * error quota (Sentry `ignoreErrors`, matched against the event message).
 *
 * The View Transition API rejects its promises when a transition is abandoned:
 * the visitor navigates again mid transition, or the DOM update takes too
 * long. Nothing is broken for the visitor; the page simply swaps without the
 * animation. About 2.5 a day reached Sentry (research-sentry-quota-2026-10-17.md,
 * rank 12), from HeadlessChrome and Mobile Safari. The wording is Chromium's
 * ("Transition was aborted because of invalid state" was seen on the v5 walk
 * of halo and larkspur). Matched on the transition wording, never on the bare
 * error name, so a real `TimeoutError` or `InvalidStateError` from anything
 * else is still reported.
 *
 * No imports, so it runs under `node --test`.
 */
export const IGNORED_BROWSER_ERRORS: RegExp[] = [
  /Transition was aborted because of invalid state/,
  /Transition was aborted because of timeout in DOM update/,
];
