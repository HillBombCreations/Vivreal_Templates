/**
 * Shared error-string resolution for the fleet's two hand-written contact
 * components (`ContactSection`, `FormLayout` — Task 14 item 9,
 * dashboard-insights-phase-3-capture/plan.md, ux-critique F1/F2). Neither
 * component has an "authored generic" config tier the way the renderer's
 * `ConfigurableForm` does, so the precedence here collapses to two rungs:
 * a specific SERVER string wins; otherwise the component's own built-in
 * fallback.
 *
 * Pure and DOM-free on purpose — this repo's test harness is
 * `node --experimental-strip-types --test` over plain `.test.ts` files, no
 * jsdom, so this is the testable seam for the precedence rule and for the
 * "typed input survives an error response" invariant (a caller that never
 * resets its form state on this path gets that property for free — see
 * `shouldResetContactFormOnSubmit`).
 */
export function resolveContactErrorMessage(serverError: unknown, fallback: string): string {
  if (typeof serverError === "string" && serverError.trim()) return serverError;
  return fallback;
}

/**
 * Task 14 item 9 (ux-critique F3): a visitor's typed input must survive a
 * failed submit. Only a genuine 2xx clears the form. Trivial on purpose —
 * pinned as its own seam so a future refactor can't accidentally widen it.
 */
export function shouldResetContactFormOnSubmit(ok: boolean): boolean {
  return ok === true;
}
