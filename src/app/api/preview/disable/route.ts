import { NextRequest, NextResponse } from 'next/server';
import { cookies, draftMode } from 'next/headers';
import {
  PREVIEW_ENABLE_REDIRECT_PARAM,
  PREVIEW_TOKEN_COOKIE,
  resolvePreviewRedirectTarget,
} from '@/lib/api/previewToken';
import { PREVIEW_MARKER_COOKIE } from '@/lib/previewGuard';

// Same runtime as /api/preview/enable: `draftMode()` writes the bypass cookie.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/preview/disable (owner ideas 2026-10-29, T12, D48): end a preview.
 * Ends draft mode, deletes the preview token cookie and the backstop's marker
 * cookie, and sends the visitor to `?redirect=` (same-origin only, through the
 * enable route's own resolver; anything else lands on `/`). Never cached.
 */
export async function GET(request: NextRequest) {
  const target = resolvePreviewRedirectTarget(request.nextUrl.searchParams.get(PREVIEW_ENABLE_REDIRECT_PARAM));
  (await draftMode()).disable();
  const jar = await cookies();
  jar.delete(PREVIEW_TOKEN_COOKIE);
  jar.delete(PREVIEW_MARKER_COOKIE);
  return new NextResponse(null, {
    status: 307,
    headers: { Location: target, 'Cache-Control': 'no-store' },
  });
}
