import 'server-only';
import { internalTokenForRequest, readInternalMeterConfig } from './internalTokenCore.ts';

/**
 * The server-only half of the internal-meter token (next release 2026-11,
 * plan 3.F0, T4): reads `INTERNAL_METER_KEY` and `INTERNAL_METER_GROUP_ID`
 * from this deployment's env (server-side names, never `NEXT_PUBLIC_`, so they
 * are never inlined into a browser bundle) and mints per request through
 * `./internalTokenCore.ts`.
 *
 * Called from exactly one place, `clientFetchCached` in `./client.ts`, inside
 * its data-cache closure, so a token is minted only when a cached read goes
 * upstream, whichever route triggered the fill (a page build or regeneration,
 * a revalidation, or the sitemap, OG, icon and IndexNow routes, which read the
 * same cached site data). The uncached `clientFetch` / `clientFetchSafe` never
 * mint. `internalToken.test.ts` pins both.
 *
 * Resolved once at module scope, like `API_KEY` in `./client.ts`: env is fixed
 * for the life of an Amplify instance.
 */
const CONFIG = readInternalMeterConfig(process.env);

/**
 * The `x-vivreal-internal` value for this request, or null. Never throws: a
 * minting failure only means this read is metered as today, which must never
 * cost the page its data.
 */
export async function internalTokenFor(path: string, init?: RequestInit): Promise<string | null> {
  try {
    return await internalTokenForRequest(CONFIG, path, init?.method, Date.now());
  } catch (err) {
    // Deliberately not rethrown and not captured: the read proceeds metered.
    // One log line so a fleet-wide failure is countable without a Sentry event.
    console.error(`[internalToken] mint failed, read is metered: ${err instanceof Error ? err.name : 'unknown'}`);
    return null;
  }
}
