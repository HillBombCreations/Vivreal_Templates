import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DELIVERY_QUOTE_PATH,
  requestDeliveryQuote,
} from './quoteClient.ts';
import { prepareDeliveryQuoteRequest } from './quoteRequest.ts';

/**
 * The injected `onDeliveryQuote` adapter.
 *
 * `globalThis.fetch` is stubbed rather than injected as a parameter, on
 * purpose: an injected seam would be a code path production never takes, and
 * the property under test is what the browser actually sends.
 */

type FetchCall = { url: string; init: RequestInit };

let calls: FetchCall[] = [];
const realFetch = globalThis.fetch;
const realError = console.error;

type StubReply = { status?: number; body?: string; json?: unknown } | Error;

/** Stub `fetch` with a fixed reply and record what it was asked for. */
function stubFetch(reply: StubReply) {
  calls = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    const body = reply.body !== undefined ? reply.body : JSON.stringify(reply.json);
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

/** An envelope in VR_Client_API's tenant shape. */
const envelope = (data: unknown) => ({ success: true, data, error: null });

/** The request `buildQuoteRequest` composes in the renderer, verbatim in shape. */
const rendererRequest = {
  zip: '37659',
  originZip: '37601',
  zones: [{ zoneName: 'Close by', maxMiles: 10, fee: 5 }],
  config: {
    deliveryRadiusMiles: 25,
    deliveryDays: ['saturday'],
    timezone: 'America/New_York',
  },
};

beforeEach(() => {
  // Failures are logged; a passing run should not print them.
  console.error = () => {};
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
});

test('posts the request to the same-origin proxy', async () => {
  stubFetch({ json: envelope({ status: 'in-area', zip: '37659' }) });
  await requestDeliveryQuote({ zip: '37659' });

  assert.equal(calls.length, 1, 'the adapter must actually call the proxy');
  assert.equal(calls[0].url, DELIVERY_QUOTE_PATH);
  assert.equal(calls[0].init.method, 'POST');
  // Relative, so the request stays on the site's own origin.
  assert.ok(!/^https?:/i.test(calls[0].url), 'the proxy path must not be absolute');
});

test('the request is forwarded whole, never rebuilt field by field', async () => {
  // `deliveryDays` is the live example: authored in the renderer's block
  // config, read by the date arithmetic in VR_Client_API, and this layer's
  // whole job in between is to not lose it.
  stubFetch({ json: envelope({ status: 'in-area' }) });
  await requestDeliveryQuote(rendererRequest);

  assert.equal(calls.length, 1);
  const sent = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(sent, rendererRequest);
});

test('what the adapter sends is a body the proxy accepts and forwards intact', async () => {
  // The seam. The adapter and the proxy are two halves of one wire, and this
  // runs the real body of one through the real preparation of the other, so a
  // change to either that breaks the pair fails here rather than in production.
  stubFetch({ json: envelope({ status: 'in-area' }) });
  await requestDeliveryQuote(rendererRequest);
  assert.equal(calls.length, 1, 'nothing was sent, so there is nothing to prepare');

  const prepared = prepareDeliveryQuoteRequest(String(calls[0].init.body));
  assert.equal(
    prepared.ok,
    true,
    'the proxy rejected the body its own adapter sends: ' + JSON.stringify(prepared),
  );
  const forwarded = (prepared as { ok: true; body: Record<string, unknown> }).body;
  assert.deepEqual(forwarded, rendererRequest);
});

test('unwraps the tenant envelope and returns the quote', async () => {
  const quote = { status: 'in-area', zip: '37659', distanceMiles: 4.2 };
  stubFetch({ json: envelope(quote) });
  assert.deepEqual(await requestDeliveryQuote({ zip: '37659' }), quote);
});

test('every one of the four statuses is passed through', async () => {
  for (const status of ['in-area', 'out-of-area', 'zip-not-recognized', 'origin-not-configured']) {
    stubFetch({ json: envelope({ status }) });
    const result = await requestDeliveryQuote({ zip: '37659' });
    assert.equal(result?.status, status, status + ' must reach the block');
  }
});

test('a payload with no status it can read is not passed on as an answer', async () => {
  // The sharpest edge in the file. `buildDeliveryAnswer` in the renderer ends
  // with an unguarded fall-through to `out-of-area`, so handing it an object
  // without a recognised status renders "We do not deliver to 37659 yet." A
  // truncated body or an envelope change would become the business refusing an
  // order it wanted, silently, and only for that one visitor.
  const unreadable: unknown[] = [{}, { status: 'maybe' }, { status: 42 }, { zip: '37659' }, [], null];
  for (const data of unreadable) {
    stubFetch({ json: envelope(data) });
    assert.equal(
      await requestDeliveryQuote({ zip: '37659' }),
      null,
      JSON.stringify(data) + ' must not reach the block as an answer',
    );
  }
});

test('an envelope reporting failure is not an answer', async () => {
  stubFetch({ json: { success: false, data: null, error: 'Validation failed' } });
  assert.equal(await requestDeliveryQuote({ zip: '37659' }), null);
});

test('a non-2xx is not an answer, including the ones with a body', async () => {
  // 503 is the site with no API key, 400 a rejected ZIP, 429 the upstream
  // limiter, 502 the endpoint being unreachable. None of them is a coverage
  // answer, and the block says "could not check right now" for all four.
  for (const status of [400, 429, 502, 503]) {
    stubFetch({ status, json: { success: false, error: 'nope' } });
    assert.equal(await requestDeliveryQuote({ zip: '37659' }), null, status + ' must not answer');
  }
});

test('a body that is not JSON is not an answer', async () => {
  stubFetch({ body: '<html>504 Gateway Timeout</html>' });
  assert.equal(await requestDeliveryQuote({ zip: '37659' }), null);
});

test('a network failure resolves to null rather than throwing', async () => {
  // It must not take the page down over a coverage lookup, and it must not
  // reject: the contract is the sentinel, the same one `subscribeUser` uses.
  stubFetch(new TypeError('Failed to fetch'));
  assert.equal(await requestDeliveryQuote({ zip: '37659' }), null);
});

test('there is no optimistic path: nothing answers without a real lookup', async () => {
  // The one property the whole feature rests on. `EmailCaptureInline` fakes
  // success with no handler injected; here that would tell a real customer
  // "Yes, we deliver to 37659" when nothing is wired.
  const nonAnswers: StubReply[] = [
    new TypeError('Failed to fetch'),
    { status: 503, json: { success: false } },
    { status: 200, json: envelope({}) },
    { status: 200, body: 'not json' },
  ];
  for (const reply of nonAnswers) {
    stubFetch(reply);
    const result = await requestDeliveryQuote({ zip: '37659' });
    assert.equal(result, null, 'a failure must never surface as a coverage answer');
  }
});
