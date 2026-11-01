import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SiteData } from '@/types/SiteData';
// Leaf files of the renderer, by path: its root entry imports `next/link`,
// which plain Node cannot resolve (same as `lib/booking/bookPage.test.ts`).
import { blockToComposedSection } from '../../../../node_modules/@hillbombcreations/site-renderer/dist/composition/blocks.js';
import LinkPageBlock from '../../../../node_modules/@hillbombcreations/site-renderer/dist/components/LinkPage.js';

/**
 * #485 review (2026-10-30): no live Link page showed its social buttons. Sites
 * store social links as `{ type, link }`; the renderer's Link page (the
 * link-stack buttons and the social row) reads `{ platform, url }`, and the
 * composed page handed it the stored shape behind a cast.
 *
 * This renders a Link page's two social blocks from a STORED fixture, through
 * the site data the composed page hands the renderer. That hand-off is
 * `toRendererSiteData`; on a tree without it, the site data is passed through
 * raw, which is what `buildPageContext` did, so the test shows the live bug
 * there rather than failing to load.
 */
const mod = (await import('./rendererSiteData.ts').catch(() => null)) as typeof import('./rendererSiteData.ts') | null;
const handOff = (site: SiteData): unknown => (mod ? mod.toRendererSiteData(site) : site);

const STORED: SiteData = {
  socialLinks: [
    { type: 'instagram', link: 'https://instagram.com/dougskitchen' },
    { type: 'facebook', link: 'http://facebook.com/dougskitchen' },
    { type: 'tiktok', link: '' },
    { type: '', link: 'https://x.com/dougskitchen' },
  ],
} as SiteData; // Only the field these blocks read.

function renderBlock(dispatchId: 'link-stack' | 'social-row', labels: Record<string, unknown>, site: SiteData = STORED): string {
  const ctx = {
    pages: [],
    data: { siteData: handOff(site), getItems: () => [], getIntegrationItems: () => [] },
    isHome: false,
    options: { mode: 'live' },
  };
  const block = { id: `blk_${dispatchId}`, type: { kind: 'static', dispatchId }, order: 0, enabled: true, config: { labels } };
  // The renderer's own block mapper, then its own Link page component.
  const section = blockToComposedSection(block as never, ctx as never); // JS leaf import: the d.ts types are not resolved by path.
  return section ? renderToStaticMarkup(createElement(LinkPageBlock as never, { section })) : '';
}

const STACK_LINKS = { links: ['instagram', 'facebook', 'tiktok', 'x'].map((platform) => ({ kind: 'social', platform })) };

test('ALLOW: a stored { type, link } Instagram account is a visible button on the Link page', () => {
  const html = renderBlock('link-stack', STACK_LINKS);
  assert.match(html, /<a href="https:\/\/instagram\.com\/dougskitchen"[^>]*>Instagram<\/a>/, html || 'no section rendered');
});

test('ALLOW: the same account is an icon in the Link page social row', () => {
  const html = renderBlock('social-row', {});
  assert.match(html, /<a href="https:\/\/instagram\.com\/dougskitchen"[^>]*aria-label="Instagram"/, html || 'no section rendered');
});

test('REFUSE: an http: link, a missing link, or a missing type renders no button', () => {
  for (const html of [renderBlock('link-stack', STACK_LINKS), renderBlock('social-row', {})]) {
    assert.doesNotMatch(html, /facebook\.com/, 'an http: link must never be a button');
    assert.doesNotMatch(html, /tiktok/i, 'an account with no link must never be a button');
    assert.doesNotMatch(html, /x\.com/, 'an account with no type must never be a button');
    assert.equal((html.match(/<a /g) ?? []).length, 1, 'only the Instagram button');
  }
});

