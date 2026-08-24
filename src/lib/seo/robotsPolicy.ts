import type { MetadataRoute } from 'next';
import type { SiteData } from '@/types/SiteData';
// Explicit .ts extension (not the `@/` alias): imported directly by
// robotsPolicy.test.ts / demoSafety.test.ts under
// `node --experimental-strip-types --test`, which has no tsconfig `paths`
// resolution. Same convention routeMetadata.ts / rootMetadata.ts follow.
import { isDemoSite } from './demoSafety.ts';
import { resolveSiteOrigin } from '../og/siteOrigin.ts';

type RobotsSiteData = Pick<
  SiteData,
  'canonicalUrl' | 'domainName' | 'domainInformation' | 'lifecycleState'
>;

/**
 * Compose the site-wide robots policy from an already-fetched `siteData`.
 *
 * Lives here rather than inline in `src/app/robots.tsx` for one reason: a
 * `.tsx` route module cannot be imported by the plain-Node test runner, and
 * mutation testing proved the demo gate below could be deleted with the whole
 * suite still green (review-templates-106.md B2). The gate is single-sourced
 * in this function so `demoSafety.test.ts` can call the real thing instead of
 * asserting on its source text.
 *
 * Distinguishes live-action agent classes (allowed, including the `/mcp`
 * endpoint) from training crawlers (denied), following each vendor's
 * documented bot taxonomy:
 *   - Anthropic: `Claude-User` (live), `Claude-Web` (live), `ClaudeBot` + `anthropic-ai` (training)
 *   - OpenAI: `ChatGPT-User` + `OAI-SearchBot` (live), `GPTBot` (training)
 *   - Perplexity: `PerplexityBot` (live)
 *   - Common Crawl: `CCBot` (training / dataset)
 *   - Google: `Google-Extended` (training opt-out token)
 *
 * Crawlers not listed fall through to the wildcard `*` rule, which allows
 * indexing of public content and disallows `/private/` + agent endpoints
 * (so generic search crawlers don't try to follow `/mcp`).
 */
export function buildRobotsPolicy(siteData: RobotsSiteData): MetadataRoute.Robots {
  // SEO demo-safety: a pre-cutover demo site is a near-duplicate of the
  // prospect's real site — lock every crawler out and advertise no sitemap so it
  // can never be indexed. Cutover flips lifecycleState to 'live' and this reverts
  // to the normal policy below. Fail-safe: a lifecycleState that is present but
  // is not the literal 'live' counts as a demo (see demoSafety.ts).
  if (isDemoSite(siteData)) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  // `durable`, not `deployed`: a robots.txt `Sitemap:` directive sits in
  // crawler caches for days, so it must never advertise an Amplify build host.
  const siteOrigin = resolveSiteOrigin(siteData, { prefer: 'durable' });

  return {
    rules: [
      // Default policy for every other crawler.
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/private/', '/mcp', '/.well-known/mcp.json', '/.well-known/llms.txt'],
      },

      // Live-action agent classes — allowed everywhere including agent endpoints.
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Claude-User', allow: '/' },
      { userAgent: 'Claude-Web', allow: '/' },

      // Training crawlers — denied. These hoover content into training datasets;
      // owners opt into search-time agent discovery via the live-action rules above.
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
    ],
    // A subdomain-only site has no custom domainName, which is the fleet
    // majority; before the resolver took over this line those sites advertised
    // `https://undefined/sitemap.xml` (observed live) or nothing at all, and
    // their sitemaps were empty. Resolving through the shared chain gives them
    // `https://<sub>.vivreal.io/sitemap.xml`. Still conditional: an unknown or
    // refused origin must emit NO directive, because a relative `Sitemap:` value
    // is invalid per the sitemaps.org robots.txt extension.
    ...(siteOrigin ? { sitemap: `${siteOrigin}/sitemap.xml` } : {}),
  };
}
