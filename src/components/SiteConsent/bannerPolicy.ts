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
/** The vivreal.io policy, which covers both of Vivreal's own sites (help's footer links it). */
const VIVREAL_PRIVACY_URL = 'https://vivreal.io/privacy';

/**
 * The href the cookie banner links, and ONLY the banner (the email popup keeps
 * the stored page as is).
 *
 * The banner renders only on Vivreal's own sites (`isVivrealOwnSite`). Of
 * those, vivreal.io stores `/privacy` and keeps it; help.vivreal.io stores no
 * policy page, and its own footer already links `https://vivreal.io/privacy`,
 * so its banner links that too rather than dropping the owner-approved "See
 * our Privacy Policy." sentence. Review of 20f26ce on PR #202.
 *
 * A customer site never gets the fallback: Vivreal's policy does not describe
 * a customer's site, and the banner renders nothing there anyway.
 */
export function resolveBannerPrivacyHref(privacyHref: string | undefined, vivrealOwnSite: boolean): string | undefined {
  if (privacyHref) return privacyHref;
  return vivrealOwnSite ? VIVREAL_PRIVACY_URL : undefined;
}

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
