import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { __resetEdgeSiteMapCacheForTests } from '../edgeSiteMap.ts';
import {
  DEMO_ROBOTS_HEADER,
  DEMO_ROBOTS_VALUE,
  applyDemoRobotsHeader,
  edgeRouteIsDemo,
  stampsDemoRobotsHeader,
  withDemoRobotsHeader,
} from './demoRobotsHeader.ts';

// Discovery batch 3.4, layer 2: the llms.txt, mcp.json, sitemap and OG route
// handlers stamp X-Robots-Tag themselves, so a cold or failed edge map in
// middleware cannot expose a demo.

process.env.API_KEY = 'test-api-key';
process.env.SITE_ID = 'test-site-id';

function siteDetailsWith(values: Record<string, unknown>, status = 200) {
  globalThis.fetch = (async () =>
    new Response(
      status === 200
        ? JSON.stringify({ success: true, data: { pages: [], siteDetails: { values } }, error: null })
        : JSON.stringify({ success: false, error: 'down' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch; // the mock implements only the call shape the edge map uses
}

beforeEach(() => __resetEdgeSiteMapCacheForTests());

test('ALLOW (route layer): a COLD edge map on a demo still answers "demo", so llms.txt carries the header', async () => {
  siteDetailsWith({ lifecycleState: 'demo' });
  assert.equal(await edgeRouteIsDemo(), true);
});

test('REFUSE (route layer): a live site is not a demo', async () => {
  siteDetailsWith({ lifecycleState: 'live' });
  assert.equal(await edgeRouteIsDemo(), false);
});

test('REFUSE (route layer): a failed read fails open (no header), like the edge map everywhere else', async () => {
  siteDetailsWith({}, 500);
  assert.equal(await edgeRouteIsDemo(), false);
});

test('ALLOW: withDemoRobotsHeader adds the header to a demo response, keeping status and body', async () => {
  const stamped = withDemoRobotsHeader(
    new Response('<urlset/>', { status: 200, headers: { 'Content-Type': 'application/xml' } }),
    true,
  );
  assert.equal(stamped.headers.get(DEMO_ROBOTS_HEADER), DEMO_ROBOTS_VALUE);
  assert.equal(stamped.headers.get('content-type'), 'application/xml');
  assert.equal(await stamped.text(), '<urlset/>');
});

test('ALLOW: it works on a response whose headers are immutable (a proxied fetch answer)', async () => {
  const proxied = Response.redirect('https://media.example/x.jpg', 302); // immutable headers, like a fetch answer
  assert.throws(() => proxied.headers.set('x-probe', '1'), 'sanity: these headers really are immutable');
  assert.equal(withDemoRobotsHeader(proxied, true).headers.get(DEMO_ROBOTS_HEADER), DEMO_ROBOTS_VALUE);
});

test('REFUSE: a live (or unknown) site gets the very same response back, untouched', () => {
  const original = new Response('x');
  assert.equal(withDemoRobotsHeader(original, false), original);
  assert.equal(withDemoRobotsHeader(original, undefined), original);
  const headers = new Headers();
  applyDemoRobotsHeader(headers, false);
  assert.equal(headers.get(DEMO_ROBOTS_HEADER), null);
});

test('stampsDemoRobotsHeader: every path but /_next/static', () => {
  assert.equal(stampsDemoRobotsHeader('/_next/static/chunks/a.js'), false);
  for (const path of ['/', '/llms.txt', '/_next/image', '/api/contact', '/og/home']) {
    assert.equal(stampsDemoRobotsHeader(path), true, path);
  }
});
