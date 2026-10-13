/**
 * W25 review C2 (owner decision, 2026-10-12): a page whose body is entirely
 * kit seed answers a real 404 and leaves the page list. The verdict is the
 * INSTALLED renderer's own `isSeedOnlyPage` / `mayBeSeedOnlyPage`, loaded by
 * file URL (its entry point cannot load under plain `node --test`, see
 * `seedCopy.ts`), so these tests run the rule production runs. The page
 * shapes are the renderer's own census fixtures (`seedOnlyPage.test.tsx` at
 * 8caec57), built as stored.
 *
 * The route files are JSX and cannot load here either, so the last two tests
 * pin that the 404 runs before any streaming and that the page list filters.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { PageConfig } from '@/types/SiteData';
import { findSeedOnlyPaths, isSeedOnlySlug, withoutSeedOnlyEntries, type SeedOnlyPageRead, type SeedOnlyRules } from './seedOnlyPaths.ts';

const DIST = new URL('../../../node_modules/@hillbombcreations/site-renderer/dist/', import.meta.url);
// Cast: a dynamic import of a plain-JS dist file has no types; these are its exported signatures.
const RULES = (await import(new URL('composition/seedOnlyPage.js', DIST).href)) as SeedOnlyRules;

/** Any reported error fails the test: these inputs must never throw. */
const failOnError = (err: unknown, slug: string | undefined): void => {
  assert.fail(`unexpected seed-only error on ${slug ?? 'all'}: ${String(err)}`);
};

type Item = { id: string; title: string; source: 'collection'; description: string; imageUrl?: string; raw: Record<string, unknown> };
const policyItem = (id: string, heading: string, body: string): Item => ({ id, title: heading, source: 'collection', description: body, raw: { _id: id, heading, body, mediaKeys: [] } });

const block = (id: string, kind: string, dispatchId: string, config: Record<string, unknown> = {}, order = 0) => ({ id, type: { kind, dispatchId }, order, enabled: true, config });

/** Halo and Clipper, as stored: one editorial-sections binding over a policy list. */
function standardPage(slug: string, listId: string, extra: Record<string, unknown> = {}): PageConfig {
  return {
    name: slug, slug, format: 'standard', collectionId: null, labels: { title: slug },
    blocks: [block('sections', 'layout', 'editorial-sections', { bindings: [{ collectionId: listId, displayAs: 'editorial-sections' }] })],
    ...extra,
  } as unknown as PageConfig; // a stored page carries blocks the narrow type omits
}

const SEED_POLICY = '<p>Placeholder policy text. Replace with your own before you go live.</p>';
const REAL_POLICY = '<p>We keep your name and email for as long as you are a client, and never sell them.</p>';

/** A site's pages and lists, read the way `getSeedOnlyPaths` reads them, counting the reads. */
function site(lists: Record<string, Item[]>, failed: ReadonlySet<string> = new Set()) {
  const reads: string[] = [];
  const readPage = async (page: PageConfig): Promise<SeedOnlyPageRead> => {
    reads.push(page.slug);
    return { getItems: (id) => lists[id] ?? [], listReadFailed: failed.has(page.slug), emptinessUnknown: false };
  };
  return { reads, readPage };
}

const SITEMAP = [
  { url: 'https://halo.example/', priority: 1 },
  { url: 'https://halo.example/services', priority: 0.8 },
  { url: 'https://halo.example/privacy-policy', priority: 0.8 },
];

test('the installed renderer carries the seed-only rule (1.85.8)', () => {
  assert.equal(typeof RULES.isSeedOnlyPage, 'function', 'loaded isSeedOnlyPage, not nothing');
  assert.equal(typeof RULES.mayBeSeedOnlyPage, 'function');
});

test('REFUSE: a seed-only privacy page answers 404 and is not in the page list', async () => {
  const pages = [standardPage('privacy-policy', 'p'), standardPage('services', 's')];
  const { readPage } = site({ p: [policyItem('a', 'What we keep', SEED_POLICY)], s: [policyItem('b', 'Cuts', REAL_POLICY)] });
  const paths = await findSeedOnlyPaths(pages, RULES, readPage, failOnError);
  assert.deepEqual(paths, ['/privacy-policy']);
  assert.equal(isSeedOnlySlug(paths, 'privacy-policy'), true, 'the route answers notFound()');
  assert.equal(isSeedOnlySlug(paths, 'Privacy-Policy'), true, 'any case');
  assert.equal(isSeedOnlySlug(paths, 'services'), false);
  assert.deepEqual(
    withoutSeedOnlyEntries(SITEMAP, paths).map((e) => e.url),
    ['https://halo.example/', 'https://halo.example/services'],
  );
  assert.deepEqual(withoutSeedOnlyEntries([{ url: 'https://halo.example/privacy-policy/' }], paths), [], 'a trailing slash is the same page');
});

