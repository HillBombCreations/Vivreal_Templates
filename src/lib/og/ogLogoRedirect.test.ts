import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { planIconMark, resolveOgLogo } from './ogCard.ts';

/**
 * The logo fetch through the REAL `fetch`, not a test double.
 *
 * Promote run 41089220307 (2026-10-30): every site with an image logo drew its
 * name on `/og/*`, `/icon` and `/apple-icon`, logging
 * `[og-logo] ... host=client.vivreal.io reason=TypeError`. VR_Client_API serves
 * every logo as a stable `https://client.vivreal.io/media?bucket=..&key=..`
 * link that answers a 302 to a freshly signed `media.vivreal.io` URL
 * (`buildMediaUrl.js`), and the fetch used `redirect: 'error'`, which makes
 * undici throw `TypeError: fetch failed` (cause "unexpected redirect") on any
 * 3xx. The fake fetch in `ogCard.test.ts` ignored `init.redirect`, so it could
 * never show that. Here the media hosts are mapped onto a local server and the
 * request goes through the real global `fetch` with the caller's own init, so
 * undici's redirect handling is the thing under test.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

/** The four live sites' logo URL shapes, as served on 2026-10-30. Unsigned, public. */
const LIVE_LOGO_URLS: ReadonlyArray<readonly [string, string]> = [
  [
    "Doug's Kitchen",
    'https://client.vivreal.io/media?bucket=vivreal-dougskitchen&key=groupObjects%2F68bfac783bc7c024975c90cb%2F1791592426963%2Fdougs-kitchen-wordmark.png',
  ],
  [
    'Comedy Collective',
    'https://client.vivreal.io/media?bucket=vivreal-thecomedycollective&key=groupObjects%2F6900a3f732b0727413c502b7%2F1761649655684%2FcomedycollectiveLogo.png',
  ],
  [
    'btle-courses',
    'https://client.vivreal.io/media?bucket=vivreal-6ae3e31e1e9e937dd560b241&key=groupObjects%2F6ae3e3bbfabbaf673e08b4b4%2F1793320420036%2Fatt.kr-J_x3th64g55SmxhDdGwEXkGkkX4p7e_e3jiTqBbI.png',
  ],
  [
    'php-topup',
    'https://client.vivreal.io/media?bucket=vivreal-6ae468cf050d909a3bc33482&key=groupObjects%2F6ae4697885706679d53987cf%2F1793356413804%2FNeon+PHP+Top-Up+Gaming+Badge.png',
  ],
];

/** Where the local `client.vivreal.io/media` sends its 302, per test. */
let redirectTo: (bucket: string, key: string) => string = (bucket, key) =>
  `https://media.vivreal.io/${bucket}/${key}?Expires=1&Signature=sig&Key-Pair-Id=K`;
const seen: string[] = [];
let server: http.Server;
let port = 0;

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    seen.push(url.pathname);
    if (url.pathname === '/client.vivreal.io/media') {
      const bucket = url.searchParams.get('bucket') ?? '';
      const key = url.searchParams.get('key') ?? '';
      // Same answer as VR_Client_API's mediaRedirect: a 302 with a text body.
      res.writeHead(302, { Location: redirectTo(bucket, key), 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Found');
      return;
    }
    if (url.pathname.startsWith('/media.vivreal.io/')) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(PNG.length) });
      res.end(PNG);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port; // listen() on a TCP port always yields AddressInfo.
});

after(() => server.close());

const fetched: string[] = [];

/**
 * The real global `fetch`, with only the media hosts re-pointed at the local
 * server. `init` (and so `redirect`) is passed through untouched. Any other
 * host is NOT re-pointed, so a fence failure would reach the real network and
 * show up in `fetched`.
 */
const realFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const target = String(input);
  fetched.push(target);
  const local = target.replace(/^https:\/\/(media|client)\.vivreal\.io\//, `http://127.0.0.1:${port}/$1.vivreal.io/`);
  return fetch(local, init);
}) as typeof fetch; // Wraps fetch with the same signature.

function reset(to?: (bucket: string, key: string) => string) {
  seen.length = 0;
  fetched.length = 0;
  redirectTo =
    to ?? ((bucket, key) => `https://media.vivreal.io/${bucket}/${key}?Expires=1&Signature=sig&Key-Pair-Id=K`);
}

const DATA_URI = `data:image/png;base64,${PNG.toString('base64')}`;

test('ALLOW: each live site logo (client.vivreal.io/media, 302 to media.vivreal.io) draws the logo on the card', async () => {
  for (const [site, url] of LIVE_LOGO_URLS) {
    reset();
    const plan = await resolveOgLogo(url, realFetch);
    assert.deepEqual(plan, { kind: 'image', src: DATA_URI }, `${site} drew its name, not its logo`);
    assert.equal(fetched.length, 2, `${site}: expected the media link and its one redirect`);
    assert.match(fetched[1] ?? '', /^https:\/\/media\.vivreal\.io\//);
  }
});

test('ALLOW: each live site logo draws the logo on /icon and /apple-icon, not the initial', async () => {
  for (const [site, url] of LIVE_LOGO_URLS) {
    reset();
    assert.deepEqual(await planIconMark(url, site, realFetch), { kind: 'image', src: DATA_URI }, site);
  }
});

test('REFUSE: a non-media-host logo URL keeps the name and is never fetched', async () => {
  reset();
  assert.deepEqual(await resolveOgLogo('https://cdn.example.com/logo.png', realFetch), { kind: 'name' });
  assert.deepEqual(fetched, []);
  assert.deepEqual(await planIconMark('https://cdn.example.com/logo.png', 'Doug', realFetch), {
    kind: 'initial',
    initial: 'D',
  });
  assert.deepEqual(fetched, []);
});

test('REFUSE: a redirect that leaves the media hosts keeps the name and the target is never fetched', async () => {
  for (const off of [
    'https://evil.example/x.png',
    'http://media.vivreal.io/x.png',
    'https://media.vivreal.io.evil.example/x.png',
    'http://169.254.169.254/latest/meta-data',
  ]) {
    reset(() => off);
    const [, url] = LIVE_LOGO_URLS[0];
    assert.deepEqual(await resolveOgLogo(url, realFetch), { kind: 'name' }, off);
    assert.deepEqual(fetched, [url], `followed the redirect to ${off}`);
  }
});

test('REFUSE: a second redirect, even between media hosts, keeps the name', async () => {
  // The media link redirecting to another media link: a loop VR_Client_API never answers.
  reset((bucket, key) => `https://client.vivreal.io/media?bucket=${bucket}&key=${encodeURIComponent(key)}`);
  const [, url] = LIVE_LOGO_URLS[0];
  assert.deepEqual(await resolveOgLogo(url, realFetch), { kind: 'name' });
  assert.equal(fetched.length, 2, 'more than one hop was followed');
});

test('REFUSE: a redirect with no Location keeps the name', async () => {
  reset(() => '');
  const [, url] = LIVE_LOGO_URLS[0];
  assert.deepEqual(await resolveOgLogo(url, realFetch), { kind: 'name' });
  assert.equal(fetched.length, 1);
});
