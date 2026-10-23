// Stand-in for `@/lib/api/client`, loaded ONLY through `routeLoader.mjs`
// (see its header), which the subscribe and review route tests and the
// real-SDK scrub test register. The request itself is the real `doClientFetch`; only the
// config differs from `client.ts`: a fixed test base URL and key, and no
// preview token, which a sign-up or review POST never carries.
import { ApiError, doClientFetch } from '../../../../lib/api/clientFetchCore.ts';

export { ApiError };

export const TEST_CLIENT_API_BASE_URL = 'https://client-api.test';

export function clientFetch(apiPath, init) {
  return doClientFetch({ baseUrl: TEST_CLIENT_API_BASE_URL, apiKey: 'test-api-key' }, apiPath, null, init);
}

// `@/lib/api/review` imports this beside `clientFetch` for its page reads. A
// POST never reads, so a call here means the route under test changed.
export function clientFetchSafe(apiPath) {
  throw new Error(`clientStub: clientFetchSafe(${apiPath}) is not expected from a POST`);
}
