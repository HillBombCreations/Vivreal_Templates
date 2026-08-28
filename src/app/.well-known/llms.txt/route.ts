/**
 * .well-known/llms.txt — legacy location, kept only for anyone who already
 * bookmarked it. The spec (https://llmstxt.org/) puts llms.txt at the site
 * root, so this now just 301s there (portal-simplification-pass B2.3) rather
 * than generating its own copy of the file. `src/app/llms.txt/route.ts` +
 * `src/lib/llmsTxtProxy.ts` are the single source of truth — see B2's plan
 * for why serving two independently-generated copies of per-tenant, dynamic
 * content was the bug in the first place.
 *
 * The redirect TARGET is computed by `src/lib/llmsTxtRedirect.ts`, not
 * inline here (review.md TQ-1) — same "framework-free logic, thin
 * NextResponse wrapper" split `llmsTxtProxy.ts` already uses for the content
 * side, so `llmsTxtRedirect.test.ts` can give the redirect itself genuine
 * behavioural coverage under `node --test`, which cannot load this file (it
 * imports `next/server`).
 */
import { NextRequest, NextResponse } from 'next/server';
import { llmsTxtRedirectTarget, LLMS_TXT_REDIRECT_STATUS } from '@/lib/llmsTxtRedirect';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.redirect(llmsTxtRedirectTarget(request.url), LLMS_TXT_REDIRECT_STATUS);
}
