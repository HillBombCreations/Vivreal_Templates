/**
 * The internal-meter token a Vivreal-hosted site's server puts on the reads it
 * makes to RENDER pages (next release 2026-11, plan 3.F0, T4; vivreal-hq
 * docs/projects/internal-traffic-metering/design.md section 5.3).
 *
 * VR_Client_API counts a read carrying a valid `x-vivreal-internal` to the
 * group's `apiUsage.internalCalls` instead of the billable `totalCalls`
 * (owner decision OD1, rule R1: a page build, an ISR regeneration or a
 * revalidation is never billed to the owner). The group API key alone proves
 * nothing, since customers hold it, so the mark is signed with a key only
 * Vivreal and this group's sites hold:
 *
 *   INTERNAL_METER_KEY = hex(HMAC-SHA256(master, 'vivreal-internal-meter/v1/' + groupID))
 *
 * written to the site's Amplify branch env by Vivreal_EventHandler (E1, E2)
 * with `INTERNAL_METER_GROUP_ID`. This module never sees the master.
 *
 *   payload = `${groupID}:${expiresMs}:render`
 *   token   = 'v1.' + base64url(payload) + '.' + hex(HMAC-SHA256(key = INTERNAL_METER_KEY as its UTF-8 string, data = payload))
 *
 * The raw payload is signed, not its base64url form. The shared test vector
 * (VR_Client_API PR #133 `test/verifyInternalCaller.test.js`) is copied
 * verbatim into `internalTokenCore.test.ts`, so minter and verifier cannot
 * drift.
 *
 * Fails toward "metered as today": a missing or malformed key or group, a
 * request that is not a render read, or any error mints nothing, and the read
 * goes out exactly as it did before this module existed. VR_Client_API
 * enforces the same route rule on its side, so a leaked key cannot widen it.
 *
 * Pure apart from Web Crypto (`crypto.subtle`, present in Node and on the edge
 * runtime), so `node --test` drives it. `./internalToken.ts` is the
 * `server-only` module that reads the env and is the only caller.
 */

/** The request header VR_Client_API reads (CL3, `handlers.js`). */
export const INTERNAL_METER_HEADER = 'x-vivreal-internal';

/**
 * How far ahead a token expires. VR_Client_API refuses one that expires more
 * than 15 minutes ahead or is already past; each token is minted right before
 * its own fetch, so 5 minutes covers the reconnect retries with room to spare.
 */
export const INTERNAL_TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * VR_Client_API's render reads (`CDN_METERED_ROUTES` with `isRenderRead`,
 * `handlers.js`): a GET of one of these three paths with no visitor `search`.
 */
const RENDER_READ_PATHS: ReadonlySet<string> = new Set([
  '/tenant/collectionObjects',
  '/tenant/integrationObjects',
  '/tenant/siteDetails',
]);

const DERIVED_KEY = /^[0-9a-f]{64}$/;
/** A group id with no `:` (the payload separator) and no room for anything else. */
const GROUP_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface InternalMeterConfig {
  /** `INTERNAL_METER_KEY`: this group's derived key, 64 lowercase hex characters. */
  readonly key: string;
  /** `INTERNAL_METER_GROUP_ID`: the group the key was derived for. */
  readonly groupID: string;
}

/**
 * The minter's config from the server env, or null when either value is
 * absent or malformed (before the env backfill lands, every site is in that
 * state and is metered as today). Server-only names: never `NEXT_PUBLIC_`.
 */
export function readInternalMeterConfig(env: Readonly<Record<string, string | undefined>>): InternalMeterConfig | null {
  const key = (env.INTERNAL_METER_KEY ?? '').trim();
  const groupID = (env.INTERNAL_METER_GROUP_ID ?? '').trim();
  if (!DERIVED_KEY.test(key) || !GROUP_ID.test(groupID)) return null;
  return { key, groupID };
}

/**
 * Whether a Client API request is a render read, by VR_Client_API's own rule:
 * GET (an absent method is GET), one of the three paths exactly, and no
 * non-empty `search`. A repeated `search` is a search (Express parses it to an
 * array, which Client counts as one), so the rule fails toward metering.
 */
export function isRenderReadRequest(path: string, method?: string): boolean {
  if ((method ?? 'GET').toUpperCase() !== 'GET') return false;
  let url: URL;
  try {
    url = new URL(path, 'http://client.invalid');
  } catch {
    return false;
  }
  if (!RENDER_READ_PATHS.has(url.pathname)) return false;
  const searches = url.searchParams.getAll('search');
  return searches.length === 0 || (searches.length === 1 && searches[0].trim() === '');
}

function base64url(ascii: string): string {
  return btoa(ascii).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The token for `config` expiring at `expiresMs`. The group id is ASCII by `GROUP_ID`, so `btoa` is safe. */
export async function mintInternalToken(config: InternalMeterConfig, expiresMs: number): Promise<string> {
  const payload = `${config.groupID}:${expiresMs}:render`;
  return `v1.${base64url(payload)}.${await hmacSha256Hex(config.key, payload)}`;
}

/**
 * The header value for one outbound Client API request, or null when it must
 * not carry one (no config, or not a render read).
 */
export async function internalTokenForRequest(
  config: InternalMeterConfig | null,
  path: string,
  method: string | undefined,
  nowMs: number,
): Promise<string | null> {
  if (!config || !isRenderReadRequest(path, method)) return null;
  return mintInternalToken(config, nowMs + INTERNAL_TOKEN_TTL_MS);
}
