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
 * A sign-up form config whose error line tells the truth when the site has no
 * list. With a list, the config comes back as the SAME reference, so every
 * site that can sign people up renders exactly what it did before. With none,
 * a copy whose `copy.errorText` is SIGNUP_UNAVAILABLE_TEXT (the owner's own
 * errorText is about a bad address, which is not what went wrong).
 */
export function withSignupUnavailableCopy<C extends { copy?: { errorText?: string } | null }>(
  config: C | null | undefined,
  collectionId: string,
): C | null {
  if (!config) return null;
  if (collectionId) return config;
  return { ...config, copy: { ...(config.copy ?? {}), errorText: SIGNUP_UNAVAILABLE_TEXT } };
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
