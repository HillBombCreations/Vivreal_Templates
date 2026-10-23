/**
 * `POST /api/indexnow/urls`, the signed IndexNow snapshot for the EventHandler
 * worker (discovery batch 2.4). The contract, the auth and every answer are
 * documented and decided in `src/lib/indexnow/snapshot.ts`; this route only
 * reads the request and the site.
 */
import { getSiteData } from '@/lib/api/siteData';
import { loadSitemapEntries } from '@/lib/seo/loadSitemapEntries';
import { snapshotAnswer, verifySnapshotRequest } from '@/lib/indexnow/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const auth = verifySnapshotRequest({
    rawBody,
    signature: request.headers.get('x-vivreal-signature'),
    secret: process.env.REVALIDATE_WEBHOOK_SECRET,
    now: Date.now(),
  });
  if (!auth.ok) return Response.json({ error: auth.reason }, { status: 401, headers: NO_STORE });

  const { status, body } = await snapshotAnswer(await getSiteData(), loadSitemapEntries);
  return Response.json(body, { status, headers: NO_STORE });
}
