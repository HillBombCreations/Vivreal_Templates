import { createElement, Fragment, type ElementType, type ReactNode } from 'react';

/**
 * The cookie banner's closing sentence, " See our Privacy Policy.", linked to
 * the policy page this site actually stores, or nothing at all when it stores
 * none.
 *
 * The banner used to hard-code `href="/privacy"`. There is no built-in privacy
 * page (owner decision 2026-10-14), so on a site that stores no page at
 * `/privacy` the link was a 404: help.vivreal.io, walk of 2026-10-21, D4. The
 * root layout already resolves the real page with `resolvePrivacyPolicyHref`
 * for the email popup; the banner takes the same value.
 *
 * Absent href means the whole sentence is dropped, not just the link: "See our
 * Privacy Policy" with nothing to see would be a promise with no page behind it.
 *
 * `Link` is passed in rather than imported because `next/link` does not load
 * under this repo's `node --test`. The banner passes Next's `Link`; the test
 * passes `'a'` and renders the result for real.
 */
export function bannerPolicySentence(privacyHref: string | undefined, Link: ElementType): ReactNode {
  if (!privacyHref) return null;
  return createElement(
    Fragment,
    null,
    ' See our ',
    createElement(
      Link,
      { href: privacyHref, className: 'underline', style: { color: 'var(--primary, inherit)' } },
      'Privacy Policy',
    ),
    '.',
  );
}
