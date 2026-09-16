import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  NETWORK_RETRIES,
  describeNetworkError,
  fetchWithReconnect,
  isTransientNetworkError,
} from './fetchWithReconnect.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** What undici throws when a pooled socket died while the process was frozen. */
function deadSocket(code = 'ECONNRESET'): TypeError {
  return new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) });
}

/** Stub `fetch` with a script: each entry is an Error to throw or a Response to return. */
function scriptFetch(steps: Array<Error | Response>): { calls: number } {
  const state = { calls: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
  (globalThis as any).fetch = async () => {
    const step = steps[Math.min(state.calls, steps.length - 1)];
    state.calls += 1;
    if (step instanceof Error) throw step;
    return step;
  };
  return state;
}

test('a GET whose pooled socket died is retried on a fresh connection and succeeds', async () => {
  const state = scriptFetch([deadSocket('ETIMEDOUT'), new Response('ok', { status: 200 })]);
  const retries: Array<[string, number]> = [];
  const res = await fetchWithReconnect('https://client.vivreal.io/x', undefined, {
    onRetry: (err, n) => retries.push([describeNetworkError(err), n]),
  });
  assert.equal(res.status, 200);
  assert.equal(state.calls, 2);
  assert.deepEqual(retries, [['ETIMEDOUT', 1]]);
});

test('two stale sockets in a row are both survived', async () => {
  const state = scriptFetch([deadSocket(), deadSocket(), new Response('ok')]);
  const res = await fetchWithReconnect('https://client.vivreal.io/x');
  assert.equal(await res.text(), 'ok');
  assert.equal(state.calls, 3);
});

test('gives up after NETWORK_RETRIES extra attempts and rethrows the last error', async () => {
  const state = scriptFetch([deadSocket('UND_ERR_SOCKET')]);
  await assert.rejects(fetchWithReconnect('https://client.vivreal.io/x'), (err: unknown) => {
    assert.equal(describeNetworkError(err), 'UND_ERR_SOCKET');
    return true;
  });
  assert.equal(state.calls, NETWORK_RETRIES + 1);
});

test('an HTTP error response is returned as-is and never repeated', async () => {
  const state = scriptFetch([new Response('boom', { status: 500 })]);
  const res = await fetchWithReconnect('https://client.vivreal.io/x');
  assert.equal(res.status, 500);
  assert.equal(state.calls, 1);
});

test('a POST is never replayed, because it may have reached the server', async () => {
  const state = scriptFetch([deadSocket(), new Response('ok')]);
  await assert.rejects(fetchWithReconnect('https://client.vivreal.io/x', { method: 'POST', body: '{}' }));
  assert.equal(state.calls, 1);
});

test('an error that is not a transport TypeError is not retried', async () => {
  const state = scriptFetch([new Error('network unreachable'), new Response('ok')]);
  await assert.rejects(fetchWithReconnect('https://client.vivreal.io/x'));
  assert.equal(state.calls, 1);
});

test("nothing is retried once the caller's own signal has aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  const state = scriptFetch([deadSocket(), new Response('ok')]);
  await assert.rejects(fetchWithReconnect('https://client.vivreal.io/x', { signal: controller.signal }));
  assert.equal(state.calls, 1);
  assert.equal(isTransientNetworkError(deadSocket(), controller.signal), false);
});

test('describeNetworkError prefers the socket code, then the cause message, then the error message', () => {
  assert.equal(describeNetworkError(deadSocket('EPIPE')), 'EPIPE');
  assert.equal(describeNetworkError(new TypeError('fetch failed', { cause: new Error('socket hang up') })), 'socket hang up');
  assert.equal(describeNetworkError(new Error('plain')), 'plain');
});
