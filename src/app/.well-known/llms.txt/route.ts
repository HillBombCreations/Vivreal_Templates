/**
 * .well-known/llms.txt — legacy location, kept only for anyone who already
 * bookmarked it. The spec (https://llmstxt.org/) puts llms.txt at the site
 * root, so this now just 301s there (portal-simplification-pass B2.3) rather
 * than generating its own copy of the file. `src/app/llms.txt/route.ts` +
 * `src/lib/llmsTxtProxy.ts` are the single source of truth — see B2's plan
 * for why serving two independently-generated copies of per-tenant, dynamic
 * content was the bug in the first place.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.redirect(new URL('/llms.txt', request.url), 301);
}