test('ALLOW: a policy page with real text renders and stays in the page list', async () => {
  const { readPage } = site({ p: [policyItem('a', 'Your data', REAL_POLICY)] });
  const paths = await findSeedOnlyPaths([standardPage('privacy-policy', 'p')], RULES, readPage, failOnError);
  assert.deepEqual(paths, []);
  assert.equal(isSeedOnlySlug(paths, 'privacy-policy'), false);
  assert.equal(withoutSeedOnlyEntries(SITEMAP, paths), SITEMAP, 'the same list back');
  // One real section among seed ones is real content.
  const mixed = site({ p: [policyItem('a', 'Your data', SEED_POLICY), policyItem('b', 'Cookies', REAL_POLICY)] });
  assert.deepEqual(await findSeedOnlyPaths([standardPage('privacy-policy', 'p')], RULES, mixed.readPage, failOnError), []);
});

test('ALLOW: a page with a real hero subtitle, an image-only page and a page with a form all render', async () => {
  const lists = { p: [policyItem('a', 'What we keep', SEED_POLICY)] };
  const realSubtitle = standardPage('privacy-policy', 'p', { hero: { title: 'Privacy', subtitle: 'Call us on 555 0100 with any privacy question.', variant: 'statement' } });
  const photoHero = standardPage('lookbook', 'p', { hero: { title: 'Look book', variant: 'masthead', background: { type: 'image', image: { key: 'groupObjects/g/x.jpg', type: 'image' } } } });
  const imageOnly = {
    name: 'gallery', slug: 'gallery', format: 'standard', collectionId: null, labels: { title: 'Gallery' },
    blocks: [block('gallery', 'layout', 'gallery', { bindings: [{ collectionId: 'g', displayAs: 'gallery' }] })],
  } as unknown as PageConfig; // as stored
  const withForm = {
    ...standardPage('contact', 'p'),
    blocks: [
      block('sections', 'layout', 'editorial-sections', { bindings: [{ collectionId: 'p', displayAs: 'editorial-sections' }] }),
      block('form', 'layout', 'form', { bindings: [{ collectionId: 'f', displayAs: 'form' }] }, 1),
    ],
  } as unknown as PageConfig; // as above
  const imageItem = site({ p: [{ ...policyItem('a', 'What we keep', SEED_POLICY), imageUrl: 'https://cdn.example/a.jpg' }] });
  const { readPage, reads } = site({ ...lists, g: [{ ...policyItem('g1', 'Cut', ''), imageUrl: 'https://cdn.example/g.jpg' }] });
  assert.deepEqual(await findSeedOnlyPaths([realSubtitle, photoHero, imageOnly, withForm], RULES, readPage, failOnError), []);
  assert.deepEqual(reads, [], 'the pre-check rules all four out with no list read');
  assert.deepEqual(await findSeedOnlyPaths([standardPage('privacy-policy', 'p')], RULES, imageItem.readPage, failOnError), [], 'an item with an image');
});

test('REFUSE: a failed list read never produces a 404 or a hidden link', async () => {
  const { readPage } = site({}, new Set(['privacy-policy']));
  assert.deepEqual(await findSeedOnlyPaths([standardPage('privacy-policy', 'p')], RULES, readPage, failOnError), []);
  const unknown = async (): Promise<SeedOnlyPageRead> => ({ getItems: () => [policyItem('a', 'x', SEED_POLICY)], listReadFailed: false, emptinessUnknown: true });
  assert.deepEqual(await findSeedOnlyPaths([standardPage('privacy-policy', 'p')], RULES, unknown, failOnError), [], 'emptiness unknown');
  // CONTROL: the same page with a healthy read IS seed-only, so the two refusals above are not vacuous.
  const healthy = site({ p: [policyItem('a', 'x', SEED_POLICY)] });
  assert.deepEqual(await findSeedOnlyPaths([standardPage('privacy-policy', 'p')], RULES, healthy.readPage, failOnError), ['/privacy-policy']);
});