test('toRendererSocialLinks: maps type to platform and link to url, drops rows without either, never throws', () => {
  assert.ok(mod, 'src/lib/api/composition/rendererSiteData.ts exists');
  const ragged = [
    { type: ' instagram ', link: ' https://instagram.com/a ' },
    { type: 'facebook' },
    { link: 'https://x.com/a' },
    null,
    { type: 'tiktok', link: 'http://tiktok.com/@a' },
  ] as unknown as SiteData['socialLinks']; // Malformed rows a stored document can hold.
  assert.deepEqual(mod.toRendererSocialLinks(ragged), [
    { platform: 'instagram', url: 'https://instagram.com/a' },
    // https is the renderer's rule (httpsOnly), applied where it reads the address.
    { platform: 'tiktok', url: 'http://tiktok.com/@a' },
  ]);
  assert.deepEqual(mod.toRendererSocialLinks(undefined), []);
  assert.deepEqual(mod.toRendererSocialLinks({} as unknown as SiteData['socialLinks']), []); // Not an array.
});

test('toRendererSiteData: only socialLinks changes, and the stored data is never mutated', () => {
  assert.ok(mod, 'src/lib/api/composition/rendererSiteData.ts exists');
  const site = { name: 'Dougs Kitchen', socialLinks: [{ type: 'instagram', link: 'https://instagram.com/a' }] } as SiteData;
  const out = mod.toRendererSiteData(site);
  assert.equal(out.name, 'Dougs Kitchen');
  assert.deepEqual(out.socialLinks, [{ platform: 'instagram', url: 'https://instagram.com/a' }]);
  assert.deepEqual(site.socialLinks, [{ type: 'instagram', link: 'https://instagram.com/a' }], 'the stored data is not mutated');
});

test('buildPageContext hands the renderer the mapped site data, not the stored shape behind a cast', () => {
  const source = fs.readFileSync(new URL('./buildPageContext.ts', import.meta.url), 'utf8');
  assert.match(source, /siteData: toRendererSiteData\(siteData\) as unknown as RendererSiteData,/);
  assert.doesNotMatch(source, /siteData: siteData as unknown as RendererSiteData/);
});

// ── next release 2026-11, N6 and owner Q12: the owner's own label ─────────
// Schemas 1.67.0 stores an optional `label` on a social link so an Other link
// keeps the owner's name for it. The renderer (1.94.0) draws it; Templates must
// carry it. Before this, all three mappers (this one, Footer, Navbar) dropped it.
const OTHER_SITE = {
  socialLinks: [{ type: 'other', link: 'https://shop.example/owner', label: 'My Etsy' }],
} as SiteData; // Only the field these blocks read.

test('ALLOW (N6, Q12): an Other link is named by the owner\'s label in the Link page social row', () => {
  const html = renderBlock('social-row', {}, OTHER_SITE);
  assert.match(html, /aria-label="My Etsy"/, html || 'no section rendered');
});

test('ALLOW (N6, Q12): toRendererSocialLinks carries a label, trimmed', () => {
  assert.ok(mod, 'src/lib/api/composition/rendererSiteData.ts exists');
  const rows = [{ type: 'other', link: 'https://a.example', label: '  My Etsy ' }] as unknown as SiteData['socialLinks'];
  assert.deepEqual(mod.toRendererSocialLinks(rows), [{ platform: 'other', url: 'https://a.example', label: 'My Etsy' }]);
});

test('REFUSE (N6, Q12): a blank or non-string label adds no label key, so today\'s rows are byte-identical', () => {
  assert.ok(mod, 'src/lib/api/composition/rendererSiteData.ts exists');
  const rows = [
    { type: 'instagram', link: 'https://instagram.com/a' },
    { type: 'other', link: 'https://b.example', label: '   ' },
    { type: 'other', link: 'https://c.example', label: 42 },
  ] as unknown as SiteData['socialLinks']; // Malformed labels a stored document could hold.
  assert.deepEqual(mod.toRendererSocialLinks(rows), [
    { platform: 'instagram', url: 'https://instagram.com/a' },
    { platform: 'other', url: 'https://b.example' },
    { platform: 'other', url: 'https://c.example' },
  ]);
});

test('Footer and Navbar read the site social links through the same mapper (so the label reaches them)', () => {
  for (const rel of ['../../../components/Footer/index.tsx', '../../../components/Navigation/Navbar.tsx']) {
    const source = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.match(source, /toRendererSocialLinks\(siteData\?\.socialLinks\)/, `${rel} uses toRendererSocialLinks`);
    assert.doesNotMatch(source, /platform: l\.type, url: l\.link/, `${rel} keeps no inline mapper that drops the label`);
  }
});
