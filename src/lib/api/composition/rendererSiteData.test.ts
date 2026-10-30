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

function renderBlock(dispatchId: 'link-stack' | 'social-row', labels: Record<string, unknown>): string {
  const ctx = {
    pages: [],
    data: { siteData: handOff(STORED), getItems: () => [], getIntegrationItems: () => [] },
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

test('toRendererSiteData: only socialLinks changes; Footer and Navbar keep reading the stored shape', () => {
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
