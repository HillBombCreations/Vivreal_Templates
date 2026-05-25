/**
 * /mcp — JSON-RPC proxy for Site MCP tool calls.
 *
 * Forwards POST + body to VR_Client_API's `/sites/:siteId/mcp` using this
 * site's per-site API_KEY from Amplify env vars.
 *
 * The upstream handler implements MCP JSON-RPC methods: `initialize`,
 * `tools/list`, `tools/call`. Body is passed through verbatim.
 *
 * Rate limiting (60/min per IP + monthly tier cap) is enforced on the
 * VR_Client_API side via DynamoDB — see `SiteMcpRateLimitTable` and
 * `trackApiUsage`. We forward the originating IP so the upstream limiter
 * can scope correctly.
 *
 * Auth header is the raw API_KEY (no "Bearer" prefix); VR_Client_Auth
 * does exact-match.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// OPTIONS for CORS preflight from browser-side agent clients.
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.API_KEY;
  const siteId = process.env.SITE_ID;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? 'https://client.vivreal.io';

  if (!apiKey || !siteId) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: 'Site MCP not configured' },
      },
      { status: 503 }
    );
  }

  // Read body as text so we forward exactly what the client sent without
  // re-serializing (preserves JSON-RPC `id` types like strings vs. numbers).
  const body = await request.text();

  // Forward originating IP so the upstream per-IP rate limit can scope
  // correctly. CloudFront / API Gateway in front of VR_Client_API reads
  // x-forwarded-for; Vercel/Amplify edges add their own hop, so we prepend.
  const forwardedFor =
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    '';

  try {
    const upstream = await fetch(
      `${clientApiUrl}/sites/${encodeURIComponent(siteId)}/mcp`,
      {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        },
        body,
        cache: 'no-store',
      }
    );

    const respText = await upstream.text();
    return new NextResponse(respText, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
        'Access-Control-Allow-Origin': '*',
        // Surface upstream rate-limit headers so agents can back off correctly.
        ...(upstream.headers.get('retry-after')
          ? { 'Retry-After': upstream.headers.get('retry-after') as string }
          : {}),
      },
    });
  } catch {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Failed to reach Site MCP upstream' },
      },
      { status: 502 }
    );
  }
}
