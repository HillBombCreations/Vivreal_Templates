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
import { NextResponse } from 'next/server';
import { llmsTxtRedirectResponseInit } from '@/lib/llmsTxtRedirect';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * No `request` parameter, and not the framework's redirect helper: that
 * helper insists on an absolute URL, and the only absolute origin available
 * here is the incoming request's own URL, which under Amplify's compute
 * carries `localhost:3000`. The `Location` is site-relative (see
 * `llmsTxtRedirect.ts`), so the response is built directly.
 */
export async function GET(): Promise<NextResponse> {
  return new NextResponse(null, llmsTxtRedirectResponseInit());
}
