/**
 * The one place this site decides which subscribers list its email sign-up
 * forms post to: the footer newsletter, the hero and home-section captures,
 * the floating panel (all through `onSubscribe` in Providers) and the popup
 * (EmailPopup, after its own Studio override).
 *
 * N-C6 (walk C, 2026-10-16). This used to read ONLY the synthetic
 * `subscribers` page that VR_Client_API's getSiteDetails adds when the site
 * LINKS a subscribers list (`site.collectionGroups`). Kit-built sites seed
 * their list without linking it, so they had no such page, every form posted
 * `collectionId: ''`, /api/subscribe answered 400, and the visitor was told
 * their (valid) address was invalid. Measured read-only the same day: 1 of 23
 * sites links its list.
 *
 * Precedence:
 *   1. the subscribe block binding on the synthetic `subscribers` page,
 *   2. that page's legacy `collectionId`. Legs 1 and 2 are the old chain,
 *      byte for byte, so a site that resolves today keeps the same list.
 *   3. `subscribersCollectionId`, the list VR_Client_API resolves for a site
 *      with NO linked list (the list the site claims: its popup's list, or
 *      the one tagged `site:<id>` or `site:<subdomain>`, the same claim rule
 *      Campaigns and the People board use). Absent on an older API ⇒ skipped.
 *   4. `''`: no list. Callers must not post (see `subscribeUser`), and show
 *      `SIGNUP_UNAVAILABLE_TEXT` rather than an email-format error.
 */

/** Visitor-facing copy for a form whose site has no list to sign up to. */
export const SIGNUP_UNAVAILABLE_TEXT =
  'Sorry, this site is not taking sign ups yet. Your email was not saved.';

interface SubscribersBindingLike {
  collectionId?: string | null;
}

interface SubscribersBlockLike {
  type?: { kind?: string; dispatchId?: string } | null;
  config?: { bindings?: SubscribersBindingLike[] | null } | null;
}

interface SubscribersPageLike {
  format?: string;
  collectionId?: string | null;
  blocks?: SubscribersBlockLike[] | null;
}

export interface SubscribersListSource {
  pageConfigs?: SubscribersPageLike[] | null;
  subscribersCollectionId?: string | null;
}

/**
 * The footer newsletter config with an error line that tells the truth.
 *
 *  - No list: `copy.errorText` AND `copy.failedText` are
 *    SIGNUP_UNAVAILABLE_TEXT (a stored errorText is about a bad address,
 *    which is not what went wrong). Renderer 1.88.1 shows errorText for a bad
 *    address only and failedText for a failed send, and with no list every
 *    send fails, so the failed-send line is the one a visitor actually sees.
 *  - A list (V7.236, walk C N-C13): a stored `copy.errorText` is DROPPED. The
 *    renderer (1.88.0, `signupErrorText`) shows an authored errorText for a
 *    bad address AND for a failed send, so a stored "Please enter a valid
 *    email address." told a visitor whose sign up failed on the server that
 *    their correct address was wrong. Without it the renderer uses its own
 *    two lines. Nothing an owner set is lost: Studio's footer editor has no
 *    error line field (FooterEditor edits heading, subtitle and button).
 *    A config with no errorText comes back as the SAME reference.
 */
export function withSignupUnavailableCopy<
  C extends { copy?: { errorText?: string; failedText?: string } | null },
>(
  config: C | null | undefined,
  collectionId: string,
): C | null {
  if (!config) return null;
  if (!collectionId) {
    return {
      ...config,
      copy: { ...(config.copy ?? {}), errorText: SIGNUP_UNAVAILABLE_TEXT, failedText: SIGNUP_UNAVAILABLE_TEXT },
    };
  }
  if (!config.copy || !('errorText' in config.copy)) return config;
  const copy = { ...config.copy };
  delete copy.errorText;
  return { ...config, copy };
}

/**
 * The popup's error line (V7.236). Unlike the footer's, the popup's "Error
 * message" is the owner's to edit in Studio (EmailPopupEditor), and Studio
 * seeds it with the bad-address line. So it stays the bad-address line until
 * a send fails; after that the renderer gets no authored line and says the
 * email was not saved (or, for a bad address, its own bad-address line).
 * `lastSendFailed` is reset by the next send.
 */
export function popupErrorText({
  collectionId,
  ownerErrorText,
  lastSendFailed,
}: {
  collectionId: string;
  ownerErrorText: string | undefined;
  lastSendFailed: boolean;
}): string | undefined {
  if (!collectionId) return SIGNUP_UNAVAILABLE_TEXT;
  return lastSendFailed ? undefined : ownerErrorText;
}

/**
 * The popup's failed-send line (renderer 1.88.1 `failedText`). With no list,
 * `subscribeUser` refuses before any request, so every send fails, and the
 * true line is that sign ups are not open. With a list, undefined: the
 * renderer's own "not saved" line.
 */
export function popupFailedText(collectionId: string): string | undefined {
  return collectionId ? undefined : SIGNUP_UNAVAILABLE_TEXT;
}

export function resolveSubscribersCollectionId(
  site: SubscribersListSource | null | undefined,
): string {
  const subPage = site?.pageConfigs?.find((p) => p?.format === 'subscribers');
  const linked =
    subPage?.blocks
      ?.find((b) => b?.type?.kind === 'page-template' && b?.type?.dispatchId === 'subscribe')
      ?.config?.bindings?.find((bd) => bd?.collectionId)?.collectionId ??
    subPage?.collectionId ??
    '';
  if (linked) return linked;
  const claimed = site?.subscribersCollectionId;
  return typeof claimed === 'string' ? claimed.trim() : '';
}
