/**
 * Default titles and search summaries for pages the owner did not write one
 * for (v5 item 23 and search R4, "default titles and summaries from business
 * facts").
 *
 * PRECEDENCE, unchanged at the top: the owner's own words always win.
 *   title:       `seo.metaTitle` (exact, no suffix), then `labels.title`, then
 *                the page FORMAT's default (item 23), then the page name.
 *   description: `seo.metaDescription`, then `labels.subtitle`, then a line
 *                built from the business's own facts, then today's fallback.
 *
 * WHY THE FORMAT SITS ABOVE THE NAME (item 23, PR-6). The checkout result
 * pages are created by the system, and their stored name is the raw slug, so
 * a shopper's tab and history read "checkoutsuccess | Waves of Grain Co.".
 * The format is the one thing that says what the page is. A name the owner
 * typed is still a fallback below an owner title; it is never an owner title.
 *
 * FACTS ONLY, NEVER INVENTED. The summary says only what the business record
 * says: its description, its town (address) or the towns it serves. A site
 * with none of them keeps today's line, so nothing is claimed that the owner
 * did not write.
 *
 * Pure (no `server-only`, no Next import), so it runs under `node --test`.
 */
import type { Businessinfo, PageConfig } from '@/types/SiteData';
import { plainMeta } from './plainMeta.ts';

/** Google shows roughly this much of a summary; longer is cut, so we cut first. */
export const SUMMARY_MAX_CHARS = 160;

/**
 * Item 23: what a system page is called when the owner has not titled it.
 * Keyed on `format`, never the slug (`pageIndexing.ts` explains why).
 */
export const FORMAT_DEFAULT_TITLES: Readonly<Record<string, string>> = Object.freeze({
  'checkout-success': 'Thanks for your order',
  'checkout-cancel': 'Checkout cancelled',
});

/** The facts a default title or summary may use, read from the site record. */
export interface BusinessFacts {
  name: string;
  description?: string;
  city?: string;
  state?: string;
  serviceArea: string[];
}

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export function readBusinessFacts(
  businessInfo: Businessinfo | undefined,
  fallbackName: string | undefined,
): BusinessFacts {
  return {
    name: nonEmpty(businessInfo?.name) ?? nonEmpty(fallbackName) ?? '',
    description: plainMeta(businessInfo?.description, SUMMARY_MAX_CHARS),
    city: nonEmpty(businessInfo?.address?.city),
    state: nonEmpty(businessInfo?.address?.state),
    serviceArea: (Array.isArray(businessInfo?.serviceArea) ? businessInfo.serviceArea : [])
      .map(nonEmpty)
      .filter((town): town is string => !!town),
  };
}

/** "A, B and C". */
function listInWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Where the business is, in words: "in Knoxville, TN" from its address, else
 * "serving Knoxville, Maryville and Alcoa" from the towns it serves (first
 * three), else nothing.
 */
export function wherePhrase(facts: BusinessFacts): string | undefined {
  if (facts.city) return `in ${facts.state ? `${facts.city}, ${facts.state}` : facts.city}`;
  if (facts.serviceArea.length > 0) return `serving ${listInWords(facts.serviceArea.slice(0, 3))}`;
  return undefined;
}

/**
 * "Menu at Cobalt & Crumb in Knoxville, TN. Small batch bread, baked daily.",
 * cut to `SUMMARY_MAX_CHARS`, or `undefined` when the facts hold nothing to
 * say beyond the page and business names.
 */
export function summaryFromFacts(pageLabel: string, facts: BusinessFacts): string | undefined {
  const where = wherePhrase(facts);
  if (!where && !facts.description) return undefined;
  const lead = facts.name ? `${pageLabel} at ${facts.name}` : pageLabel;
  const sentence = where ? `${lead} ${where}.` : `${lead}.`;
  return plainMeta(facts.description ? `${sentence} ${facts.description}` : sentence, SUMMARY_MAX_CHARS);
}

type MetaPage = Pick<PageConfig, 'name' | 'format' | 'labels' | 'seo'>;

/** The `<title>` and summary for a `[slug]` page. */
export function pageMetaText({
  page,
  slug,
  staticTitle,
  facts,
}: {
  page: MetaPage | undefined;
  slug: string;
  staticTitle?: string;
  facts: BusinessFacts;
}): { title: string; description: string } {
  const formatTitle = page?.format ? FORMAT_DEFAULT_TITLES[page.format] : undefined;
  const label =
    nonEmpty(page?.labels?.title) ?? formatTitle ?? nonEmpty(page?.name) ?? staticTitle ?? slug;
  const suffixed = facts.name ? `${label} | ${facts.name}` : label;
  const title = nonEmpty(page?.seo?.metaTitle) ?? suffixed;
  const description =
    nonEmpty(page?.seo?.metaDescription) ??
    nonEmpty(page?.labels?.subtitle) ??
    (formatTitle ? undefined : summaryFromFacts(label, facts)) ??
    suffixed;
  return { title, description };
}

/** The `<title>` and summary for the home page. */
export function homeMetaText({
  seo,
  facts,
}: {
  seo: PageConfig['seo'] | undefined;
  facts: BusinessFacts;
}): { title: string; description: string } {
  const name = facts.name || 'Home';
  const where = facts.city ? `${facts.state ? `${facts.city}, ${facts.state}` : facts.city}` : undefined;
  const title = nonEmpty(seo?.metaTitle) ?? (where ? `${name} | ${where}` : name);
  const whereWords = wherePhrase(facts);
  const fromFacts = facts.description
    ? plainMeta(whereWords ? `${name}, ${whereWords}. ${facts.description}` : facts.description, SUMMARY_MAX_CHARS)
    : whereWords
      ? `${name}, ${whereWords}.`
      : undefined;
  const description =
    nonEmpty(seo?.metaDescription) ??
    fromFacts ??
    `Welcome to ${name}. Discover our latest content, events, and more.`;
  return { title, description };
}
