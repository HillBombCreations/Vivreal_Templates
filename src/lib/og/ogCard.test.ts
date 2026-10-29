import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOgImageUrl,
  buildOgItemImageUrl,
  isLightColor,
  isTextWordmarkSvg,
  MAX_OG_LOGO_BYTES,
  planIconMark,
  planOgItemCard,
  resolveOgLogo,
  resolvePageOgHeading,
  siteInitial,
} from './ogCard.ts';

/**
 * Phase 1 exit criterion #2: two different recipes produce two different
 * social cards.
 *
 * Note the shape of every assertion below: each one compares TWO items. A test
 * that only checked one item would pass against the broken code, because the
 * broken code produced a perfectly good card — the same perfectly good card,
 * for every item on the page.
 */

const ORIGIN = 'https://wavesofgrainco.com';

test('two items under one page produce two different card URLs', () => {
  const first = buildOgItemImageUrl(ORIGIN, 'recipes', 'aaa111');
  const second = buildOgItemImageUrl(ORIGIN, 'recipes', 'bbb222');
  assert.notEqual(first, second);
  assert.equal(first, `${ORIGIN}/og/recipes/aaa111`);
  assert.equal(second, `${ORIGIN}/og/recipes/bbb222`);
});

test('an item card URL is not the page card URL', () => {
  // The pre-change behaviour: every detail item inherited buildOgImageUrl(
  // origin, slug), so a recipe's og:image was its page's og:image.
  assert.notEqual(
    buildOgItemImageUrl(ORIGIN, 'recipes', 'aaa111'),
    buildOgImageUrl(ORIGIN, 'recipes'),
  );
});

test('the card URL escapes both segments', () => {
  // Slugs and item keys are author-controlled; `itemKeyField` lets an item be
  // addressed by an arbitrary stored string, not just a Mongo id.
  assert.equal(
    buildOgItemImageUrl(ORIGIN, 'our recipes', 'no-knead/focaccia'),
    `${ORIGIN}/og/our%20recipes/no-knead%2Ffocaccia`,
  );
});

test('two items with their own photos plan two different cards', () => {
  const first = planOgItemCard(
    { title: 'Overnight focaccia', imageUrl: 'https://media.vivreal.io/a.jpg?Signature=x' },
    'Recipes',
  );
  const second = planOgItemCard(
    { title: 'Seeded rye', imageUrl: 'https://media.vivreal.io/b.jpg?Signature=y' },
    'Recipes',
  );
  assert.deepEqual(first, {
    kind: 'photo',
    signedUrl: 'https://media.vivreal.io/a.jpg?Signature=x',
    heading: 'Overnight focaccia',
  });
  assert.notDeepEqual(first, second);
  assert.notEqual(first.heading, second.heading);
  assert.notEqual(
    first.kind === 'photo' ? first.signedUrl : '',
    second.kind === 'photo' ? second.signedUrl : '',
  );
});

test('two photo-less items still plan two different cards', () => {
  // The weaker fallback would be "no photo ⇒ use the page card", which puts
  // one image back on every recipe. The generated card must still name THIS
  // recipe.
  const first = planOgItemCard({ title: 'Overnight focaccia' }, 'Recipes');
  const second = planOgItemCard({ title: 'Seeded rye' }, 'Recipes');
  assert.deepEqual(first, { kind: 'card', heading: 'Overnight focaccia' });
  assert.deepEqual(second, { kind: 'card', heading: 'Seeded rye' });
});

test('a photo plan still carries the item heading for the failure path', () => {
  // A signed media URL can 403 by the time a crawler fetches it. When the
  // proxy fails, the fallback card must name the item, not the page.
  const plan = planOgItemCard(
    { title: 'Overnight focaccia', imageUrl: 'https://media.vivreal.io/a.jpg' },
    'Recipes',
  );
  assert.equal(plan.heading, 'Overnight focaccia');
});

