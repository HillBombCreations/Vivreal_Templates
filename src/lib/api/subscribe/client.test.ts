import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { subscribeUser } from './client.ts';

/**
 * N-C6: the browser half of every sign-up form. With no list it must refuse
 * WITHOUT a request; with one, the request must carry that list's id.
 */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const recordFetch = (body: unknown, status = 200) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return calls;
};

test('REFUSE: no list id, no request, and the form is told it failed', async () => {
  const calls = recordFetch({ success: true });
  assert.equal(await subscribeUser('person@example.com', ''), false);
  assert.equal(calls.length, 0, 'an empty collectionId must never be posted');
});

test('ALLOW: a resolved list id is posted to /api/subscribe and success is reported', async () => {
  const calls = recordFetch({ success: true });
  assert.equal(await subscribeUser('person@example.com', 'drop-list', { location: 'Moraga' }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/subscribe');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    email: 'person@example.com',
    collectionId: 'drop-list',
    fields: { location: 'Moraga' },
  });
});

test('REFUSE: a 400 from the route is still a failure, never a success', async () => {
  recordFetch({ success: false, message: 'Missing collectionId.' }, 400);
  assert.equal(await subscribeUser('person@example.com', 'drop-list'), false);
});
