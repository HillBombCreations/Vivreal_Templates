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
import { seedFreeMeta } from './seedFreeText.ts';

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
    // W25f-1: a kit seed instruction never reaches a search summary (./seedCopy.ts).
    // Uncut: the summary that quotes it cuts the whole line at a boundary (`summaryCut`).
    description: plainMeta(seedFreeMeta(businessInfo?.description), Infinity),
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
 * Plain text cut to `max` at the last whole sentence that fits, else at the
 * last whole word with an ellipsis. A summary built from the facts used to be
 * cut at character 160, mid-word ("... with results that"), which reads as a
 * broken page in a search result.
 */
export function summaryCut(text: string | undefined, max = SUMMARY_MAX_CHARS): string | undefined {
  if (!text || text.length <= max) return text;
  let sentenceEnd = 0;
  for (const m of text.slice(0, max + 1).matchAll(/[.!?](?=\s|$)/g)) if (m.index < max) sentenceEnd = m.index + 1;
  if (sentenceEnd > 0) return text.slice(0, sentenceEnd);
  const wordEnd = text.lastIndexOf(' ', max - 1);
  return wordEnd > 0 ? `${text.slice(0, wordEnd).replace(/[\s,;:]+$/, '')}…` : text.slice(0, max);
}

/**
 * "Menu at Cobalt & Crumb in Knoxville, TN. Small batch bread, baked daily.",
 * cut at a boundary to `SUMMARY_MAX_CHARS`, or `undefined` when the facts hold
 * nothing to say beyond the page and business names.
 */
export function summaryFromFacts(pageLabel: string, facts: BusinessFacts): string | undefined {
  const where = wherePhrase(facts);
  if (!where && !facts.description) return undefined;
  const lead = facts.name ? `${pageLabel} at ${facts.name}` : pageLabel;
  const sentence = where ? `${lead} ${where}.` : `${lead}.`;
  return summaryCut(plainMeta(facts.description ? `${sentence} ${facts.description}` : sentence, Infinity));
}

type MetaPage = Pick<PageConfig, 'name' | 'format' | 'labels' | 'seo'>;

/** The `<title>` and summary for a `[slug]` page. */
export function pageMetaText({
  page,
  slug,
  facts,
}: {
  page: MetaPage | undefined;
  slug: string;
  facts: BusinessFacts;
}): { title: string; description: string } {
  const formatTitle = page?.format ? FORMAT_DEFAULT_TITLES[page.format] : undefined;
  const label =
    nonEmpty(page?.labels?.title) ?? formatTitle ?? nonEmpty(page?.name) ?? slug;
  const suffixed = facts.name ? `${label} | ${facts.name}` : label;
  const title = nonEmpty(page?.seo?.metaTitle) ?? suffixed;
  const description =
    nonEmpty(seedFreeMeta(page?.seo?.metaDescription)) ??
    nonEmpty(seedFreeMeta(page?.labels?.subtitle)) ??
    // The page's NAME leads the summary ("Press at ..."), not its heading:
    // `labels.title` is display copy ("Written about") that reads wrongly there.
    (formatTitle ? undefined : summaryFromFacts(nonEmpty(page?.name) ?? label, facts)) ??
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
    ? summaryCut(plainMeta(whereWords ? `${name}, ${whereWords}. ${facts.description}` : facts.description, Infinity))
    : whereWords
      ? `${name}, ${whereWords}.`
      : undefined;
  const description =
    nonEmpty(seedFreeMeta(seo?.metaDescription)) ??
    fromFacts ??
    `Welcome to ${name}. Discover our latest content, events, and more.`;
  return { title, description };
}
