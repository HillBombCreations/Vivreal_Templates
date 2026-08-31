import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  buildClientFetchHeaders,
  doClientFetch,
  isQuotaError,
} from './clientFetchCore.ts';
import { PREVIEW_FORWARD_HEADER } from './previewToken.ts';

/**
 * The quota-bypass proof.
 *
 * VR_Client_API sets `previewBypass = true` — skipping BOTH the quota gate and
 * `trackApiUsage` — only when it sees `x-vivreal-preview` on the inbound call
 * (`VR_Client_API/src/api/handlers.js`, `handleTenantRoutes`, and
 * `src/scripts/verifyPreviewBypass.js`). So this repo's side of that contract
 * is a single header on a single fetch, and the whole point of splitting
 * `clientFetchCore.ts` out of `client.ts` is that this test can read that
 * header off the REAL outbound `Request` instead of grepping for it.
 *
 * Drives the real function against a stubbed `globalThis.fetch`, which is the
 * only external dependency it has.
 */

const CONFIG = { baseUrl: 'https://client.vivreal.io', apiKey: 'test-api-key' };
const TOKEN = 'cGF5bG9hZA.deadbeef';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Captured {
  url: string;
  init: RequestInit | undefined;
}

/** Stub `fetch`, capture the outbound call, reply with `body`. */
function captureFetch(body: unknown, status = 200): Captured[] {
  const calls: Captured[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  return calls;
}

/** Stub `fetch` with a body we control byte for byte (non-JSON, empty, HTML). */
function captureRawFetch(body: string, status: number, contentType = 'application/json') {
  globalThis.fetch = (async () =>
    new Response(body, {
      status,
      statusText: '',
      headers: { 'Content-Type': contentType },
    })) as typeof globalThis.fetch;
}

/** Read a header off the captured init the way the platform would. */
function headerOf(call: Captured, name: string): string | null {
  return new Headers(call.init?.headers).get(name);
}

/* ------------------------------------------------------------------ */
/*  The hard constraint                                                */
/* ------------------------------------------------------------------ */

test('a preview read forwards the token as x-vivreal-preview', async () => {
  const calls = captureFetch({ success: true, data: { ok: 1 }, error: null });

  await doClientFetch(CONFIG, '/tenant/siteDetails?siteId=abc', TOKEN);

  assert.equal(calls.length, 1);
  assert.equal(
    headerOf(calls[0], PREVIEW_FORWARD_HEADER),
    TOKEN,
    'without this exact header VR_Client_API meters the call and the portal preview bills the customer',
  );
});

test('a public read sends no preview header at all', async () => {
  const calls = captureFetch({ success: true, data: {}, error: null });

  await doClientFetch(CONFIG, '/tenant/siteDetails?siteId=abc', null);

  assert.equal(
    headerOf(calls[0], PREVIEW_FORWARD_HEADER),
    null,
    'a public render must never claim a bypass it was not granted',
  );
});

test('a caller cannot overwrite the preview header with its own init', async () => {
  const calls = captureFetch({ success: true, data: {}, error: null });

  await doClientFetch(CONFIG, '/tenant/x', TOKEN, {
    headers: { [PREVIEW_FORWARD_HEADER]: 'attacker-supplied' },
  });

  assert.equal(headerOf(calls[0], PREVIEW_FORWARD_HEADER), TOKEN);
});

test('caller headers still ride along (the bot verdict relies on this)', async () => {
  const calls = captureFetch({ success: true, data: {}, error: null });

  await doClientFetch(CONFIG, '/tenant/integrationObjects?type=stripe', null, {
    headers: { 'x-vivreal-bot': '1' },
  });

  assert.equal(headerOf(calls[0], 'x-vivreal-bot'), '1');
  assert.equal(headerOf(calls[0], 'Authorization'), CONFIG.apiKey);
});

/* ------------------------------------------------------------------ */
/*  Request shape + envelope                                           */
/* ------------------------------------------------------------------ */

test('the URL is the configured origin plus the path, and the fetch is never cached', async () => {
  const calls = captureFetch({ success: true, data: {}, error: null });

  await doClientFetch(CONFIG, '/tenant/siteDetails?siteId=abc', null);

  assert.equal(calls[0].url, 'https://client.vivreal.io/tenant/siteDetails?siteId=abc');
  // `no-store` is what keeps the fetch layer out of the caching story: caching
  // is decided one level up, by clientFetchCached's unstable_cache scope.
  assert.equal(calls[0].init?.cache, 'no-store');
});

test('unwraps the { success, data, error } envelope', async () => {
  captureFetch({ success: true, data: { items: [1, 2] }, error: null });

  const result = await doClientFetch<{ items: number[] }>(CONFIG, '/tenant/x', null);

  assert.deepEqual(result, { items: [1, 2] });
});

test('returns the raw body when it is not an envelope', async () => {
  captureFetch([1, 2, 3]);

  const result = await doClientFetch<number[]>(CONFIG, '/tenant/x', null);

  assert.deepEqual(result, [1, 2, 3]);
});

test('an unsuccessful envelope throws, carrying the upstream message', async () => {
  captureFetch({ success: false, data: null, error: 'collection missing' });

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/x', null),
    (err: unknown) => err instanceof ApiError && /collection missing/.test(err.message),
  );
});

/* ------------------------------------------------------------------ */
/*  Status handling — the 402 path pages depend on                     */
/* ------------------------------------------------------------------ */

