/**
 * T2 (next release): what vivreal.io's own `/llms.txt` adds to the body
 * VR_Client_API generates.
 *
 * The upstream body is built from the site's CMS pages, and it cannot see
 * this repo's code routes. VR_Client_API says so in `src/api/site/llmsTxt.js`
 * ("a known gap to close on that side", meaning here), the same gap
 * `withDomainsSitemapEntry` closes for sitemap.xml. So on the ONE deployment
 * that serves `/domains`, this appends:
 *   - `/domains`, the code route an assistant cannot otherwise find;
 *   - what an owner runs from Vivreal, in the portal's own words (the
 *     terminology audit's glossary, `site-terminology-audit-2026-10`), which
 *     is where Bookings is named.
 *
 * Every other site's body is returned byte for byte. Same fleet gate as the
 * `/domains` page (`servesPublicDomainSearch`, keyed on SITE_ID, never the host).
 *
 * The copy is plain string literals on purpose: `eslint-rules/owner-visible-copy`
 * reads `Literal` nodes and nothing else, so a template literal would take
 * these sentences out of the dash and jargon checks.
 *
 * Every claim is checked against the audit's verified facts (section 2):
 * Facebook, Instagram, LinkedIn and TikTok are the social channels; Stripe or
 * Square sell; email to sign-ups is on Pro; Bookings is an appointment diary,
 * not online booking.
 */
import { servesPublicDomainSearch } from './domains/publicSearch.ts';

/** vivreal.io's canonical origin. Only ever used behind the marketing site gate. */
export const VIVREAL_MARKETING_ORIGIN = 'https://vivreal.io';

export const MARKETING_LLMS_LINES: readonly string[] = Object.freeze([
  '## More pages',
  '',
  '- [Get a web address](' + VIVREAL_MARKETING_ORIGIN + '/domains): search for a web address (domain) for your business and see what it costs each year.',
  '',
  '## What you run from Vivreal',
  '',
  'Vivreal is genuinely easy, and it runs from your phone like an app. Create once. Publish everywhere.',
  '',
  '- My website: your pages and your shop, kept up to date from your phone.',
  '- Socials: post to Facebook, Instagram, LinkedIn and TikTok from one place.',
  '- Sales: sell your products with Stripe or Square.',
  '- People and Campaigns: the people who sign up on your website, and on Pro, email to them from Vivreal.',
  '- Bookings: a simple appointment diary on your phone.',
  '- Calendar: everything you have scheduled to publish, in one place.',
  '',
]);

/** The upstream body, plus the vivreal.io section on the marketing deployment only. */
export function withMarketingLlmsSection(body: string, siteId: string | null | undefined): string {
  if (!servesPublicDomainSearch(siteId)) return body;
  const separator = body.endsWith('\n') ? '\n' : '\n\n';
  return body + separator + MARKETING_LLMS_LINES.join('\n');
}
