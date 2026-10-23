import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SiteData } from '@/types/SiteData';
import { buildSiteJsonLd } from '../../components/JsonLd/schema.ts';

// Discovery batch 3.10 item 15: stable image routes, keyed by site data, never
// by the caller. Every ALLOW has its REFUSE.
//
// Lazily imported so that, on a tree without the module, the assertions fail
// rather than the import.
const mod = (await import('./stableImage.ts').catch(() => null)) as typeof import('./stableImage.ts') | null;
function api(): typeof import('./stableImage.ts') {
  assert.ok(mod, 'src/lib/media/stableImage.ts exists');
  return mod;
}

const SIGNED = 'https://media.vivreal.io/g/logo.png?Expires=1&Signature=x&Key-Pair-Id=k';

function fakeFetch(answer: Response | Error) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    calls.push(String(input));
    if (answer instanceof Error) throw answer;
    return answer;
  }) as typeof fetch; // the stub implements only the call shape the module uses
  return { impl, calls };
}

test('ALLOW: a signed media picture is fetched and streamed back with the long public cache', async () => {
  const { impl, calls } = fakeFetch(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }));
  const res = await api().stableImageResponse(SIGNED, impl);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=86400, s-maxage=604800');
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [1, 2, 3]);
  assert.deepEqual(calls, [SIGNED]);
});

test('REFUSE: a URL off Vivreal’s media hosts (or not https) is never fetched; 404', async () => {
  for (const url of ['https://evil.example/x.png', 'http://media.vivreal.io/x.png', 'https://media.vivreal.io.evil.example/x.png', 'javascript:alert(1)', undefined]) {
    const { impl, calls } = fakeFetch(new Response('x', { headers: { 'Content-Type': 'image/png' } }));
    const res = await api().stableImageResponse(url, impl);
    assert.equal(res.status, 404, String(url));
    assert.deepEqual(calls, [], `${String(url)} must not be fetched`);
  }
});

