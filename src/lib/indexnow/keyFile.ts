/**
 * The IndexNow key file, `GET /{key}.txt` (discovery batch 2.2, 2026-10-22).
 *
 * IndexNow proves a site owns the URLs it submits by fetching
 * `https://<host>/<key>.txt` and comparing the body to the key. The key is
 * derived per site by VR_Client_API (K1: HMAC of the site id, LIVE sites only)
 * and arrives with site data as a top-level `indexNowKey`, so the file appears
 * the moment the key does, with no build.
 *
 * `next.config.ts` rewrites any 32 lowercase hex `.txt` name at the site root
 * to `/api/indexnow/key/<name>` (`KEY_FILE_REWRITE`, `./keyFileRewrite.ts`),
 * which answers through `keyFileAnswer`:
 *   - 200 `text/plain`, body exactly the key, only when the name IS the key;
 *   - 404 for any other name, for a demo, and for a site with no key (every
 *     site until VR_Client_API ships C1, and every demo after it);
 *   - 503 when site data could not be read, so a validator retries rather
 *     than recording "no key here".
 *
 * Pure (no `next/*`), so it runs under `node --test`.
 */
import type { SiteData } from '@/types/SiteData';
import { isDemoSite } from '../seo/demoSafety.ts';

/** A K1 key: the first 32 hex characters of an HMAC-SHA256 digest. */
export const INDEXNOW_KEY_PATTERN = /^[0-9a-f]{32}$/;

/** A well-formed key from untrusted site data, or `undefined`. */
export function readIndexNowKey(value: unknown): string | undefined {
  return typeof value === 'string' && INDEXNOW_KEY_PATTERN.test(value) ? value : undefined;
}

export interface KeyFileAnswer {
  status: 200 | 404 | 503;
  body: string;
  headers: Record<string, string>;
}

const TEXT = 'text/plain; charset=utf-8';

export function keyFileAnswer(
  siteData: Pick<SiteData, 'indexNowKey' | 'lifecycleState' | 'degraded'>,
  requested: string,
): KeyFileAnswer {
  if (siteData.degraded === true) {
    return { status: 503, body: 'Try again shortly', headers: { 'Content-Type': TEXT, 'Cache-Control': 'no-store' } };
  }
  const key = readIndexNowKey(siteData.indexNowKey);
  if (!key || isDemoSite(siteData) || requested !== key) {
    return { status: 404, body: 'Not found', headers: { 'Content-Type': TEXT, 'Cache-Control': 'public, max-age=300' } };
  }
  return { status: 200, body: key, headers: { 'Content-Type': TEXT, 'Cache-Control': 'public, max-age=3600' } };
}
