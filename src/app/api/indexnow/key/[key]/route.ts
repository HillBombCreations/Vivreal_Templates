/**
 * `/<key>.txt`, the IndexNow key file (discovery batch 2.2). Reached only
 * through the `next.config.ts` rewrite of a 32 lowercase hex `.txt` name at
 * the site root. The answer is decided in `src/lib/indexnow/keyFile.ts`.
 */
import { getSiteData } from '@/lib/api/siteData';
import { keyFileAnswer } from '@/lib/indexnow/keyFile';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
): Promise<Response> {
  const [{ key }, siteData] = await Promise.all([params, getSiteData()]);
  const { status, body, headers } = keyFileAnswer(siteData, key);
  return new Response(body, { status, headers });
}