test('the pre-check limits list reads to candidate pages', async () => {
  const lists = { p: [policyItem('a', 'x', SEED_POLICY)], t: [policyItem('b', 'y', SEED_POLICY)] };
  const realHome = { name: 'Home', slug: 'about', format: 'about', labels: { title: 'About', subtitle: 'Since 2009.' }, blocks: [block('about', 'static', 'about', { labels: { body: '<p>Real.</p>' } })] } as unknown as PageConfig; // as stored
  const { readPage, reads } = site(lists);
  const paths = await findSeedOnlyPaths([realHome, standardPage('privacy-policy', 'p'), standardPage('terms-of-use', 't')], RULES, readPage, failOnError);
  assert.deepEqual(paths, ['/privacy-policy', '/terms-of-use']);
  assert.deepEqual(reads.sort(), ['privacy-policy', 'terms-of-use'], 'the real page is never read');
});

test('REFUSE (fails open): a throwing list read or rule hides nothing, the rest are still judged, and the error is reported', async () => {
  const errors: Array<string | undefined> = [];
  const report = (_err: unknown, slug: string | undefined): void => {
    errors.push(slug);
  };
  const lists = { p: [policyItem('a', 'x', SEED_POLICY)], t: [policyItem('b', 'y', SEED_POLICY)] };
  const throwsOnPrivacy = async (page: PageConfig): Promise<SeedOnlyPageRead> => {
    if (page.slug === 'privacy-policy') throw new Error('upstream exploded');
    return { getItems: (id) => lists[id as keyof typeof lists] ?? [], listReadFailed: false, emptinessUnknown: false };
  };
  const pages = [standardPage('privacy-policy', 'p'), standardPage('terms-of-use', 't')];
  assert.deepEqual(await findSeedOnlyPaths(pages, RULES, throwsOnPrivacy, report), ['/terms-of-use'], 'only the healthy page is judged seed-only');
  assert.deepEqual(errors, ['privacy-policy']);

  const ruleThrows: SeedOnlyRules = { mayBeSeedOnlyPage: () => true, isSeedOnlyPage: () => { throw new TypeError('bad stored shape'); } };
  assert.deepEqual(await findSeedOnlyPaths(pages, ruleThrows, site(lists).readPage, report), []);
  const precheckThrows: SeedOnlyRules = { mayBeSeedOnlyPage: () => { throw new TypeError('bad stored shape'); }, isSeedOnlyPage: RULES.isSeedOnlyPage };
  assert.deepEqual(await findSeedOnlyPaths(pages, precheckThrows, site(lists).readPage, report), []);
  // The pages list itself is unreadable: the whole call answers [].
  const hostile = { filter: () => { throw new Error('not a list'); } } as unknown as PageConfig[]; // a value no caller should pass
  assert.deepEqual(await findSeedOnlyPaths(hostile, RULES, site(lists).readPage, report), []);
  assert.equal(errors.at(-1), undefined, 'the whole-call failure is reported without a page');
});

test('the reporter can rethrow (the server wrapper rethrows Next control flow), and that escapes', async () => {
  const signal = new Error('NEXT_NOT_FOUND');
  const rethrow = (err: unknown): void => {
    throw err;
  };
  const throwsSignal = async (): Promise<SeedOnlyPageRead> => {
    throw signal;
  };
  await assert.rejects(findSeedOnlyPaths([standardPage('privacy-policy', 'p')], RULES, throwsSignal, rethrow), (e) => e === signal);
});

/* ── Rendered header and footer: the renderer's own Navbar and Footer, given what Templates passes ── */

type El = unknown;
const NM = new URL('../../../node_modules/', import.meta.url);
// Casts: plain-JS modules loaded by file URL have no types; these are the signatures used.
const { createElement } = (await import(new URL('react/index.js', NM).href)) as { createElement: (type: unknown, props: Record<string, unknown> | null) => El };
const { renderToStaticMarkup } = (await import(new URL('react-dom/server.node.js', NM).href)) as { renderToStaticMarkup: (el: El) => string };
const Footer = ((await import(new URL('chrome/Footer.js', DIST).href)) as { default: unknown }).default;
const Navbar = ((await import(new URL('chrome/Navbar.js', DIST).href)) as { default: unknown }).default;
const { SiteRendererProvider } = (await import(new URL('context/SiteRendererContext.js', DIST).href)) as { SiteRendererProvider: unknown };

