// Stand-in for `src/lib/api/client.ts`, loaded ONLY through
// `pageContextLoader.mjs` (see its header). `clientFetchCached` is the one
// door every page-context reader reads VR_Client_API through. Here it runs
// the REAL seam below that door (`../../snapshot/seam.ts`
// `readCachedWithFloor`: the real failure memo, and the recorder the test
// hands in, so a build's recording happens exactly where it does in
// production), with two differences from `client.ts`:
//   - the live read is the test's fake Client API (`configureClientStub`),
//     handed the exact request path the real reader built. It answers the
//     upstream envelope, or throws for a failed read, as `doClientFetch` does;
//   - the floor always misses, which is what it does inside `next build`
//     (`client.ts`: "Inside `next build` there is no snapshot yet").
// `next/headers` and `next/cache` (the data cache, the preview token) are
// what plain node cannot run, and nothing here is about them.
import { readCachedWithFloor } from '../../snapshot/seam.ts';
import { createFailureMemo } from '../../failureMemo.ts';

/** The data cache TTL every reader passes; its value is not under test. */
export const SITE_CACHE_TTL_SECONDS = 60;

/** The floor during a build: present nowhere, forced never. */
const BUILD_TIME_FLOOR = Object.freeze({
  notePresence() {},
  isForced: () => false,
  lookup: () => ({ hit: false, reason: 'build' }),
  noteAnswer() {},
});

const INERT_RECORDER = Object.freeze({ active: false, record() {}, writeManifest() {} });

let clientApi = null;
let deps = null;

/**
 * Point the readers at a fake Client API, `(path) => envelope` (throw for a
 * failed read), and a recorder (the real one, for a build). Each call starts a
 * fresh failure memo.
 *
 * @param {{
 *   api: (path: string) => unknown,
 *   recorder?: { readonly active: boolean, record(path: string, value: unknown): void, writeManifest(manifest: object): void },
 * }} options
 */
export function configureClientStub({ api, recorder = INERT_RECORDER }) {
  clientApi = api;
  deps = { memo: createFailureMemo(), floor: BUILD_TIME_FLOOR, recorder, now: Date.now };
}

export async function clientFetchCached(apiPath, fallback, _revalidateSeconds, _init, _tags, opts) {
  if (!clientApi) throw new Error(`clientStub: no fake Client API configured for ${apiPath}`);
  return readCachedWithFloor(deps, {
    path: apiPath,
    fallback,
    floorOptOut: opts?.floor === false,
    preview: null,
    read: async () => clientApi(apiPath),
    onFailure: () => {},
    onFallback: () => {},
  });
}

export async function clientFetchSafe(apiPath) {
  throw new Error(`clientStub: clientFetchSafe(${apiPath}) is not a page-context read`);
}

export async function readBotVerdict() {
  return '0';
}