test('no item at all falls back to the page heading', () => {
  assert.deepEqual(planOgItemCard(undefined, 'Recipes'), { kind: 'card', heading: 'Recipes' });
  assert.deepEqual(planOgItemCard(null, 'Recipes'), { kind: 'card', heading: 'Recipes' });
  assert.deepEqual(planOgItemCard({ title: '   ' }, 'Recipes'), {
    kind: 'card',
    heading: 'Recipes',
  });
});

test('a non-media image value never becomes a photo plan', () => {
  // `getSignedUrl` returns '' for anything that is not a media descriptor, and
  // an item can carry a relative or junk value. Proxying it would 500 the card.
  assert.equal(planOgItemCard({ title: 'A', imageUrl: '' }, 'Recipes').kind, 'card');
  assert.equal(planOgItemCard({ title: 'A', imageUrl: '/local.jpg' }, 'Recipes').kind, 'card');
});

test('a heading is capped so Satori cannot be handed an unbounded string', () => {
  const long = 'x'.repeat(500);
  assert.equal(planOgItemCard({ title: long }, 'Recipes').heading.length, 100);
  assert.equal(resolvePageOgHeading({ name: long }, { slug: 'recipes' }).length, 100);
});

test('page heading precedence is unchanged: metaTitle, label, name, then fallbacks', () => {
  assert.equal(
    resolvePageOgHeading(
      { seo: { metaTitle: 'Meta' }, labels: { title: 'Label' }, name: 'Name' },
      { slug: 'recipes', siteName: 'Site' },
    ),
    'Meta',
  );
  assert.equal(
    resolvePageOgHeading({ labels: { title: 'Label' }, name: 'Name' }, { slug: 'recipes' }),
    'Label',
  );
  assert.equal(resolvePageOgHeading({ name: 'Name' }, { slug: 'recipes' }), 'Name');
  assert.equal(
    resolvePageOgHeading(undefined, { staticTitle: 'Privacy Policy', siteName: 'Site', slug: 'privacy' }),
    'Privacy Policy',
  );
  assert.equal(resolvePageOgHeading(undefined, { siteName: 'Site', slug: 'recipes' }), 'Site');
  assert.equal(resolvePageOgHeading(undefined, { slug: 'recipes' }), 'recipes');
});

test('card text colour still flips on a light brand colour', () => {
  // Moved here from the route with the rest of the card logic; pinned so the
  // move is not silently a rewrite.
  assert.equal(isLightColor('#ffffff'), true);
  assert.equal(isLightColor('#fff'), true);
  assert.equal(isLightColor('#0f172a'), false);
  assert.equal(isLightColor('not-a-colour'), false);
  assert.equal(isLightColor(''), false);
});

// ---------------------------------------------------------------------------
// Share card logo: a text wordmark SVG is drawn as the site name, never as an
// image. resvg draws an embedded SVG's <text> with host fonts, the hosting
// compute has none of the wordmark families, and each glyph became a box.
// ---------------------------------------------------------------------------

/** Byte-for-byte the shape VR_Secure_API kitIdentity.js buildWordmark mints. */
const KIT_WORDMARK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="48">' +
  '<text x="0" y="34" font-family="Archivo, sans-serif" font-weight="700" font-size="30" ' +
  'letter-spacing="0.5" fill="#ffffff">Indigo Studios PH</text></svg>';
const PATH_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z" fill="#123"/></svg>';
const MIXED_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h4v4H0z"/>' +
  '<text x="5" y="8">Mill</text></svg>';
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const LOGO_URL = 'https://media.vivreal.io/pod_01/logo?Signature=abc';
const BOM = String.fromCharCode(0xfeff);
const NEWLINE = String.fromCharCode(10);

function fakeFetch(body: BodyInit, headers: Record<string, string>, status = 200) {
  const calls: string[] = [];
  // Test double: only the call shape resolveOgLogo uses.
  const impl = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response(body, { status, headers });
  }) as typeof fetch;
  return { impl, calls };
}