const NAV_ITEMS = ['services', 'privacy-policy', 'accessibility'].map((slug) => ({ name: slug, label: slug, slug, path: `/${slug}` }));
const COLUMNS = [
  { id: 'c0', heading: 'Looks', links: [{ id: 'l0', label: 'Services', href: '/services' }] },
  { id: 'c1', heading: 'Legal', links: [{ id: 'l1', label: 'Privacy Policy', href: '/privacy-policy' }, { id: 'l2', label: 'Accessibility', href: '/accessibility' }] },
];
const wrap = (el: El): string => renderToStaticMarkup(createElement(SiteRendererProvider, { children: el }));
const header = (hiddenPaths: readonly string[]): string => wrap(createElement(Navbar, { siteName: 'Halo', navItems: NAV_ITEMS, hiddenPaths }));
const footer = (hiddenPaths: readonly string[]): string => wrap(createElement(Footer, { siteName: 'Halo', navItems: [], footerColumns: COLUMNS, hiddenPaths }));
const hasLink = (html: string, path: string): boolean => html.includes(`href="${path}"`);

test('ALLOW (rendered): with no seed-only paths the header and the footer draw every link', () => {
  const nav = header([]);
  const foot = footer([]);
  for (const p of ['/services', '/privacy-policy', '/accessibility']) {
    assert.ok(hasLink(nav, p), `header: ${p}`);
    assert.ok(hasLink(foot, p), `footer: ${p}`);
  }
});

test('REFUSE (rendered): a seed-only path loses its header and footer link; the others stay', () => {
  const nav = header(['/privacy-policy']);
  const foot = footer(['/privacy-policy']);
  assert.ok(!hasLink(nav, '/privacy-policy'), 'header: no privacy link');
  assert.ok(!hasLink(foot, '/privacy-policy'), 'footer: no privacy link');
  for (const p of ['/services', '/accessibility']) {
    assert.ok(hasLink(nav, p), `header keeps ${p}`);
    assert.ok(hasLink(foot, p), `footer keeps ${p}`);
  }
  assert.ok(foot.includes('>Legal<'), 'the column keeps its heading while it has a link');
});

test('REFUSE (fails open, rendered): when the check throws, the result is [] and every link still renders', async () => {
  const throwing: SeedOnlyRules = { mayBeSeedOnlyPage: () => true, isSeedOnlyPage: () => { throw new Error('boom'); } };
  const paths = await findSeedOnlyPaths([standardPage('privacy-policy', 'p')], throwing, site({ p: [policyItem('a', 'x', SEED_POLICY)] }).readPage, () => {});
  assert.deepEqual(paths, []);
  assert.equal(isSeedOnlySlug(paths, 'privacy-policy'), false, 'the page renders');
  assert.ok(hasLink(header(paths), '/privacy-policy') && hasLink(footer(paths), '/privacy-policy'), 'the links show');
});

const read = (rel: string): string => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

test('REFUSE: the [slug] route 404s a seed-only page in the un-suspended parent, before any render or streaming', () => {
  const page = read('../../app/[slug]/page.tsx');
  const guard = page.indexOf('isSeedOnlySlug(await getSeedOnlyPaths(), pageConfig.slug)) return notFound();');
  assert.ok(guard > 0, 'the guard is in the route');
  assert.ok(guard < page.indexOf('return renderComposedPage('), 'before renderComposedPage');
  assert.ok(guard < page.indexOf('<Suspense fallback='), 'before the composed arm streams');
  assert.ok(page.indexOf('assertUpstreamHealthy(siteData);') < guard, 'after the degraded-read refusal');
  const item = read('../../app/[slug]/[itemId]/page.tsx');
  assert.ok(item.includes('if (isSeedOnlySlug(await getSeedOnlyPaths(), nestedPage.slug)) return notFound();'), 'the nested page arm too');
});

test('REFUSE: the page list, the Navbar and the Footer leave out seed-only paths', () => {
  assert.ok(read('./loadSitemapEntries.ts').includes('withoutSeedOnlyEntries(await getSiteMap(), await getSeedOnlyPaths())'));
  assert.ok(read('../../components/Navigation/Navbar.tsx').includes('hiddenPaths={await getSeedOnlyPaths()}'));
  assert.ok(read('../../components/Footer/index.tsx').includes('hiddenPaths={await getSeedOnlyPaths()}'));
});
