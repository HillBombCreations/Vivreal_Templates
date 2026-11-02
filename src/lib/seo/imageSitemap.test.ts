import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// The renderer's real helpers, by relative path (its root barrel pulls `next/link`).
import {
  collectRichTextImageKeys,
  stableRichTextImageUrl,
} from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/richTextImages.js';
import { buildSitemapEntries } from './sitemap.ts';
import { renderUrlset } from './sitemapXml.ts';
import { planOgItemCard } from '../og/ogCard.ts';

/**
 * Next release 2026-12, plan 11.5 (T4; BLOG2 contract 5.3): a post's first
 * inline picture reaches search and social.
 *   - The page list names it as `<image:image><image:loc>` at its stable
 *     address (`/img/<slug>/<itemId>/<file>`), never a signed media URL.
 *   - The item's share card uses it when the item has no cover picture.
 * Driven through the real pieces: the renderer's key reader and stable-URL
 * builder, `buildSitemapEntries`, `renderUrlset` and `planOgItemCard`.
 *
 * Lazily imported so a tree without the change fails on assertions, not on
 * the import.
 */
const media = (await import('../media/richTextImage.ts')) as Record<string, unknown>;
const tools = { collect: collectRichTextImageKeys, stableUrl: stableRichTextImageUrl };

const ORIGIN = 'https://shop.example';
const POST_ID = '6a01f2b3c4d5e6f708192a3b';
const KEY_A = 'groups/66aa/media/market-stall.jpg';
const KEY_B = 'groups/66aa/media/loaves.jpg';
const figure = (key: string) => `<figure><img data-media-key="${key}" alt="x" width="10" height="10"></figure>`;
const twoPictures = { title: 'Market day', body: `<p>Hello.</p>${figure(KEY_A)}<p>More.</p>${figure(KEY_B)}` };
const noPicture = { title: 'Words only', body: '<p>No pictures here.</p>' };
const signed: Record<string, string> = Object.fromEntries(
  [KEY_A, KEY_B].map((k) => [k, `https://media.vivreal.io/${k}?Expires=1&Signature=x&Key-Pair-Id=k`]),
);

type FirstUrl = (slug: string, itemId: string, raw: Record<string, unknown> | undefined, t: typeof tools) => string | undefined;
type WithPicture = <T extends { imageUrl?: string; raw?: Record<string, unknown> }>(item: T, map: Record<string, string>, collect: typeof collectRichTextImageKeys) => T;

function firstUrl(): FirstUrl {
  assert.equal(typeof media.firstRichTextImageUrl, 'function', 'richTextImage.ts exports firstRichTextImageUrl');
  return media.firstRichTextImageUrl as FirstUrl;
}
function withPicture(): WithPicture {
  assert.equal(typeof media.withFirstInlinePicture, 'function', 'richTextImage.ts exports withFirstInlinePicture');
  return media.withFirstInlinePicture as WithPicture;
}

const blogPage = { slug: 'blog', format: 'blog' };

function sitemapFor(raw: Record<string, unknown>): string {
  const image = firstUrl()('blog', POST_ID, raw, tools);
  return renderUrlset(buildSitemapEntries([blogPage], ORIGIN, { blog: [{ segment: POST_ID, image }] }));
}

test('ALLOW: a post with two inline pictures lists the first, at its stable address', () => {
  const xml = sitemapFor(twoPictures);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9" xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1">/);
  const block = `<url>\n<loc>${ORIGIN}/blog/${POST_ID}</loc>\n<changefreq>monthly</changefreq>\n<priority>0.5</priority>\n<image:image>\n<image:loc>${ORIGIN}/img/blog/${POST_ID}/market-stall.jpg</image:loc>\n</image:image>\n</url>`;
  assert.ok(xml.includes(block), xml);
  assert.equal((xml.match(/<image:loc>/g) ?? []).length, 1, 'the first picture only');
});

test('REFUSE: a post with no picture has no image entry, and the list keeps today\'s namespace line', () => {
  const xml = sitemapFor(noPicture);
  assert.ok(xml.includes(`<loc>${ORIGIN}/blog/${POST_ID}</loc>`), 'positive control: the post is listed');
  assert.doesNotMatch(xml, /image:/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
});

test('REFUSE: a signed media URL never appears in a sitemap, even handed in as an item image', () => {
  const xml = renderUrlset(buildSitemapEntries([blogPage], ORIGIN, { blog: [{ segment: POST_ID, image: signed[KEY_A] }] }));
  assert.ok(xml.includes(`<loc>${ORIGIN}/blog/${POST_ID}</loc>`), 'positive control: the post is listed');
  assert.doesNotMatch(xml, /media\.vivreal\.io|Signature=|image:/);
  const listed = sitemapFor(twoPictures);
  assert.doesNotMatch(listed, /media\.vivreal\.io|Signature=/);
});

test('ALLOW: the share card uses the first inline picture when the post has no cover', () => {
  const item = withPicture()({ title: 'Market day', raw: twoPictures }, signed, collectRichTextImageKeys);
  assert.deepEqual(planOgItemCard(item, 'Blog'), { kind: 'photo', signedUrl: signed[KEY_A], heading: 'Market day' });
});

test('ALLOW: a cover picture still wins on the share card', () => {
  const cover = 'https://media.vivreal.io/groups/66aa/media/cover.jpg?Expires=1&Signature=y&Key-Pair-Id=k';
  const item = withPicture()({ title: 'Market day', imageUrl: cover, raw: twoPictures }, signed, collectRichTextImageKeys);
  assert.deepEqual(planOgItemCard(item, 'Blog'), { kind: 'photo', signedUrl: cover, heading: 'Market day' });
});

test('REFUSE: no cover and no inline picture keeps the branded card', () => {
  const item = withPicture()({ title: 'Words only', raw: noPicture }, signed, collectRichTextImageKeys);
  assert.deepEqual(planOgItemCard(item, 'Blog'), { kind: 'card', heading: 'Words only' });
});

test('WIRING: the page list and the item share card read the first inline picture', () => {
  const read = (relative: string) => {
    const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert.ok(source.length > 500, `${relative} was read`);
    return source;
  };
  const siteDataModule = read('../api/siteData/index.tsx');
  assert.match(siteDataModule, /image: firstRichTextImageUrl\(slug, it\.id, it\.raw, RICH_TEXT_IMAGE_TOOLS\)/);
  const og = read('../../app/og/[slug]/[itemId]/route.tsx');
  assert.match(og, /withFirstInlinePicture\(found\.item, found\.richTextImageUrls, collectRichTextImageKeys\)/);
});