test('a 402 throws an ApiError that isQuotaError recognises', async () => {
  captureFetch({ success: false, data: null, error: 'quota' }, 402);

  // The frozen/quota-exceeded page (app/layout.tsx) renders off exactly this
  // discrimination, and clientFetchCached re-throws on it so the state is
  // never cached.
  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/siteDetails?siteId=abc', null),
    (err: unknown) => err instanceof ApiError && err.status === 402 && isQuotaError(err),
  );
});

test('a 500 throws an ApiError that is NOT a quota error', async () => {
  captureFetch({ success: false, data: null, error: 'boom' }, 500);

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/x', null),
    (err: unknown) => err instanceof ApiError && err.status === 500 && !isQuotaError(err),
  );
});

/* ------------------------------------------------------------------ */
/*  Header builder, directly                                           */
/* ------------------------------------------------------------------ */

test('buildClientFetchHeaders omits the preview header for a null token', () => {
  const headers = buildClientFetchHeaders('k', null);
  assert.equal(PREVIEW_FORWARD_HEADER in headers, false);
  assert.equal(headers.Authorization, 'k');
  assert.equal(headers['Content-Type'], 'application/json');
});

test('buildClientFetchHeaders lets a caller override Content-Type but not the bypass', () => {
  const headers = buildClientFetchHeaders('k', TOKEN, {
    'Content-Type': 'text/plain',
    [PREVIEW_FORWARD_HEADER]: 'nope',
  });
  assert.equal(headers['Content-Type'], 'text/plain');
  assert.equal(headers[PREVIEW_FORWARD_HEADER], TOKEN);
});

/* ------------------------------------------------------------------ */
/*  Error fidelity — the body must survive the throw                   */
/* ------------------------------------------------------------------ */

/**
 * The regression this section exists for.
 *
 * `doClientFetch` used to throw `VR_Client_API ${status}: ${statusText}` and
 * never read the response body at all, so the API's `error` sentence and its
 * `code` were destroyed before any caller could see them. That is why the
 * 2026-08-31 Atlas incident reached Sentry as a bare status, and why the
 * middleware frozen gate had to bypass this module entirely and read
 * `edgeSiteMap`'s raw `Response` to find `GroupFrozen`.
 */

test('a GroupFrozen 400 carries its code and the upstream sentence onto the error', async () => {
  captureFetch(
    {
      success: false,
      data: null,
      error: 'The group is frozen please resume go to portal to activate',
      code: 'GroupFrozen',
    },
    400,
  );

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/siteDetails?siteId=abc', null),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 400);
      // The point of the whole ticket: a consumer can branch on an identifier
      // instead of string-matching a sentence that copy edits can change.
      assert.equal(err.code, 'GroupFrozen');
      assert.equal(
        err.serverMessage,
        'The group is frozen please resume go to portal to activate',
      );
      return true;
    },
  );
});

test('the thrown message names the code and the reason, so Sentry titles it usefully', async () => {
  // statusText is '' here on purpose: that is the real shape on the wire, and
  // it is what made the old message read `VR_Client_API 400: ` and nothing more.
  captureRawFetch(
    JSON.stringify({ success: false, data: null, error: 'boom', code: 'IntegrationNotActive' }),
    400,
  );

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/x', null),
    (err: unknown) =>
      err instanceof ApiError &&
      err.message === 'VR_Client_API 400 (IntegrationNotActive): boom',
  );
});

test('an error with no code leaves code null rather than inventing one', async () => {
  captureFetch({ success: false, data: null, error: 'Internal Server Error' }, 500);

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/x', null),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      // null means UNKNOWN, never "not frozen" — every consumer must fail open
      // on it, the same posture edgeSiteMap's recordFrozenVerdictFromError takes.
      assert.equal(err.code, null);
      assert.equal(err.serverMessage, 'Internal Server Error');
      return true;
    },
  );
});

test('a non-JSON error body still throws an ApiError, never a parse error', async () => {
  // CloudFront serves its own HTML error pages. Parsing one must not replace a
  // diagnosable 503 with an opaque SyntaxError.
  captureRawFetch('<html><body>503 Service Unavailable</body></html>', 503, 'text/html');

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/x', null),
    (err: unknown) => {
      assert.ok(err instanceof ApiError, 'must not leak a SyntaxError from the body read');
      assert.equal(err.status, 503);
      assert.equal(err.code, null);
      assert.equal(err.serverMessage, null);
      return true;
    },
  );
});

test('an empty error body degrades to the status line alone', async () => {
  captureRawFetch('', 502);

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/x', null),
    (err: unknown) =>
      err instanceof ApiError && err.status === 502 && err.message === 'VR_Client_API 502',
  );
});

test('a 2xx carrying success:false keeps its REAL status, not a hardcoded 500', async () => {
  captureFetch({ success: false, data: null, error: 'collection missing' }, 200);

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/x', null),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 200, 'flattening this to 500 invented a server error');
      assert.equal(err.serverMessage, 'collection missing');
      return true;
    },
  );
});

test('isQuotaError stays 402-only and is not swayed by a code', async () => {
  // Guards the locked constraint from the other side: a freeze is a 400 and
  // must NOT start reading as a quota error just because it now has a code.
  captureFetch({ success: false, data: null, error: 'frozen', code: 'GroupFrozen' }, 400);

  await assert.rejects(
    () => doClientFetch(CONFIG, '/tenant/x', null),
    (err: unknown) => err instanceof ApiError && !isQuotaError(err),
  );
});
