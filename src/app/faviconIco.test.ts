/**
 * V7.52. `/favicon.ico` answered 404 on vivreal.io and help.vivreal.io (and
 * on every fleet site): the app ships its icon only at the convention routes
 * `/icon` and `/apple-icon`, while browsers, feed readers and crawlers still
 * ask for `/favicon.ico` by default. The address now sends them to `/icon`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROUTE = new URL('./favicon.ico/route.ts', import.meta.url);

async function loadGet(): Promise<() => Response | Promise<Response>> {
  assert.ok(fs.existsSync(ROUTE), '/favicon.ico has a route handler');
  const mod = (await import(ROUTE.href)) as { GET?: () => Response | Promise<Response> };
  assert.equal(typeof mod.GET, 'function', 'the handler exports GET');
  return mod.GET!;
}

test('[V7.52 REFUSE] /favicon.ico is not a 404: it redirects to the generated icon', async () => {
  const GET = await loadGet();
  const res = await GET();
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), '/icon');
});

test('[V7.52 ALLOW] the redirect is host-free, so it never points at the compute host', async () => {
  // On Amplify `request.url` is localhost, so an absolute Location built from
  // it would send every browser to http://localhost. The handler takes no
  // request and writes a path.
  const GET = await loadGet();
  const res = await GET();
  const location = res.headers.get('location') ?? '';
  assert.ok(location.startsWith('/') && !location.startsWith('//'), `relative: ${location}`);
  assert.equal(await res.text(), '', 'no body');
});