test('REFUSE: a non-image answer, a failed answer, or an unreachable host is a 404, never passed through', async () => {
  for (const answer of [
    new Response('<html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('gone', { status: 403, headers: { 'Content-Type': 'image/png' } }),
    new Error('ECONNRESET'),
  ]) {
    const res = await api().stableImageResponse(SIGNED, fakeFetch(answer).impl);
    assert.equal(res.status, 404);
  }
});

test('ALLOW: JSON-LD names the stable address when the site has a public origin', () => {
  const { jsonLdImage, itemImageUrl, brandLogoUrl } = api();
  assert.equal(itemImageUrl('https://a.com', 'shows', 'abc'), 'https://a.com/img/shows/abc');
  assert.equal(brandLogoUrl('https://a.com'), 'https://a.com/brand/logo');
  assert.equal(jsonLdImage('https://a.com', 'https://a.com/brand/logo', SIGNED), 'https://a.com/brand/logo');
});

test('REFUSE: no public origin keeps exactly the unsigned URL emitted before; no picture names nothing', () => {
  const { jsonLdImage } = api();
  assert.equal(jsonLdImage('', '/brand/logo', SIGNED), 'https://media.vivreal.io/g/logo.png');
  assert.equal(jsonLdImage('https://a.com', 'https://a.com/brand/logo', undefined), undefined);
});

const LOGO = { currentFile: { source: SIGNED } };
const site = (extra: Record<string, unknown>) =>
  ({ name: 'Cobalt & Crumb', logo: LOGO, domainInformation: { live_url: 'https://cobaltcrumb.com' }, ...extra }) as unknown as SiteData;

test('ALLOW: a live site’s JSON-LD logo is /brand/logo on its own host', () => {
  const [org] = buildSiteJsonLd(site({ lifecycleState: 'live' }));
  assert.equal(org.logo, 'https://cobaltcrumb.com/brand/logo');
  assert.equal(org.image, 'https://cobaltcrumb.com/brand/logo');
});

test('REFUSE: a demo keeps the unsigned logo it had (no public origin is claimed for it)', () => {
  const [org] = buildSiteJsonLd(site({ lifecycleState: 'demo' }));
  assert.equal(org.logo, 'https://media.vivreal.io/g/logo.png');
});

// The routes import Next and cannot load here: pin that they take nothing from
// the caller but the page slug and item id, which select within site data.
const src = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('SOURCE PIN: neither image route reads a URL, query or header from the request', () => {
  for (const route of ['../../app/brand/logo/route.ts', '../../app/img/[slug]/[itemId]/route.ts']) {
    const code = src(route);
    assert.ok(!/searchParams|request\.url|req\.url|headers\.get/.test(code), `${route} must not read caller input`);
    assert.ok(code.includes('stableImageResponse('), `${route} answers through stableImageResponse`);
  }
  assert.ok(src('../../app/brand/logo/route.ts').includes('getSignedUrl(siteData.logo)'));
});

test('SOURCE PIN (item 17): getSiteData is memoised per request, so site data is serialized once', () => {
  assert.ok(src('../api/siteData/index.tsx').includes('export const getSiteData = cache(async (): Promise<SiteData> => {'));
});

// ---------------------------------------------------------------------------
// Review 2026-10-23
// ---------------------------------------------------------------------------

test('REFUSE (a): a picture that is not on a Vivreal media host keeps its own link in JSON-LD', () => {
  const pasted = 'https://images.unsplash.com/photo-1.jpg';
  assert.equal(api().jsonLdImage('https://a.com', 'https://a.com/img/shows/abc', pasted), pasted);
  assert.equal(api().jsonLdImage('https://a.com', 'https://a.com/img/shows/abc', SIGNED), 'https://a.com/img/shows/abc', 'control: a media URL still moves');
});

const SAFETY = { 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" };

test('ALLOW (c): every proxied picture carries nosniff and the SVG sandbox, on the stable routes and the OG proxy alike', async () => {
  assert.equal(typeof api().proxyImage, 'function', 'the shared proxy exists');
  const svg = () => new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { headers: { 'Content-Type': 'image/svg+xml' } });
  const stable = await api().stableImageResponse(SIGNED, fakeFetch(svg()).impl);
  const og = await api().proxyImage('https://media.vivreal.io/og.svg', { cacheControl: 'public, max-age=60', mediaOnly: false, oversize: 'none', fetchImpl: fakeFetch(svg()).impl });
  for (const res of [stable, og]) {
    assert.ok(res);
    for (const [name, value] of Object.entries(SAFETY)) assert.equal(res.headers.get(name), value, name);
  }
  const ogRender = src('../og/ogCardRender.tsx');
  assert.ok(ogRender.includes("return proxyImage(signedUrl, { cacheControl: OG_CACHE_CONTROL, mediaOnly: false, oversize: 'none' });"), 'the OG proxy answers through the shared proxy');
});

test('REFUSE (c): the 404 answer carries no image headers (nothing was proxied)', async () => {
  const res = await api().stableImageResponse('https://evil.example/x.svg', fakeFetch(new Response('x')).impl);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-security-policy'), null);
});

test('ALLOW (d): an original under the limit is served from the site, bytes and all', async () => {
  const body = new Uint8Array(1024);
  const res = await api().stableImageResponse(SIGNED, fakeFetch(new Response(body, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1024' } })).impl);
  assert.equal(res.status, 200);
  assert.equal((await res.arrayBuffer()).byteLength, 1024);
});

test('REFUSE (d): an original over the limit is never buffered into the response: 302 to the signed URL, uncached', async () => {
  const { MAX_PROXIED_IMAGE_BYTES } = api();
  const declared = await api().stableImageResponse(
    SIGNED,
    fakeFetch(new Response('tiny', { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(MAX_PROXIED_IMAGE_BYTES + 1) } })).impl,
  );
  const undeclared = await api().stableImageResponse(
    SIGNED,
    fakeFetch(new Response(new Uint8Array(MAX_PROXIED_IMAGE_BYTES + 1), { headers: { 'Content-Type': 'image/jpeg' } })).impl,
  );
  for (const res of [declared, undeclared]) {
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), SIGNED);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  }
});

test('REFUSE (d): an oversized original with NO Content-Length header is measured after reading: 302, and no card proxy on OG', async () => {
  const { MAX_PROXIED_IMAGE_BYTES } = api();
  // A stream body: undici never derives a Content-Length for one, so this is
  // exactly the upstream that skips the header check.
  const unannounced = () =>
    new Response(new Blob([new Uint8Array(MAX_PROXIED_IMAGE_BYTES + 1)]).stream(), { headers: { 'Content-Type': 'image/jpeg' } });
  assert.equal(unannounced().headers.has('content-length'), false, 'control: the upstream sends no Content-Length');
  const stable = await api().stableImageResponse(SIGNED, fakeFetch(unannounced()).impl);
  assert.equal(stable.status, 302);
  assert.equal(stable.headers.get('location'), SIGNED);
  assert.equal(stable.headers.get('cache-control'), 'private, no-store');
  assert.equal(await api().proxyImage(SIGNED, { cacheControl: 'x', mediaOnly: false, oversize: 'none', fetchImpl: fakeFetch(unannounced()).impl }), null);
  // A WRONG (understated) Content-Length is caught the same way.
  const understated = new Response(new Blob([new Uint8Array(MAX_PROXIED_IMAGE_BYTES + 1)]).stream(), { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1024' } });
  assert.equal((await api().stableImageResponse(SIGNED, fakeFetch(understated).impl)).status, 302);
});

test('ALLOW (d): an original at the limit with no Content-Length header is still served from the site', async () => {
  const { MAX_PROXIED_IMAGE_BYTES } = api();
  const atLimit = new Response(new Blob([new Uint8Array(MAX_PROXIED_IMAGE_BYTES)]).stream(), { headers: { 'Content-Type': 'image/jpeg' } });
  assert.equal(atLimit.headers.has('content-length'), false, 'control: no Content-Length');
  const res = await api().stableImageResponse(SIGNED, fakeFetch(atLimit).impl);
  assert.equal(res.status, 200);
  assert.equal((await res.arrayBuffer()).byteLength, MAX_PROXIED_IMAGE_BYTES);
});

test('REFUSE (d, OG): an oversized original on the share card route is no redirect, the card is drawn instead', async () => {
  const big = new Response('tiny', { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(api().MAX_PROXIED_IMAGE_BYTES + 1) } });
  assert.equal(await api().proxyImage(SIGNED, { cacheControl: 'x', mediaOnly: false, oversize: 'none', fetchImpl: fakeFetch(big).impl }), null);
});
