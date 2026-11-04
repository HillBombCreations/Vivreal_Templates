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
 * VIVREAL-TEMPLATES-H (2026-11-04, a visitor on vivreal.io in the iOS Google
 * app): WebKit also SKIPS a transition, rejecting with "Skipping view
 * transition because viewport size changed." (an unhandled rejection from
 * React's `<ViewTransition>` in `app/layout.tsx`), and skips it when the tab is
 * hidden; `skipTransition()` rejects with "Transition was skipped". The page
 * worked each time, only the animation was dropped. The skip sentences are
 * matched as written; "Transition was skipped" only as the whole message (an
 * error name prefix allowed), so a sentence of ours that merely starts the
 * same way is still reported.
 *
 * No imports, so it runs under `node --test`.
 */
export const IGNORED_BROWSER_ERRORS: RegExp[] = [
  /Transition was aborted because of invalid state/,
  /Transition was aborted because of timeout in DOM update/,
  /Skipping view transition because viewport size changed/,
  /Skipping view transition because document visibility state has become hidden/,
  /^(?:[A-Za-z]+Error: )?Transition was skipped\.?$/,
];
