/**
 * `POST /api/indexnow/urls`, the IndexNow snapshot (discovery batch 2.4).
 *
 * The EventHandler worker (E1) asks each live site for the exact URL list it
 * publishes, diffs it against what it last submitted, and tells IndexNow about
 * the new, changed and removed URLs. The list is built by the SAME function as
 * `/sitemap.xml` (`loadSitemapEntries`), so it cannot disagree with the
 * sitemap: it IS the sitemap, uncached (`private, no-store`) so the worker
 * never reads a CDN copy.
 *
 * AUTH. Signed exactly like `/api/revalidate`: `x-vivreal-signature:
 * sha256=<hex HMAC-SHA256(REVALIDATE_WEBHOOK_SECRET, rawBody)>`, the per-site
 * secret the worker already holds (it reads the site's revalidate webhook
 * row). The body is `{ "ts": <epoch ms> }` and is refused when `ts` is more than
 * five minutes from now, so a captured request cannot be replayed later. No
 * secret configured means every request is refused, as for revalidate.
 *
 * ANSWERS.
 *   - 401 bad or missing signature, stale or missing `ts`, no secret;
 *   - 503 site data or the page list could not be read (the worker retries);
 *   - 200 `{ eligible: false, reason }` for a demo, a site with no durable
 *     public origin, or no IndexNow key (every site before VR_Client_API C1);
 *   - 200 `{ eligible: true, host, key, keyLocation, urls: [{ loc, lastmod? }] }`.
 *
 * Pure apart from `node:crypto`, so it runs under `node --test`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MetadataRoute } from 'next';
import type { SiteData } from '@/types/SiteData';
import { isDemoSite } from '../seo/demoSafety.ts';
import { resolveSiteOrigin } from '../og/siteOrigin.ts';
import { readIndexNowKey } from './keyFile.ts';
import { DegradedUpstreamError } from '../api/siteData/degraded.ts';

/** How far `ts` may be from the clock, either way. */
export const SNAPSHOT_MAX_SKEW_MS = 5 * 60 * 1000;

export type SnapshotAuth = { ok: true } | { ok: false; reason: 'not_configured' | 'bad_signature' | 'stale' | 'bad_body' };

function hexEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Verify the signature first (constant time), then the body's freshness. */
export function verifySnapshotRequest({
  rawBody,
  signature,
  secret,
  now,
}: {
  rawBody: string;
  signature: string | null;
  secret: string | undefined;
  now: number;
}): SnapshotAuth {
  if (!secret) return { ok: false, reason: 'not_configured' };
  const header = signature ?? '';
  const provided = header.startsWith('sha256=') ? header.slice('sha256='.length) : header;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!hexEqual(provided, expected)) return { ok: false, reason: 'bad_signature' };
  let ts: unknown;
  try {
    ts = (JSON.parse(rawBody) as { ts?: unknown } | null)?.ts;
  } catch {
    return { ok: false, reason: 'bad_body' };
  }
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return { ok: false, reason: 'bad_body' };
  if (Math.abs(now - ts) > SNAPSHOT_MAX_SKEW_MS) return { ok: false, reason: 'stale' };
  return { ok: true };
}

export type SnapshotPayload =
  | { eligible: false; reason: 'demo' | 'no_origin' | 'no_key' }
  | {
      eligible: true;
      host: string;
      key: string;
      keyLocation: string;
      urls: Array<{ loc: string; lastmod?: string }>;
    };

/**
 * The payload for an already-read site. `entries` is `loadSitemapEntries()`'s
 * answer, the very list `/sitemap.xml` renders.
 */
export function snapshotPayload(
  siteData: Pick<SiteData, 'indexNowKey' | 'lifecycleState' | 'degraded' | 'canonicalUrl' | 'domainName' | 'domainInformation'>,
  entries: MetadataRoute.Sitemap,
): SnapshotPayload {
  if (isDemoSite(siteData)) return { eligible: false, reason: 'demo' };
  // `durable`: never an Amplify build host, always the custom domain once live.
  const origin = resolveSiteOrigin(siteData, { surface: 'durable' });
  if (!origin) return { eligible: false, reason: 'no_origin' };
  const key = readIndexNowKey(siteData.indexNowKey);
  if (!key) return { eligible: false, reason: 'no_key' };
  return {
    eligible: true,
    host: new URL(origin).host,
    key,
    keyLocation: `${origin}/${key}.txt`,
    urls: entries.map((entry) => {
      const lastmod = entry.lastModified === undefined ? undefined : new Date(entry.lastModified).toISOString();
      return lastmod ? { loc: entry.url, lastmod } : { loc: entry.url };
    }),
  };
}

export interface SnapshotAnswer {
  status: 200 | 503;
  body: SnapshotPayload | { error: string };
}

/**
 * The whole answer for a request that passed `verifySnapshotRequest`.
 *
 * A degraded site read, or a page list refused as degraded, is a 503 and
 * never an empty list: an empty snapshot would tell the worker every URL was
 * removed. The page list is read only for an eligible site.
 */
export async function snapshotAnswer(
  siteData: Parameters<typeof snapshotPayload>[0],
  loadEntries: () => Promise<MetadataRoute.Sitemap>,
): Promise<SnapshotAnswer> {
  if (siteData.degraded === true) return { status: 503, body: { error: 'site data unavailable' } };
  const verdict = snapshotPayload(siteData, []);
  if (!verdict.eligible) return { status: 200, body: verdict };
  try {
    return { status: 200, body: snapshotPayload(siteData, await loadEntries()) };
  } catch (err) {
    if (err instanceof DegradedUpstreamError) return { status: 503, body: { error: 'page list unavailable' } };
    throw err;
  }
}