test('REFUSE: the kit wordmark SVG plans the site name, with no image source', async () => {
  const { impl, calls } = fakeFetch(KIT_WORDMARK, { 'content-type': 'image/svg+xml' });
  const plan = await resolveOgLogo(LOGO_URL, impl);
  assert.deepEqual(plan, { kind: 'name' });
  assert.equal('src' in plan, false);
  assert.deepEqual(calls, [LOGO_URL]);
});

test('REFUSE: a wordmark is caught with an XML prolog, upper case, a BOM, or no SVG content type', async () => {
  const variants: Array<[string, Record<string, string>]> = [
    [`<?xml version="1.0" encoding="UTF-8"?>${NEWLINE}${KIT_WORDMARK}`, { 'content-type': 'image/svg+xml' }],
    [KIT_WORDMARK.replace('<text', '<TEXT').replace('</text>', '</TEXT>'), { 'content-type': 'image/svg+xml' }],
    [KIT_WORDMARK, { 'content-type': 'image/svg+xml; charset=utf-8' }],
    [KIT_WORDMARK, { 'content-type': 'application/octet-stream' }],
    [`${BOM}<!-- kit -->${KIT_WORDMARK}`, {}],
  ];
  for (const [body, headers] of variants) {
    const plan = await resolveOgLogo(LOGO_URL, fakeFetch(body, headers).impl);
    assert.deepEqual(plan, { kind: 'name' }, `drew an image for: ${body.slice(0, 60)}`);
  }
});

test('REFUSE: an SVG mixing paths and text still plans the site name', async () => {
  const plan = await resolveOgLogo(LOGO_URL, fakeFetch(MIXED_LOGO, { 'content-type': 'image/svg+xml' }).impl);
  assert.deepEqual(plan, { kind: 'name' });
});

test('REFUSE: no URL, a failed fetch, an empty, oversized or unknown body plan the site name', async () => {
  assert.deepEqual(await resolveOgLogo('', fakeFetch(PNG_BYTES, {}).impl), { kind: 'name' });
  assert.deepEqual(
    await resolveOgLogo(LOGO_URL, fakeFetch(PNG_BYTES, { 'content-type': 'image/png' }, 403).impl),
    { kind: 'name' },
  );
  // Test double: a network failure.
  const throwing = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  assert.deepEqual(await resolveOgLogo(LOGO_URL, throwing), { kind: 'name' });
  assert.deepEqual(await resolveOgLogo(LOGO_URL, fakeFetch(new Uint8Array(0), {}).impl), { kind: 'name' });
  assert.deepEqual(
    await resolveOgLogo(
      LOGO_URL,
      fakeFetch(PNG_BYTES, { 'content-type': 'image/png', 'content-length': String(MAX_OG_LOGO_BYTES + 1) }).impl,
    ),
    { kind: 'name' },
  );
  assert.deepEqual(
    await resolveOgLogo(LOGO_URL, fakeFetch('<html>not a logo</html>', { 'content-type': 'text/html' }).impl),
    { kind: 'name' },
  );
});

test('ALLOW: a PNG logo is drawn as an image from the fetched bytes', async () => {
  const plan = await resolveOgLogo(LOGO_URL, fakeFetch(PNG_BYTES, { 'content-type': 'image/png' }).impl);
  assert.equal(plan.kind, 'image');
  assert.equal(
    plan.kind === 'image' && plan.src,
    `data:image/png;base64,${Buffer.from(PNG_BYTES).toString('base64')}`,
  );
});

test('ALLOW: a JPEG served with a generic content type is still drawn, typed by its bytes', async () => {
  const plan = await resolveOgLogo(LOGO_URL, fakeFetch(JPEG_BYTES, { 'content-type': 'application/octet-stream' }).impl);
  assert.ok(plan.kind === 'image' && plan.src.startsWith('data:image/jpeg;base64,'));
});

test('ALLOW: a drawn (path-only) SVG logo is drawn as an image, bytes unchanged', async () => {
  const plan = await resolveOgLogo(LOGO_URL, fakeFetch(PATH_LOGO, { 'content-type': 'image/svg+xml' }).impl);
  assert.equal(plan.kind, 'image');
  assert.equal(
    plan.kind === 'image' && plan.src,
    `data:image/svg+xml;base64,${Buffer.from(PATH_LOGO, 'utf8').toString('base64')}`,
  );
});

