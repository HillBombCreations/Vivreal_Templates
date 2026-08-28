/**
 * llms.txt proxy generator — the ONE place that forwards GET to VR_Client_API's
 * `/sites/:siteId/.well-known/llms.txt` using this site's per-site API_KEY
 * from Amplify env vars.
 *
 * Reused by both route handlers so there is exactly one generator, never two
 * (portal-simplification-pass B2): `src/app/llms.txt/route.ts` (the spec
 * location, https://llmstxt.org/) and `src/app/.well-known/llms.txt/route.ts`
 * (a 301 redirect to the spec location as of B2.3, kept only for anyone who
 * already bookmarked the old path).
 *
 * `llms.txt` is the human/markdown counterpart to `mcp.json` — agents that
 * don't yet speak full MCP can still discover what the site exposes by
 * reading a structured markdown file at a well-known location.
 *
 * Auth header is the raw API_KEY (no "Bearer" prefix).
 *
 * Deliberately free of `next/server` (returns a plain data shape, not a
 * `NextResponse`) so it runs under plain `node --test` — the route handlers
 * that DO import `next/server` cannot be loaded by this runner at all (see
 * leadAttribution.ts's header for the same tradeoff), so the generation logic
 * lives here and the routes stay thin call sites.
 */

export interface LlmsTxtResponseInit {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export async function fetchLlmsTxt(): Promise<LlmsTxtResponseInit> {
  const apiKey = process.env.API_KEY;
  const siteId = process.env.SITE_ID;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? 'https://client.vivreal.io';

  if (!apiKey || !siteId) {
    return {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Site MCP not configured',
    };
  }

  try {
    const upstream = await fetch(
      `${clientApiUrl}/sites/${encodeURIComponent(siteId)}/.well-known/llms.txt`,
      {
        method: 'GET',
        headers: {
          Authorization: apiKey,
          Accept: 'text/markdown, text/plain',
        },
        cache: 'no-store',
      }
    );

    const body = await upstream.text();
    return {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ??
          'text/markdown; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
      body,
    };
  } catch {
    return {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Failed to fetch llms.txt',
    };
  }
}
