/**
 * .well-known/mcp.json — MCP descriptor proxy for the customer site.
 *
 * Forwards GET to VR_Client_API's `/sites/:siteId/.well-known/mcp.json`
 * using this site's per-site API_KEY from Amplify env vars.
 *
 * Agents discover this server via `https://<customer-domain>/.well-known/mcp.json`.
 * The descriptor returned to the agent embeds the same API_KEY as a bearer-style
 * token (see plan-mcp-boundary-and-auth.md §5b) — the key is a rate-limit /
 * revocation handle, not a security boundary.
 *
 * Auth header sent to VR_Client_API must be the RAW API_KEY (no "Bearer" prefix);
 * VR_Client_Auth does exact-match lookup against `groups.apiKey`.
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
    return NextResponse.json(
      { error: 'Site MCP not configured' },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(
      `${clientApiUrl}/sites/${encodeURIComponent(siteId)}/.well-known/mcp.json`,
      {
        method: 'GET',
        headers: {
          Authorization: apiKey,
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
        // Allow agents on other origins to consume the descriptor.
        'Access-Control-Allow-Origin': '*',
        // Cache briefly at the edge — the descriptor is derived from
        // SiteData and changes infrequently. Agents that need fresh state
        // can re-fetch.
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch MCP descriptor' },
      { status: 502 }
    );
  }
}
