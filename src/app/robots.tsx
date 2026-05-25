import type { MetadataRoute } from 'next';
import { getSiteData } from '@/lib/api/siteData';

export const dynamic = 'force-dynamic';

/**
 * Site-wide robots policy. Distinguishes live-action agent classes (allowed,
 * including the new `/mcp` endpoint) from training crawlers (denied).
 *
 * Distinction follows each vendor's documented bot taxonomy:
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
export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteData = await getSiteData();

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
    sitemap: `https://${siteData.domainName}/sitemap.xml`,
  };
}