test('isTextWordmarkSvg: text SVGs true, drawn SVGs and non-SVG bodies false', () => {
  assert.equal(isTextWordmarkSvg('image/svg+xml', KIT_WORDMARK), true);
  assert.equal(isTextWordmarkSvg(null, KIT_WORDMARK), true);
  assert.equal(isTextWordmarkSvg('image/svg+xml', PATH_LOGO), false);
  // A <title> is not a <text>.
  assert.equal(isTextWordmarkSvg('image/svg+xml', PATH_LOGO.replace('<path', '<title>Mill</title><path')), false);
  assert.equal(isTextWordmarkSvg('text/html', '<html><text>x</text></html>'), false);
});

// Favicon and Apple touch icon: the same logo decision, drawn as an initial.

test('REFUSE (icons): a text wordmark plans the site initial, with no image source', async () => {
  const { impl, calls } = fakeFetch(KIT_WORDMARK, { 'content-type': 'image/svg+xml' });
  const plan = await planIconMark(LOGO_URL, 'Indigo Studios PH', impl);
  assert.deepEqual(plan, { kind: 'initial', initial: 'I' });
  assert.equal('src' in plan, false);
  assert.deepEqual(calls, [LOGO_URL]);
});

test('REFUSE (icons): a failed or thrown logo fetch plans the initial, never an image', async () => {
  assert.deepEqual(
    await planIconMark(LOGO_URL, 'salt + sage', fakeFetch(PNG_BYTES, { 'content-type': 'image/png' }, 500).impl),
    { kind: 'initial', initial: 'S' },
  );
  // Test double: a network failure.
  const throwing = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  assert.deepEqual(await planIconMark(LOGO_URL, 'Motel Saturn', throwing), { kind: 'initial', initial: 'M' });
});

test('REFUSE (icons): a wordmark with no usable name falls back to the plain disc, not the image', async () => {
  const impl = fakeFetch(KIT_WORDMARK, { 'content-type': 'image/svg+xml' }).impl;
  assert.deepEqual(await planIconMark(LOGO_URL, '', impl), { kind: 'placeholder' });
  assert.deepEqual(await planIconMark(LOGO_URL, '+ + +', impl), { kind: 'placeholder' });
});

test('ALLOW (icons): PNG and drawn SVG logos are still drawn as images', async () => {
  const png = await planIconMark(LOGO_URL, 'Doug', fakeFetch(PNG_BYTES, { 'content-type': 'image/png' }).impl);
  assert.deepEqual(png, { kind: 'image', src: `data:image/png;base64,${Buffer.from(PNG_BYTES).toString('base64')}` });
  const svg = await planIconMark(LOGO_URL, 'Doug', fakeFetch(PATH_LOGO, { 'content-type': 'image/svg+xml' }).impl);
  assert.deepEqual(svg, {
    kind: 'image',
    src: `data:image/svg+xml;base64,${Buffer.from(PATH_LOGO, 'utf8').toString('base64')}`,
  });
});

test('ALLOW (icons): a site with no logo keeps the disc and fetches nothing', async () => {
  const { impl, calls } = fakeFetch(PNG_BYTES, {});
  assert.deepEqual(await planIconMark('', 'Urbanapparel', impl), { kind: 'placeholder' });
  assert.deepEqual(calls, []);
});

test('siteInitial: first letter or digit, upper-cased, astral-safe', () => {
  assert.equal(siteInitial('the Old Mill'), 'T');
  assert.equal(siteInitial('  "salt + sage"'), 'S');
  assert.equal(siteInitial('7th Street'), '7');
  assert.equal(siteInitial('\u{1F986} duck'), 'D');
  assert.equal(siteInitial(undefined), '');
  assert.equal(siteInitial('***'), '');
});
