/**
 * The `<title>` for one item detail page (`[slug]/[itemId]/page.tsx`'s
 * `generateMetadata`) on the arms that title an item from the page config
 * alone: team, menu and the default arm products reach.
 *
 * RT5-166: a team member and a menu item are titled by their own name, not by
 * the page's. The page's `seo.metaTitle` is authored for the roster or the
 * menu ("The barbers | Brightside", "Menu | The Old Mill Bakehouse") and used
 * to title every item under it. It stays the fallback for an item with no
 * name, and for a lookup that found nothing. Every other format (products
 * among them) keeps the page-level title it always had.
 *
 * Pure, no imports beyond a sibling, so it runs under plain `node --test`
 * (`page.tsx` is JSX and cannot be loaded by that runner at all).
 */

import { detailItemMetaText } from './detailItemMetaText.ts';

export interface ItemTitlePage {
  format: string;
  name: string;
  seo?: { metaTitle?: string };
}

/** A team member (`name`) or a menu item (`title`), as the arms read them. */
export interface ItemTitleItem {
  name?: unknown;
  title?: unknown;
}

/** A menu item's own title, trimmed, or undefined when it has none. */
export function menuItemOwnTitle(item: ItemTitleItem | undefined): string | undefined {
  return typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : undefined;
}

export function itemPageTitle(
  page: ItemTitlePage,
  item: ItemTitleItem | undefined,
  siteName: string,
): string {
  const pageTitle = page.seo?.metaTitle;

  if (page.format === 'team') {
    const name = typeof item?.name === 'string' && item.name ? item.name : undefined;
    return (name ? `${name} | ${siteName}` : undefined) || pageTitle || `Team Member | ${siteName}`;
  }

  if (page.format === 'menu') {
    const itemTitle = menuItemOwnTitle(item);
    if (itemTitle) {
      // The same item-first resolver as the collection arm, so a menu item and
      // a catalog entry are titled by one rule.
      return detailItemMetaText({
        itemTitle,
        itemDescription: undefined,
        siteName,
        patternTitle: undefined,
        patternDescription: undefined,
        pageMetaTitle: pageTitle,
        pageMetaDescription: undefined,
        pageSubtitle: undefined,
        pageName: page.name,
      }).title;
    }
  }

  return pageTitle || `${page.name} | ${siteName}`;
}
