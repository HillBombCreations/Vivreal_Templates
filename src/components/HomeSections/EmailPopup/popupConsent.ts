/**
 * The consent line props for the renderer's `SubscribeDialog`.
 *
 * The dialog's own default line ends "See our Privacy Policy." with a link to
 * `privacyHref`, and `privacyHref` defaults to `/privacy`. A site that stores
 * no policy page answers 404 there (owner decision 2026-10-14, no invented
 * legal text), so leaving both props unset links every such site's popup to a
 * missing page.
 *
 *  - **Owner-authored `consentText`** wins, verbatim, an empty string
 *    included (the same `??` test the dialog itself applies). The dialog
 *    renders a custom line with no link at all, so it can never point anywhere
 *    missing.
 *  - **A real policy page** (`privacyHref`) keeps the dialog's default line,
 *    and its link now goes to the page the site actually stores.
 *  - **No policy page**: the dialog's default sentence, minus the link.
 *    `consentWithoutPolicyLink` is copied word for word from
 *    `@hillbombcreations/site-renderer` `chrome/SubscribeDialog` (1.86.0) so the
 *    two variants read as the same line, with only the last sentence dropped.
 *
 * Import-free, so the node runner can call it.
 */
export const consentWithoutPolicyLink = (siteName: string): string =>
  `By subscribing, you agree to receive updates from ${siteName}. You can unsubscribe anytime.`;

export function popupConsentProps({
  privacyHref,
  consentText,
  siteName,
}: {
  privacyHref: string | undefined;
  consentText: string | null | undefined;
  siteName: string;
}): { privacyHref?: string; consentText?: string } {
  if (typeof consentText === 'string') return { consentText };
  if (privacyHref) return { privacyHref };
  return { consentText: consentWithoutPolicyLink(siteName) };
}
