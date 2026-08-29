/**
 * /llms.txt — the spec location (https://llmstxt.org/) for the customer
 * site's markdown agent-discovery file.
 *
 * The spec puts this at the site root. It used to be served only at
 * `.well-known/llms.txt`, so a spec-following crawler 404'd on every
 * customer site (portal-simplification-pass B2). That route now redirects
 * here (B2.3) instead of generating its own copy — this route and the
 * generator it calls are the single source of truth.
 *
 * Generation lives in `fetchLlmsTxt()` (src/lib/llmsTxtProxy.ts), which this
 * route wraps in a `NextResponse` — the wrapping is the only thing that
 * differs between this route and `.well-known/llms.txt/route.ts`.
 */
import { NextResponse } from 'next/server';
import { fetchLlmsTxt } from '@/lib/llmsTxtProxy';

// The content is per-tenant (this site's API_KEY/SITE_ID) and dynamic
// (fetched fresh from VR_Client_API on every request). Without BOTH of these
// exports, Next would statically cache the response per build — serving one
// tenant's llms.txt to another, or serving a build-time snapshot forever.
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const { status, headers, body } = await fetchLlmsTxt();
  return new NextResponse(body, { status, headers });
}
