/**
 * .well-known/llms.txt — markdown agent discovery proxy for the customer site.
 *
 * Forwards GET to VR_Client_API's `/sites/:siteId/.well-known/llms.txt`
 * using this site's per-site API_KEY from Amplify env vars.
 *
 * `llms.txt` is the human/markdown counterpart to `mcp.json` — agents that
 * don't yet speak full MCP can still discover what the site exposes by
 * reading a structured markdown file at a well-known location.
 *
 * Auth header is the raw API_KEY (no "Bearer" prefix).
 */
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.API_KEY;
  const siteId = process.env.SITE_ID;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? 'https://client.vivreal.io';

  if (!apiKey || !siteId) {
    return new NextResponse('Site MCP not configured', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
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
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ??
          'text/markdown; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch {
    return new NextResponse('Failed to fetch llms.txt', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
