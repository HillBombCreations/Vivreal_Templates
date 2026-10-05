/**
 * The title, description and OG/Twitter card title for ONE generic collection
 * item detail page (a blog post, a catalog entry, a recipe, any page
 * `servesCollectionDetail` claims) — the counterpart to `productItemMetaText`
 * for a provider-sourced product, used by `[slug]/[itemId]/page.tsx`'s
 * `generateMetadata` for every OTHER format that fetches its item.
 *
 * THE BUG THIS FIXES (2026-10-04): vivreal.io's `/blog` is `format: 'list'`
 * WITH a `detailPage` authored (`itemCollectionId`, `itemKeyField`, and a
 * `seo.titlePattern` of `{item.title}`), so the old gate (`hasDetailRouteConfig
 * || isRecipe`) was already true and the item was already fetched. The bug was
 * ordering: the old chain put the PAGE's own `seo.metaTitle`/`metaDescription`
 * ahead of the item/pattern, so the listing page's generic
 * `<title>Blog | Vivreal</title>` always outranked the post's own
 * `{item.title}` pattern, even though the SAME item's JSON-LD a few lines
 * below (the render path, which fetches the item unconditionally for this
 * format) always carried the real title and excerpt. This function reverses
 * that precedence. The gate widening below (`servesCollectionDetail`) is a
 * separate, real fix for 14 OTHER pages (Help, bakery/catalog shops,
 * what's-on) whose pages genuinely authored no `detailPage` at all — it does
 * nothing for vivreal.io, where the gate was never the problem.
 *
 * ITEM DATA WINS. A page-level value (`pageMetaTitle`, `pageMetaDescription`,
 * `pageSubtitle`, `pageName`) is a fallback for when the item has none, never
 * an override of one it does — the ordering bug above was exactly a page
 * value (a `seo.metaTitle` authored for the LISTING page) outranking an item
 * value that existed. An authored per-item pattern (`detailPage.seo`'s
 * `titlePattern`/`descriptionPattern`) is more specific still and wins over
 * both.
 *
 * Pure, no imports beyond a sibling, so it runs under plain `node --test`
 * (`page.tsx` is JSX and cannot be loaded by that runner at all).
 */

import { plainMeta } from './plainMeta.ts';

export interface DetailItemMetaInput {
  /** The item's own title, already resolved (context overlay applied). */
  itemTitle: string | undefined;
  /** The item's own description/excerpt field. Rich text; cleaned here. */
  itemDescription: unknown;
  /**
   * A recipe's `summary` field (`readRecipeFields`), checked AHEAD of
   * `itemDescription`: a recipe rarely authors a generic `description` field
   * at all, and `summary` is the one actually written for the intro.
   * Undefined for every non-recipe format.
   */
  recipeSummary?: string | undefined;
  siteName: string;
  /** Authored `detailPage.seo.titlePattern`, resolved against this item. */
  patternTitle: string | undefined;
  /** Authored `detailPage.seo.descriptionPattern`, resolved against this item. */
  patternDescription: string | undefined;
  /** The PAGE's own `seo.metaTitle` (authored for the page, e.g. "Blog"). */
  pageMetaTitle: string | undefined;
  /** The PAGE's own `seo.metaDescription`. */
  pageMetaDescription: string | undefined;
  /** The PAGE's `labels.subtitle`, the last description fallback before the title. */
  pageSubtitle: unknown;
  /** The page's section name (`pageConfig.name`), the last title fallback. */
  pageName: string;
}

export interface DetailItemMetaResult {
  title: string;
  description: string;
  /** `og:title`/`twitter:title` — the item's own title even when the author
   *  set a page-level SEO title, for the same item-wins reason as `title`. */
  cardTitle: string;
}

export function detailItemMetaText(input: DetailItemMetaInput): DetailItemMetaResult {
  const itemTitle = input.itemTitle?.trim() || undefined;
  const fallbackTitle = `${input.pageName} | ${input.siteName}`;

  const title =
    input.patternTitle ||
    (itemTitle ? `${itemTitle} | ${input.siteName}` : undefined) ||
    input.pageMetaTitle ||
    fallbackTitle;

  const description =
    input.patternDescription ||
    input.recipeSummary ||
    plainMeta(input.itemDescription, 160) ||
    input.pageMetaDescription ||
    plainMeta(input.pageSubtitle, 160) ||
    title;

  const cardTitle = itemTitle || title;

  return { title, description, cardTitle };
}
