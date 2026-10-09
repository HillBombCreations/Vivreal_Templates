/**
 * T2 (next release): the words the portal retired, from the terminology audit
 * (`vivreal-hq/docs/projects/site-terminology-audit-2026-10/research.md`,
 * section 1 "Replaced" column, section 2, and the owner decisions of
 * 2026-10-08). Test support only: the copy tests for vivreal.io's code routes
 * read their served text against this list.
 *
 * Each entry is the retired word and the word that replaced it, so a failure
 * names the fix. Matched on whole words, case-insensitively.
 */
export const RETIRED_TERMS: ReadonlyArray<{ retired: string; use: string }> = Object.freeze([
  { retired: 'custom domain', use: 'web address (domain), then web address' },
  { retired: 'custom domains', use: 'Addresses' },
  { retired: 'content type', use: 'Lists' },
  { retired: 'content types', use: 'Lists' },
  { retired: 'collections', use: 'Lists' },
  { retired: 'quick create', use: 'Create' },
  { retired: 'dashboard', use: 'Home' },
  { retired: 'group', use: 'Business' },
  { retired: 'workspace', use: 'Business' },
  { retired: 'subscribers', use: 'People' },
  { retired: 'connections', use: 'Channels' },
  { retired: 'integrations', use: 'Channels' },
  { retired: 'vivrecords', use: 'things you publish' },
  { retired: 'ai assistant', use: 'nothing, it is retired' },
  { retired: 'pro plus', use: 'Pro' },
  { retired: 'tier', use: 'Plan' },
  { retired: 'coupons', use: 'discount codes' },
  { retired: 'site studio', use: 'Studio' },
  { retired: 'through your mailchimp connection', use: 'Campaigns' },
  { retired: 'next.vivreal.io', use: 'vivreal.io' },
]);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every retired term found in `text`, as "retired (use X)" for the failure message. */
export function findRetiredTerms(text: string): string[] {
  return RETIRED_TERMS.filter(({ retired }) =>
    new RegExp('(^|[^a-z0-9])' + escapeRegExp(retired) + '($|[^a-z0-9])', 'i').test(text),
  ).map(({ retired, use }) => retired + ' (use ' + use + ')');
}
