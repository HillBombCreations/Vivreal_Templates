#!/usr/bin/env node
/**
 * The ISR build check (owner ideas 2026-10-29, plan 3.8, T10 and T11).
 *
 *   node scripts/isr-build-check.mjs            # gate on (SITE_RENDER_MODE=isr)
 *   node scripts/isr-build-check.mjs --gate-off # gate unset: everything dynamic, never 500
 *
 * NOT in `npm test`: it runs a full production build (minutes). It starts a
 * FIXTURE VR_Client_API on 127.0.0.1 (no production call, no real key, no
 * network), builds this checkout against it with `next build`, then:
 *
 *  1. reads `.next/prerender-manifest.json` and asserts the route table:
 *     no `dynamicRoutes["/[slug]"]` and no `dynamicRoutes["/[slug]/[itemId]"]`
 *     (no build fallback for either route, so an address added after a build
 *     renders plain dynamic instead of answering 500), `/about` and `/links`
 *     prerendered with `initialRevalidateSeconds: 300`, and the listed blog
 *     item prerendered;
 *  2. starts `next start` and reads real responses: a page with no storefront
 *     answers `x-nextjs-cache: HIT` with `s-maxage=300` on the second read;
 *     a storefront page, a checkout result page, `/book` and an unlisted item
 *     answer `no-store`; nothing answers 500;
 *  3. F41, the site version fence (RW-4, vivreal-hq design-t2-fence-state.md)
 *     through the real routes. Gate on:
 *     a. the server's first ordinary read, the version route slow and every
 *        fresh read held: it answers within the 6.5 s budget, and a page the
 *        stale plain copy lacks is never a 404 (I3, I7, T3b);
 *     b. still nothing learned: home first (it teaches nothing), then with the
 *        probe slow and a cold fresh read (4 s), a page added after the build
 *        answers 200 and its `updatedAt` keys the next read (R3, G6);
 *     c. a page the owner adds with NO webhook answers 200 within one probe
 *        interval; then the version route fails, then is slow: the page holds
 *        and every shell read carries the known version (I1, N1);
 *     e. a signed site.updated inside the interval makes the probe due: the
 *        next read carries the new `v` (I2, G5);
 *     g. after a purge the Client holds every shell read: the page answers
 *        from the newest shell served within 4.5 s (I3, T11);
 *     h. after a purge every shell read fails: the same (I1, I4);
 *     i. the Client refuses every `v` (a rollback past #137): a page saved
 *        meanwhile and a page already served answer (B1, G2);
 *     d. a page added with its own share image: on the first reads after the
 *        save its share image is its own and the sitemap and the signed
 *        IndexNow list name it; the page, the share image, the sitemap and
 *        IndexNow make ONE probe per interval; a version route failure never
 *        takes the sitemap back (I5, I6, B4);
 *     f. after a purge the home regeneration reads the known version (P1);
 *     j. a portal preview learns nothing: after a save, the owner's preview
 *        reads the draft words, then with every public shell read failing the
 *        public page answers from the newest PUBLIC shell this server served,
 *        never the draft (I9, review pass 6 N1).
 *     Gate unset: f. home never shows words older than a page the same
 *     server served (P1, I1).
 *
 * Prints the route table (static, ISR, dynamic) so a before and after can be
 * compared. Exit 0 only when every assertion holds. The assertions are pure
 * and exported; scripts/isr-build-check.test.mjs pins them with planted
 * manifests, so a green run here cannot be a check that never fails.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SITE_ID = '6a0000000000000000000a01';
export const POSTS = '6a0000000000000000000c01';
const UPSTREAM_PORT = 4711;
const APP_PORT = 4712;
/** The fixture site's revalidate webhook secret (never a real one). */
const REVALIDATE_SECRET = 'fixture-revalidate-secret';

const block = (id, dispatchId, config = {}, order = 0) => ({ id, type: { kind: 'page-template', dispatchId }, order, enabled: true, config });

/** F41: the page the owner adds after the build, with no webhook. */
export const NEW_PAGE_SLUG = 'whats-new';
export const NEW_PAGE_TEXT = 'Fresh this week at the fixture bakery';

/** RW-4: the page added after the build that the server's first ordinary read asks for. */
export const COLD_PAGE_SLUG = 'just-opened';
export const COLD_PAGE_TEXT = 'Just opened at the fixture bakery';

/** RW-4: how long the slow version route takes, past the probe timeout (1500 awake ms). */
const VERSION_SLOW_MS = 3_000;

/** RW-4: the words the owner changes `/whats-new` to, before a signed `site.updated`. */
export const CHANGED_TEXT = 'Changed this morning at the fixture bakery';

/** RW-4 (B1, G2): a page added while the Client refuses every `v`. */
export const ROLLED_PAGE_SLUG = 'rolled-out';
export const ROLLED_PAGE_TEXT = 'Rolled out while the Client refused v';

/** RW-4 (P1, gate unset): the home page's words before and after one save. */
export const HOME_BEFORE_TEXT = 'Welcome';
export const HOME_AFTER_TEXT = 'Welcome to the new season at the fixture bakery';

/** A fixture IndexNow key (32 lowercase hex, `INDEXNOW_KEY_PATTERN`), never a real one. */
const INDEXNOW_KEY = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';

/** RW-4 (I3): how long the fixture holds a read it is told to hold, past every deadline. */
const HOLD_MS = 20_000;

/** RW-4 (G6): a cold Client's answer to the first fresh read, inside its 5 s deadline. */
const COLD_FRESH_MS = 4_000;

/** RW-4 (I3): what a real render adds to the fence's budget (Next's own work, the awake timer's tick). */
const RENDER_ALLOWANCE_MS = 1_000;

/** RW-4 follow-up: a page added with its own share image, read through /og and /sitemap.xml. */
export const SHARE_PAGE_SLUG = 'new-arrivals';
export const SHARE_PAGE_TEXT = 'New arrivals at the fixture bakery';
/** Bytes only the share page's own image carries, after a PNG signature. */
export const SHARE_IMAGE_MARKER = 'RW4-OWN-SHARE-IMAGE';
const SHARE_IMAGE_PATH = '/media/rw4-share.png';

/** The owner's own page at the fixed route's address (review B1). */
export const OWNER_BOOK_TEXT = 'Book a table with the fixture bakery';

/** RW-4 (I9, N1): what the fixture serves for `/whats-new` to a PREVIEW read only (the `x-vivreal-preview` header present). */
export const DRAFT_TEXT = 'Draft words only the owner should see';
/** A well-formed preview token (`isWellFormedPreviewToken`: base64url, a dot, hex). The fixture verifies nothing; never a real one. */
const PREVIEW_TOKEN = 'Zml4dHVyZS1wcmV2aWV3.0123456789abcdef0123456789abcdef';

/** A coordinated storefront group, the shape a Studio "add a shop section" writes. */
const storefrontGroup = (id) => ({
  id,
  type: { kind: 'group' },
  order: 5,
  enabled: true,
  config: {
    coordinated: 'products',
    children: [block(`${id}-grid`, 'products-grid', { bindings: [{ collectionId: POSTS, role: 'primary' }] })],
  },
});

/**
 * The fixture site: one page per behaviour the check needs. `state.aboutStorefront`
 * is flipped after the build to model an owner adding a shop section to a page
 * that was prerendered (review B2).
 */
export function fixtureSiteDetails(state = {}, { preview = false } = {}) {
  const aboutBlocks = [block('a1', 'section-header', { labels: { title: 'About us', subtitle: 'Our story' } })];
  // RW-4 (I9, N1): a preview read sees the owner's draft of the new page.
  const newPageText = preview ? DRAFT_TEXT : (state.newPageText ?? NEW_PAGE_TEXT);
  if (state.aboutStorefront) aboutBlocks.push(storefrontGroup('a2'));
  return {
    name: 'Fixture Bakery',
    domainName: 'fixture.example',
    siteDetails: { schema: {}, values: { timezone: 'America/Chicago', businessInfo: { name: 'Fixture Bakery', contactInfo: { phoneNumber: '555 0100' } } } },
    businessInfo: { name: 'Fixture Bakery', contactInfo: { phoneNumber: '555 0100' } },
    socialLinks: [],
    pages: [
      { slug: 'home', name: 'Home', format: 'home', blocks: [block('h1', 'section-header', { labels: { title: state.homeTitle ?? HOME_BEFORE_TEXT } })] },
      { slug: 'about', name: 'About', format: 'about', blocks: aboutBlocks },
      // Review B1: owner pages at the two booking addresses, booking off.
      { slug: 'book', name: 'Book', format: 'about', blocks: [block('b1', 'section-header', { labels: { title: OWNER_BOOK_TEXT } })] },
      { slug: 'booking', name: 'Booking', format: 'about', blocks: [block('b2', 'section-header', { labels: { title: 'Booking info' } })] },
      // A standard page with a coordinated storefront, a schedule and a lookup:
      // each must stay dynamic.
      { slug: 'menu', name: 'Menu', format: 'standard', blocks: [block('m1', 'section-header', { labels: { title: 'Menu' } }), storefrontGroup('m2')] },
      { slug: 'events', name: 'Events', format: 'schedule', blocks: [block('e1', 'section-header', { labels: { title: 'Events' } })] },
      {
        slug: 'faq', name: 'FAQ', format: 'lookup',
        blocks: [block('f1', 'collection', { bindings: [{ collectionId: POSTS, role: 'primary', sectionConfig: { queryFields: ['title'] } }] })],
      },
      {
        slug: 'links', name: 'Links', format: 'links',
        blocks: [
          block('l1', 'link-profile', { labels: { name: 'Fixture Bakery', line: 'Fresh bread' } }),
          block('l2', 'link-stack', { labels: { links: [{ id: 'lnk0001', kind: 'page', slug: 'about', label: 'About us' }] } }, 1),
        ],
      },
      { slug: 'blog', name: 'Blog', format: 'collection-list', detailPage: { enabled: true, itemCollectionId: POSTS, itemKeyField: 'slug' } },
      { slug: 'shop', name: 'Shop', format: 'catalog', blocks: [block('s1', 'products', { bindings: [{ collectionId: POSTS, role: 'primary' }] })] },
      ...(state.newPage ? [{ slug: NEW_PAGE_SLUG, name: 'New', format: 'about', blocks: [block('n1', 'section-header', { labels: { title: newPageText } })] }] : []),
      ...(state.rolledPage ? [{ slug: ROLLED_PAGE_SLUG, name: 'Rolled out', format: 'about', blocks: [block('r1', 'section-header', { labels: { title: ROLLED_PAGE_TEXT } })] }] : []),
      ...(state.coldPage ? [{ slug: COLD_PAGE_SLUG, name: 'Just opened', format: 'about', blocks: [block('j1', 'section-header', { labels: { title: COLD_PAGE_TEXT } })] }] : []),
      ...(state.sharePage
        ? [{
            slug: SHARE_PAGE_SLUG,
            name: 'New arrivals',
            format: 'about',
            labels: { ogImage: { currentFile: { source: `http://127.0.0.1:${UPSTREAM_PORT}${SHARE_IMAGE_PATH}` } } },
            blocks: [block('s9', 'section-header', { labels: { title: SHARE_PAGE_TEXT } })],
          }]
        : []),
    ],
    // R5: when the site document last changed, the same instant the version route answers.
    updatedAt: state.updatedAt ?? null,
    // C1: the IndexNow key, so `/api/indexnow/urls` answers an eligible list (RW-4, B4).
    indexNowKey: INDEXNOW_KEY,
  };
}

/** VR_Client_API's siteDetails query keys (`getSiteDetailsValidator`, with F41's optional `v`); any other is a 400. */
const SITE_DETAILS_KEYS = new Set(['siteId', 'v']);

export const FIXTURE_ITEMS = [
  { _id: '6a0000000000000000000d01', objectValue: { title: 'First loaf', slug: 'first-loaf', description: 'A loaf' }, publishDate: '2026-10-01T00:00:00.000Z' },
  { _id: '6a0000000000000000000d02', objectValue: { title: 'Second loaf', slug: 'second-loaf', description: 'Another' }, publishDate: '2026-10-02T00:00:00.000Z' },
];

/** The fixture upstream. Logs every path it is asked for (never a header). */
export function startFixtureUpstream({ port = UPSTREAM_PORT, items = FIXTURE_ITEMS, log = () => {}, state = {} } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fixture');
    log(`${req.method} ${url.pathname}`);
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status < 300 ? { success: true, data } : { success: false, data: null, error: 'Not found' }));
    };
    if (url.pathname === '/tenant/siteDetails') {
      // The shell read's query is logged (fixture ids only), so F41 can see `v`.
      log(`${req.method} ${url.pathname}${url.search}`);
      if ([...url.searchParams.keys()].some((key) => !SITE_DETAILS_KEYS.has(key))) return send(400, null);
      // RW-4: a Client that refuses `v` (a rollback past #137), one that is
      // down, one that holds every shell read, and a cold or held answer to a
      // `v` other than the stored version (a fresh read). The answer is built
      // when it is sent, so a held read answers the site as it is then.
      const v = url.searchParams.get('v');
      if (state.refuseV && v !== null) return send(400, null);
      if (state.shellDown) return send(503, null);
      // RW-4 (I9, N1): a preview read carries `x-vivreal-preview`. Presence
      // only, read here and never logged, as the request-header rule above.
      const preview = req.headers['x-vivreal-preview'] !== undefined;
      const delayMs = state.shellHoldMs || (v !== null && v !== state.updatedAt ? state.foreignVDelayMs : 0);
      if (delayMs) return void setTimeout(() => send(200, fixtureSiteDetails(state, { preview })), delayMs);
      return send(200, fixtureSiteDetails(state, { preview }));
    }
    // RW-4 follow-up: the share page's own image (a PNG signature, then the marker).
    if (url.pathname === SHARE_IMAGE_PATH) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(SHARE_IMAGE_MARKER)]));
    }
    // F41 (CL7): the site's version, a failure while `versionDown` is set, or
    // (RW-4) an answer later than the probe waits while `versionSlowMs` is.
    if (url.pathname === '/tenant/siteVersion') {
      state.versionAsked = (state.versionAsked ?? 0) + 1;
      const answer = () => send(200, { siteId: SITE_ID, updatedAt: state.updatedAt ?? '2026-11-01T00:00:00.000Z' });
      if (state.versionDown || state.versionSlowMs) state.versionFailures = (state.versionFailures ?? 0) + 1;
      if (state.versionDown) return send(500, null);
      if (state.versionSlowMs) return void setTimeout(answer, state.versionSlowMs);
      return answer();
    }
    if (url.pathname === '/tenant/collectionObjects') {
      const list = url.searchParams.get('collectionId') === POSTS ? items : [];
      return send(200, { items: list, totalCount: list.length });
    }
    if (url.pathname === '/tenant/integrationObjects') return send(200, { items: [], totalCount: 0 });
    return send(404, null);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

/** Route table rows from a prerender manifest. */
export function routeTable(manifest) {
  const rows = [];
  for (const [route, entry] of Object.entries(manifest?.routes ?? {})) {
    const seconds = entry?.initialRevalidateSeconds;
    rows.push({ route, kind: seconds === false || seconds === undefined ? 'static' : `isr ${seconds}s` });
  }
  for (const route of Object.keys(manifest?.dynamicRoutes ?? {})) rows.push({ route, kind: 'fallback' });
  return rows.sort((a, b) => a.route.localeCompare(b.route));
}

/** The manifest half. Returns the list of failures (empty when it holds). */
export function checkManifest(manifest, { gateOn }) {
  const failures = [];
  if (!manifest || typeof manifest !== 'object' || !manifest.routes) return ['no prerender manifest was parsed'];
  const dyn = manifest.dynamicRoutes ?? {};
  if ('/[slug]' in dyn) failures.push('dynamicRoutes has /[slug]: a page added after a build would answer 500');
  if ('/[slug]/[itemId]' in dyn) failures.push('dynamicRoutes has /[slug]/[itemId]: an unlisted item would answer 500');
  if (gateOn) {
    for (const route of ['/about', '/links', '/blog/first-loaf']) {
      const seconds = manifest.routes[route]?.initialRevalidateSeconds;
      if (seconds !== 300) failures.push(`${route} is not prerendered with revalidate 300 (got ${JSON.stringify(seconds)})`);
    }
    for (const route of ['/shop', '/checkoutsuccess', '/book', '/booking', '/booking/manage', '/menu', '/events', '/faq']) {
      if (route in manifest.routes) failures.push(`${route} was prerendered; it must stay dynamic`);
    }
  } else {
    for (const route of ['/about', '/links', '/blog/first-loaf']) {
      if (route in manifest.routes) failures.push(`${route} was prerendered with the render gate off`);
    }
  }
  return failures;
}

/** One response's verdict. */
export function cacheVerdict(headers) {
  const cache = (headers['cache-control'] ?? '').toLowerCase();
  const sMaxage = /s-maxage=(\d+)/.exec(cache);
  return {
    hit: (headers['x-nextjs-cache'] ?? '').toUpperCase() === 'HIT',
    sMaxage: sMaxage ? Number(sMaxage[1]) : null,
    noStore: /no-store/.test(cache),
  };
}

/** The response half: [path, status, headers] for the first and second read. Returns failures. */
export function checkResponses(reads, { gateOn }) {
  const failures = [];
  const byPath = new Map(reads.map((r) => [r.path, r]));
  for (const r of reads) {
    if (r.second.status >= 500) failures.push(`${r.path} answered ${r.second.status}`);
  }
  // `/book` is the owner's own page while booking is off (T14, review B1).
  const expectStatus = { '/about': 200, '/links': 200, '/blog/first-loaf': 200, '/blog/6a0000000000000000000d02': 200, '/shop': 200, '/book': 200, '/booking': 200 };
  for (const [p, status] of Object.entries(expectStatus)) {
    const r = byPath.get(p);
    if (!r) failures.push(`${p} was not read`);
    else if (r.second.status !== status) failures.push(`${p} answered ${r.second.status}, expected ${status}`);
  }
  const book = byPath.get('/book');
  if (book && !(book.second.body ?? '').includes(OWNER_BOOK_TEXT)) failures.push('/book does not show the owner\'s own book page');
  const cached = gateOn ? ['/about', '/links', '/blog/first-loaf'] : [];
  const uncached = gateOn
    ? ['/shop', '/checkoutsuccess?session_id=cs_test_abc', '/book', '/booking', '/blog/6a0000000000000000000d02', '/menu', '/menu?sort=price', '/events', '/faq?q=loaf']
    : ['/about', '/links', '/blog/first-loaf', '/shop', '/book', '/menu'];
  // The target is the HOME page's behaviour (plan 3.8, D43): a cached HIT with
  // the same s-maxage the home page is served with. (Measured 2026-10-29: a
  // fresh worktree served 300 for `/` and every cached inner page; one reused
  // checkout served 60 for `/` and the inner pages alike, cause not found.
  // Parity with `/` is the claim; the manifest half above pins the 300.)
  const home = cacheVerdict(byPath.get('/')?.second.headers ?? {});
  if (gateOn && (!home.hit || !home.sMaxage)) failures.push('/ is not a cached HIT, so there is no home behaviour to match');
  for (const p of cached) {
    const v = cacheVerdict(byPath.get(p)?.second.headers ?? {});
    if (!v.hit || v.sMaxage === null || v.sMaxage !== home.sMaxage) failures.push(`${p} second read is not a cached HIT with the home page's s-maxage`);
  }
  for (const p of uncached) {
    const v = cacheVerdict(byPath.get(p)?.second.headers ?? {});
    if (!v.noStore || v.hit) failures.push(`${p} is not no-store`);
  }
  return failures;
}

export const READ_PATHS = [
  '/', '/about', '/links', '/blog/first-loaf', '/blog/6a0000000000000000000d02', '/shop',
  '/checkoutsuccess?session_id=cs_test_abc', '/book', '/booking', '/booking/manage',
  '/menu', '/menu?sort=price', '/events', '/faq?q=loaf',
];

/** Text only the storefront the owner adds to `/about` draws (a fixture item title). */
export const STOREFRONT_TEXT = 'First loaf';

/**
 * Review B2: after the build, the owner adds a shop section to the cached
 * `/about`, the save sends a signed `site.updated`, and `/about` is read again.
 * It must never answer 500, AND it must show the new storefront (unfiltered)
 * within the reads: a regeneration that fails behind a stale copy is the
 * same defect with a 200 on it. `flip` is the revalidate answer, `after`
 * every read after it, in order.
 */
export function checkAfterFlip(flip, after) {
  const failures = [];
  if (flip.status !== 200 || !/"revalidated":true/.test(flip.body ?? '')) failures.push(`the signed site.updated was not accepted (${flip.status})`);
  if (after.length === 0) failures.push('nothing was read after the flip');
  for (const r of after) {
    if (r.status >= 500 || r.status === 0) failures.push(`${r.path} answered ${r.status} after the owner added a storefront`);
  }
  if (after.length > 0 && !after.some((r) => r.status === 200 && (r.body ?? '').includes(STOREFRONT_TEXT))) {
    failures.push('/about never showed the storefront the owner added (the regeneration failed behind a stale copy)');
  }
  return failures;
}

/**
 * RW-4, the server's first ordinary read with the version route slow. `reads`
 * are the reads of the page added after the build (status, body), the first
 * of them the server's first ordinary read; `shellReads` the shell reads
 * logged meanwhile; `updatedAt` the stored site's version.
 */
export function checkColdFirstRead({ reads, shellReads, updatedAt }) {
  const failures = [];
  if (reads.length < 2) failures.push('the cold phase read the new page fewer than twice');
  reads.forEach((r, i) => {
    if (r.status !== 200 || !(r.body ?? '').includes(COLD_PAGE_TEXT)) {
      failures.push(`/${COLD_PAGE_SLUG} read ${i + 1} answered ${r.status}${r.status === 200 ? ' without its page' : ''}: a first read with a slow probe took a copy from before the stored site`);
    }
  });
  const learned = `v=${encodeURIComponent(updatedAt)}`;
  if (!shellReads.some((p) => p.includes(learned))) failures.push(`no shell read carried ${learned}: the fresh read's version was not kept`);
  return failures;
}

/**
 * F41 through the real route. `before` is the new page's answer before the
 * owner added it; `after` every read after (status, body); `shellReads` every
 * shell read logged after the change. RW-4: `kept` are the reads of the new
 * page while the version route failed and then was slow, `keptShellReads` the
 * shell reads logged meanwhile, `failedProbes` how many probes the version
 * route failed or held in that time.
 */
export function checkVersionFence({ before, after, shellReads, updatedAt, kept, keptShellReads, failedProbes }) {
  const failures = [];
  if (!before || before.status !== 404) failures.push(`control: /${NEW_PAGE_SLUG} answered ${before?.status} before the owner added it`);
  if (after.length === 0) failures.push('nothing was read after the change');
  for (const r of after) if (r.status >= 500 || r.status === 0) failures.push(`/${NEW_PAGE_SLUG} answered ${r.status}`);
  const shown = after.findIndex((r) => r.status === 200 && (r.body ?? '').includes(NEW_PAGE_TEXT));
  if (shown === -1) failures.push(`/${NEW_PAGE_SLUG} never answered 200 with its page after the change (a stale 404)`);
  const expected = `v=${encodeURIComponent(updatedAt)}`;
  if (!shellReads.some((p) => p.includes(expected))) failures.push(`no shell read carried ${expected} after the change`);
  if (kept.length === 0) failures.push('nothing was read while the version route failed');
  if (failedProbes < 2) failures.push(`control: ${failedProbes} probe(s) failed or were held while the page was read, so the keep was not tested`);
  kept.forEach((r, i) => {
    if (r.status !== 200 || !(r.body ?? '').includes(NEW_PAGE_TEXT)) {
      failures.push(`/${NEW_PAGE_SLUG} answered ${r.status}${r.status === 200 ? ' without its page' : ''} on read ${i + 1} while the version route failed: the server went back to an older site`);
    }
  });
  const plain = keptShellReads.filter((p) => !/[?&]v=/.test(p));
  if (plain.length) failures.push(`a shell read went back to the plain key while the version route failed: ${plain.join(', ')}`);
  // N1: once the version is known, every shell read carries it (no fresh instant either).
  const other = keptShellReads.filter((p) => /[?&]v=/.test(p) && !p.includes(`v=${encodeURIComponent(updatedAt)}`));
  if (other.length) failures.push(`a shell read carried another v while the version was known: ${other.join(', ')}`);
  return failures;
}

/** Whether a read answered 200 with `text` in its page. */
const shows = (r, text) => r?.status === 200 && (r.body ?? '').includes(text);

/**
 * RW-4 (I3, I7, T3b): the server's first ordinary read, the version route
 * slow and every fresh read held. It answers within the 6.5 s budget (plus the
 * render's own time), and a page the stale plain copy lacks is never a 404.
 */
export function checkColdBudget({ read, elapsedMs }) {
  const failures = [];
  if (elapsedMs > 6_500 + RENDER_ALLOWANCE_MS) failures.push(`/${COLD_PAGE_SLUG} took ${elapsedMs} ms with the probe slow and the fresh read held (budget 6500 ms)`);
  if (read?.status === 404) failures.push(`/${COLD_PAGE_SLUG} answered 404 from a plain copy older than the stored site (it must refuse, 5xx)`);
  if (!read || read.status === 0) failures.push(`/${COLD_PAGE_SLUG} never answered`);
  return failures;
}

/**
 * RW-4 (I2, G5): a signed `site.updated` inside the probe interval. The read
 * after it probes first, so its shell read carries the new version and the
 * page shows the changed words.
 */
export function checkWebhookProbe({ hook, read, shellReads, updatedAt }) {
  const failures = [];
  if (hook?.status !== 200) failures.push(`the signed site.updated answered ${hook?.status}`);
  if (!shows(read, CHANGED_TEXT)) failures.push(`/${NEW_PAGE_SLUG} answered ${read?.status} without the changed words after the webhook`);
  const expected = `v=${encodeURIComponent(updatedAt)}`;
  if (!shellReads.some((p) => p.includes(expected))) failures.push(`no shell read after the webhook carried ${expected}: the webhook did not make the probe due (${shellReads.join(', ') || 'no shell read'})`);
  return failures;
}

/**
 * RW-4 (I3 with L, T11): after a purge, the Client holds every shell read.
 * The page answers from the newest shell this server served, within 4.5 s.
 */
export function checkHeldShell({ read, elapsedMs }) {
  const failures = [];
  if (elapsedMs > 4_500 + RENDER_ALLOWANCE_MS) failures.push(`/${NEW_PAGE_SLUG} took ${elapsedMs} ms with every shell read held (budget 4500 ms)`);
  if (!shows(read, CHANGED_TEXT)) failures.push(`/${NEW_PAGE_SLUG} answered ${read?.status} without its page while every shell read was held`);
  return failures;
}

/**
 * RW-4 (I1, I4, T11): after a purge, every shell read fails. The page answers
 * from the newest shell this server served, never the floor or a 5xx.
 */
export function checkShellDown({ read }) {
  return shows(read, CHANGED_TEXT) ? [] : [`/${NEW_PAGE_SLUG} answered ${read?.status} without its page while every shell read failed (the floor, not the newest shell served)`];
}

/**
 * RW-4 (B1, G2, T15b and T15a): the Client refuses every `v` (a rollback past
 * #137). A page saved meanwhile answers from the plain read (K learned above
 * L by the probe), and a page already served still answers.
 */
export function checkRefusedV({ rolled, kept }) {
  const failures = [];
  if (!shows(rolled, ROLLED_PAGE_TEXT)) failures.push(`/${ROLLED_PAGE_SLUG} answered ${rolled?.status} without its page while the Client refused v (K above L)`);
  if (!shows(kept, CHANGED_TEXT)) failures.push(`/${NEW_PAGE_SLUG} answered ${kept?.status} without its page while the Client refused v (K = L)`);
  return failures;
}

/**
 * RW-4 (P1, gate on): a regeneration is a KNOWN reader. After a purge, the
 * home page's regeneration reads the known version, never the plain key.
 */
export function checkRegenerationKnown({ shellReads, updatedAt }) {
  const failures = [];
  if (shellReads.length === 0) failures.push('control: the purged home page made no shell read, so the regeneration was not tested');
  const expected = `v=${encodeURIComponent(updatedAt)}`;
  if (shellReads.length && !shellReads.some((p) => p.includes(expected))) failures.push(`the regeneration's shell reads never carried ${expected}: ${shellReads.join(', ')}`);
  const plain = shellReads.filter((p) => !/[?&]v=/.test(p));
  if (plain.length) failures.push(`the regeneration read the plain key while the version was known: ${plain.join(', ')}`);
  return failures;
}

/**
 * RW-4 (I9, review pass 6 N1): a portal preview learns nothing. `preview` is
 * the owner's draft render after a save (it must show the draft words: the
 * control that the preview session ran and the fixture saw the preview
 * header); `publicRead` the public page after that, with every shell read
 * failing: it answers from the newest PUBLIC shell this server served, never
 * the draft. A preview that taught `L` would show the draft to every visitor
 * in an all-fail render.
 */
export function checkPreviewNeverLearned({ preview, publicRead }) {
  const failures = [];
  if (!shows(preview, DRAFT_TEXT)) failures.push(`control: the preview render answered ${preview?.status} without the draft words (no preview session, or the fixture saw no preview header)`);
  if (!shows(publicRead, CHANGED_TEXT)) failures.push(`/${NEW_PAGE_SLUG} answered ${publicRead?.status} without its public page while every shell read failed`);
  if ((publicRead?.body ?? '').includes(DRAFT_TEXT)) failures.push(`/${NEW_PAGE_SLUG} showed the preview's draft words to the public: the preview render taught L`);
  return failures;
}

/**
 * RW-4 (P1, I1, gate unset): home never shows words older than a page the
 * same server served. `before` is home before the save, `page` an ordinary
 * page after it (it probes), `after` home after that.
 */
export function checkHomeNotOlder({ before, page, after }) {
  const failures = [];
  if (!shows(before, HOME_BEFORE_TEXT) || shows(before, HOME_AFTER_TEXT)) failures.push(`control: / answered ${before?.status} without the words from before the save`);
  if (page?.status !== 200) failures.push(`the ordinary page read after the save answered ${page?.status}`);
  if (!shows(after, HOME_AFTER_TEXT)) failures.push(`/ answered ${after?.status} with words older than the page this server just served`);
  return failures;
}

/**
 * RW-4 follow-up: the share image and the sitemap through the fence. `before`
 * are the reads before the owner added the page, `first` the first reads
 * after (share image, then sitemap, then the page), `probesInWindow` how many
 * version probes the three readers made inside one interval (one, across all
 * three), `kept` the sitemap read one interval into a version route failure,
 * with the probes that failed and the shell reads logged meanwhile.
 */
export function checkShareAndSitemap({ before, first, probesInWindow, windowMs, kept }) {
  const failures = [];
  const listed = (r) => r?.status === 200 && (r.body ?? '').includes(`/${SHARE_PAGE_SLUG}</loc>`);
  const ownImage = (r) => r?.status === 200 && (r.body ?? '').includes(SHARE_IMAGE_MARKER);
  // RW-4 B4: the signed IndexNow list is the sitemap, so it lists the page too.
  const inIndexNow = (r) => r?.status === 200 && (r.body ?? '').includes(`/${SHARE_PAGE_SLUG}"`);
  if (listed(before.sitemap)) failures.push(`control: the sitemap listed /${SHARE_PAGE_SLUG} before the owner added it`);
  if (before.sitemap?.status !== 200) failures.push(`control: /sitemap.xml answered ${before.sitemap?.status}`);
  if (ownImage(before.og)) failures.push(`control: /og/${SHARE_PAGE_SLUG} drew the page's own image before the owner added it`);
  if (before.indexnow?.status !== 200 || inIndexNow(before.indexnow)) failures.push(`control: /api/indexnow/urls answered ${before.indexnow?.status}${inIndexNow(before.indexnow) ? ' with the page before the owner added it' : ''}`);
  if (!ownImage(first.og)) failures.push(`/og/${SHARE_PAGE_SLUG} answered ${first.og?.status} without the page's own image on the first read after the save`);
  if (!listed(first.sitemap)) failures.push(`/sitemap.xml answered ${first.sitemap?.status} without /${SHARE_PAGE_SLUG} on the first read after the save`);
  if (!inIndexNow(first.indexnow)) failures.push(`/api/indexnow/urls answered ${first.indexnow?.status} without /${SHARE_PAGE_SLUG} on the first read after the save`);
  if (first.page?.status !== 200 || !(first.page.body ?? '').includes(SHARE_PAGE_TEXT)) failures.push(`/${SHARE_PAGE_SLUG} answered ${first.page?.status} without its page`);
  if (!(windowMs < 5000)) failures.push(`the four readers took ${windowMs} ms, past one probe interval, so the shared limit could not be judged`);
  else if (probesInWindow !== 1) failures.push(`${probesInWindow} version probes inside one interval across the page, the share image, the sitemap and the IndexNow list (the limit is one per server)`);
  if (kept.failedProbes < 1) failures.push('control: no probe failed while the sitemap was read, so the keep was not tested');
  if (!listed(kept.sitemap)) failures.push(`/sitemap.xml answered ${kept.sitemap?.status} without /${SHARE_PAGE_SLUG} while the version route failed: an older sitemap than the server already served`);
  const plain = kept.shellReads.filter((p) => !/[?&]v=/.test(p));
  if (plain.length) failures.push(`a sitemap shell read went back to the plain key while the version route failed: ${plain.join(', ')}`);
  return failures;
}

function run(cmd, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', ...opts });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

function get(p, headers = {}) {
  return new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port: APP_PORT, path: p, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    }).on('error', () => resolve({ status: 0, headers: {}, body: '' }));
  });
}

function postSigned(p, payload) {
  const raw = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', REVALIDATE_SECRET).update(raw).digest('hex');
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: APP_PORT, path: p, method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vivreal-Signature': `sha256=${signature}`, 'X-Vivreal-Event': payload.event } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', () => resolve({ status: 0, body: '' }));
    req.end(raw);
  });
}

/** The signed IndexNow snapshot request the EventHandler worker makes (`{ ts }`, same secret as revalidate). */
function postSnapshot() {
  const raw = JSON.stringify({ ts: Date.now() });
  const signature = crypto.createHmac('sha256', REVALIDATE_SECRET).update(raw).digest('hex');
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: APP_PORT, path: '/api/indexnow/urls', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vivreal-Signature': `sha256=${signature}` } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', () => resolve({ status: 0, body: '' }));
    req.end(raw);
  });
}

/** A signed `site.updated` for the whole site (the purge, and the fence's probe made due). */
const siteUpdated = () => postSigned('/api/revalidate', { id: `evt-${Date.now()}`, event: 'site.updated', timestamp: new Date().toISOString(), data: { siteId: SITE_ID } });

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

async function read(p) {
  const r = await get(p);
  return { status: r.status, body: r.body };
}

/** A `Location` as a site-relative path, whether the server sent it absolute or relative. */
function relativeLocation(location) {
  const url = new URL(location ?? '/', `http://127.0.0.1:${APP_PORT}`);
  return `${url.pathname}${url.search}`;
}

/**
 * The owner's portal preview of `p`: the `?vivreal_preview=<token>` link the
 * portal emits, through middleware's 307 to `/api/preview/enable`, which
 * starts the draft session (its cookies), then the page itself with those
 * cookies, as the browser would load it. `hops` are the two redirect statuses.
 */
async function previewRead(p) {
  const link = await get(`${p}?vivreal_preview=${PREVIEW_TOKEN}`);
  const enable = await get(relativeLocation(link.headers.location));
  const cookies = (enable.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
  const page = await get(relativeLocation(enable.headers.location), cookies ? { cookie: cookies } : {});
  return { status: page.status, body: page.body, hops: [link.status, enable.status], cookies: cookies ? cookies.split('; ').length : 0 };
}

/** A read and how long it took, in ms. */
async function timedRead(p) {
  const startedAt = Date.now();
  const r = await read(p);
  return { read: r, elapsedMs: Date.now() - startedAt };
}

async function waitUp() {
  for (let i = 0; i < 120; i += 1) {
    if ((await get('/robots.txt')).status > 0) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const gateOn = !process.argv.includes('--gate-off');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const seen = new Set();
  const shellReads = [];
  const state = {
    aboutStorefront: false,
    newPage: false,
    newPageText: NEW_PAGE_TEXT,
    coldPage: false,
    rolledPage: false,
    sharePage: false,
    homeTitle: HOME_BEFORE_TEXT,
    versionDown: false,
    versionSlowMs: 0,
    versionFailures: 0,
    versionAsked: 0,
    refuseV: false,
    shellDown: false,
    shellHoldMs: 0,
    foreignVDelayMs: 0,
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
  const upstream = await startFixtureUpstream({
    log: (line) => {
      if (line.startsWith('GET /tenant/siteDetails?')) shellReads.push(line.slice(4));
      else seen.add(line);
    },
    state,
  });
  const env = {
    ...process.env,
    NEXT_PUBLIC_CLIENT_API: `http://127.0.0.1:${UPSTREAM_PORT}`,
    SITE_ID,
    API_KEY: 'fixture-key',
    NEXT_PUBLIC_SENTRY_DSN: '',
    SENTRY_AUTH_TOKEN: '',
    NEXT_TELEMETRY_DISABLED: '1',
    // What the provisioner sets on every site (src/lib/siteCacheTtl.ts); the 60 s default would cap every page at 60.
    SITE_CACHE_TTL_SECONDS: '300',
    NEXT_PUBLIC_ANALYTICS_ENDPOINT: `http://127.0.0.1:${UPSTREAM_PORT}/beacon`,
    REVALIDATE_WEBHOOK_SECRET: REVALIDATE_SECRET,
  };
  if (gateOn) env.SITE_RENDER_MODE = 'isr';
  else delete env.SITE_RENDER_MODE;

  const failures = [];
  // A clean build every time: a data cache left by an earlier build (another
  // TTL, another commit) would be served instead of this build's renders.
  fs.rmSync(path.join(root, '.next'), { recursive: true, force: true });
  const build = await run('npx', ['next', 'build'], { cwd: root, env });
  if (build.code !== 0) {
    console.log(build.out.split('\n').slice(-60).join('\n'));
    failures.push(`next build exited ${build.code}`);
  } else {
    console.log(build.out.split('\n').filter((l) => /^[├└┌│]|Route|○|●|ƒ/.test(l.trim())).join('\n'));
    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.next', 'prerender-manifest.json'), 'utf8'));
    console.log('\nprerender-manifest route table:');
    for (const row of routeTable(manifest)) console.log(`  ${row.kind.padEnd(10)} ${row.route}`);
    failures.push(...checkManifest(manifest, { gateOn }));

    // A server left on the port by an earlier run would answer for this build.
    if ((await get('/robots.txt')).status > 0) {
      failures.push(`port ${APP_PORT} already answers: stop the earlier server first`);
      upstream.close();
      console.log(`FAIL: ${failures.join('; ')}`);
      process.exit(1);
    }
    // ISR_CHECK_SERVER_LOG=<absolute path> keeps the server's own output for diagnosis.
    const serverLog = process.env.ISR_CHECK_SERVER_LOG ? fs.openSync(process.env.ISR_CHECK_SERVER_LOG, 'w') : 'ignore';
    const server = spawn('npx', ['next', 'start', '-p', String(APP_PORT)], { cwd: root, env, stdio: ['ignore', serverLog, serverLog], shell: process.platform === 'win32' });
    try {
      if (!(await waitUp())) failures.push('next start did not come up');
      else {
        if (gateOn) {
          // F41 a (RW-4 I3, I7, T3b): the server's first ordinary read, the
          // version route slow and every fresh read held. The data cache holds
          // the build's plain shell, from before this page was added. Settle
          // first, so a background refresh started by the readiness read
          // cannot pick up the page.
          await wait(1500);
          state.versionSlowMs = VERSION_SLOW_MS;
          state.foreignVDelayMs = HOLD_MS;
          state.coldPage = true;
          state.updatedAt = new Date().toISOString();
          const cold = await timedRead(`/${COLD_PAGE_SLUG}`);
          console.log(`  F41 a first read, probe slow, fresh read held: ${cold.read.status} in ${cold.elapsedMs} ms /${COLD_PAGE_SLUG}`);
          failures.push(...checkColdBudget(cold));

          // F41 b (RW-4 row 2, R3, G6): still a server with nothing learned.
          // Home first (it reads plain and teaches nothing), then with the
          // probe slow the fresh read answers like a cold Client, in 4 s.
          await wait(5500);
          state.foreignVDelayMs = COLD_FRESH_MS;
          await read('/');
          const coldFrom = shellReads.length;
          const coldReads = [];
          for (let i = 0; i < 2; i += 1) {
            const r = await read(`/${COLD_PAGE_SLUG}`);
            coldReads.push(r);
            console.log(`  F41 b home first, probe slow, cold fresh read, read ${i + 1}: ${r.status} ${r.body.includes(COLD_PAGE_TEXT) ? 'new page' : 'old copy'} /${COLD_PAGE_SLUG}`);
          }
          state.versionSlowMs = 0;
          state.foreignVDelayMs = 0;
          failures.push(...checkColdFirstRead({ reads: coldReads, shellReads: shellReads.slice(coldFrom), updatedAt: state.updatedAt }));
        }
        const reads = [];
        for (const p of READ_PATHS) {
          const first = await get(p);
          const second = await get(p);
          reads.push({ path: p, first, second });
          console.log(`  ${String(second.status).padEnd(4)} ${(second.headers['x-nextjs-cache'] ?? '-').toString().padEnd(6)} ${(second.headers['cache-control'] ?? '').toString().padEnd(60)} ${p}`);
        }
        failures.push(...checkResponses(reads, { gateOn }));

        // Review B2: the owner adds a shop section to the cached /about.
        state.aboutStorefront = true;
        const flip = await postSigned('/api/revalidate', { id: 'evt1', event: 'site.updated', timestamp: new Date().toISOString(), data: { siteId: SITE_ID, slug: 'about' } });
        const after = [];
        for (const p of ['/about', '/about', '/about?sort=price', '/about', '/about', '/about', '/about', '/about']) {
          const r = await get(p);
          after.push({ path: p, status: r.status, body: r.body });
          console.log(`  after flip: ${String(r.status).padEnd(4)} ${(r.headers['x-nextjs-cache'] ?? '-').toString().padEnd(6)} ${r.body.includes(STOREFRONT_TEXT) ? 'storefront' : 'old copy  '} ${p}`);
          await new Promise((res) => setTimeout(res, 1000));
        }
        failures.push(...checkAfterFlip(flip, after));

        if (!gateOn) {
          // F41 f, gate unset (RW-4 P1, I1): home is a KNOWN reader, so it
          // never shows words older than a page this server served.
          await wait(5500);
          const homeBefore = await read('/');
          state.homeTitle = HOME_AFTER_TEXT;
          state.updatedAt = new Date().toISOString();
          await wait(5500);
          const page = await read('/about');
          const homeAfter = await read('/');
          console.log(`  F41 f home after an ordinary page served the save: ${homeAfter.status} ${homeAfter.body.includes(HOME_AFTER_TEXT) ? 'new words' : 'old words'} /`);
          failures.push(...checkHomeNotOlder({ before: homeBefore, page, after: homeAfter }));
        }

        if (gateOn) {
          // F41 ALLOW: the owner adds a page; no webhook is sent. Past one
          // interval first, so a probe runs.
          await new Promise((res) => setTimeout(res, 5500));
          const before = await get(`/${NEW_PAGE_SLUG}`);
          state.newPage = true;
          state.updatedAt = new Date().toISOString();
          const changeFrom = shellReads.length;
          const afterChange = [];
          for (let i = 0; i < 12; i += 1) {
            await new Promise((res) => setTimeout(res, 1000));
            const r = await get(`/${NEW_PAGE_SLUG}`);
            afterChange.push({ status: r.status, body: r.body });
            console.log(`  F41 after change +${i + 1}s: ${r.status} ${r.body.includes(NEW_PAGE_TEXT) ? 'new page' : 'not yet  '} /${NEW_PAGE_SLUG}`);
            if (r.status === 200 && r.body.includes(NEW_PAGE_TEXT)) break;
          }
          const changeShellReads = shellReads.slice(changeFrom);
          // RW-4 row 1: the version route fails (a 500), then is slow (a
          // timeout), each across one probe interval. The new page must hold.
          const keptFrom = shellReads.length;
          const failuresBefore = state.versionFailures;
          const kept = [];
          for (const mode of ['down', 'slow']) {
            state.versionDown = mode === 'down';
            state.versionSlowMs = mode === 'slow' ? VERSION_SLOW_MS : 0;
            for (let i = 0; i < 3; i += 1) {
              await new Promise((res) => setTimeout(res, 2500));
              const r = await get(`/${NEW_PAGE_SLUG}`);
              kept.push({ status: r.status, body: r.body });
              console.log(`  F41 version route ${mode} +${(i + 1) * 2.5}s: ${r.status} ${r.body.includes(NEW_PAGE_TEXT) ? 'new page' : 'old copy'} /${NEW_PAGE_SLUG}`);
            }
          }
          state.versionDown = false;
          state.versionSlowMs = 0;
          failures.push(
            ...checkVersionFence({
              before,
              after: afterChange,
              shellReads: changeShellReads,
              updatedAt: state.updatedAt,
              kept,
              keptShellReads: shellReads.slice(keptFrom),
              failedProbes: state.versionFailures - failuresBefore,
            }),
          );

          // F41 e (RW-4 I2, G5): inside the probe interval, the owner changes
          // the page's words and the save sends a signed site.updated. The
          // webhook makes the probe due, so the next read carries the new v.
          await wait(5500);
          await read(`/${NEW_PAGE_SLUG}`); // a probe runs now
          state.newPageText = CHANGED_TEXT;
          state.updatedAt = new Date().toISOString();
          const hookFrom = shellReads.length;
          const hook = await siteUpdated();
          const changed = await read(`/${NEW_PAGE_SLUG}`);
          console.log(`  F41 e after the webhook, inside the interval: ${changed.status} ${changed.body.includes(CHANGED_TEXT) ? 'changed words' : 'old words'}, shell reads ${JSON.stringify(shellReads.slice(hookFrom))}`);
          failures.push(...checkWebhookProbe({ hook, read: changed, shellReads: shellReads.slice(hookFrom), updatedAt: state.updatedAt }));

          // F41 g (RW-4 I3 with L, T11): after a purge the Client holds every
          // shell read; the page answers from the newest shell served, in time.
          await wait(5500);
          await siteUpdated();
          state.shellHoldMs = HOLD_MS;
          const held = await timedRead(`/${NEW_PAGE_SLUG}`);
          state.shellHoldMs = 0;
          console.log(`  F41 g every shell read held: ${held.read.status} in ${held.elapsedMs} ms /${NEW_PAGE_SLUG}`);
          failures.push(...checkHeldShell(held));

          // F41 h (RW-4 I1, I4, T11): after a purge every shell read fails.
          await wait(5500);
          await siteUpdated();
          state.shellDown = true;
          const down = await read(`/${NEW_PAGE_SLUG}`);
          state.shellDown = false;
          console.log(`  F41 h every shell read failing: ${down.status} ${down.body.includes(CHANGED_TEXT) ? 'its page' : 'not its page'} /${NEW_PAGE_SLUG}`);
          failures.push(...checkShellDown({ read: down }));

          // F41 i (RW-4 B1, G2): the Client refuses every v (a rollback past
          // #137). A page saved meanwhile, and a page already served, answer.
          await wait(5500);
          state.rolledPage = true;
          state.updatedAt = new Date().toISOString();
          state.refuseV = true;
          await siteUpdated();
          const rolled = await read(`/${ROLLED_PAGE_SLUG}`);
          const keptPage = await read(`/${NEW_PAGE_SLUG}`);
          state.refuseV = false;
          console.log(`  F41 i Client refusing v: ${rolled.status} /${ROLLED_PAGE_SLUG}, ${keptPage.status} /${NEW_PAGE_SLUG}`);
          failures.push(...checkRefusedV({ rolled, kept: keptPage }));

          // F41 d (RW-4 follow-up, B4): the owner adds a page with its own
          // share image; no webhook. Past one interval before each step.
          await wait(5500);
          const shareBefore = { og: await read(`/og/${SHARE_PAGE_SLUG}`), sitemap: await read('/sitemap.xml'), indexnow: await postSnapshot() };
          state.sharePage = true;
          state.updatedAt = new Date().toISOString();
          await wait(5500);
          // The first reads after the save, the share image first, then a burst
          // of all four readers, all inside one probe interval.
          const askedFrom = state.versionAsked;
          const windowFrom = Date.now();
          const shareFirst = {
            og: await read(`/og/${SHARE_PAGE_SLUG}`),
            sitemap: await read('/sitemap.xml'),
            indexnow: await postSnapshot(),
            page: await read(`/${SHARE_PAGE_SLUG}`),
          };
          await Promise.all([read('/sitemap.xml'), read(`/og/${SHARE_PAGE_SLUG}`), postSnapshot(), read(`/${SHARE_PAGE_SLUG}`)]);
          const probesInWindow = state.versionAsked - askedFrom;
          const windowMs = Date.now() - windowFrom;
          console.log(`  F41 d IndexNow list after the save: ${shareFirst.indexnow.status} ${shareFirst.indexnow.body.includes(`/${SHARE_PAGE_SLUG}"`) ? 'lists it' : 'missing'}`);
          console.log(`  F41 share image after the save: ${shareFirst.og.status} ${shareFirst.og.body.includes(SHARE_IMAGE_MARKER) ? 'own image' : 'not its own'} /og/${SHARE_PAGE_SLUG}`);
          console.log(`  F41 sitemap after the save: ${shareFirst.sitemap.status} ${shareFirst.sitemap.body.includes(`/${SHARE_PAGE_SLUG}</loc>`) ? 'lists it' : 'missing  '} /sitemap.xml; probes across four readers in ${windowMs} ms: ${probesInWindow}`);
          // Then the version route fails for an interval: the sitemap holds.
          state.versionDown = true;
          const shareFailuresFrom = state.versionFailures;
          await wait(5500);
          const sitemapKeptFrom = shellReads.length;
          const sitemapKept = await read('/sitemap.xml');
          const sitemapKeptShellReads = shellReads.slice(sitemapKeptFrom);
          state.versionDown = false;
          console.log(`  F41 sitemap, version route down: ${sitemapKept.status} ${sitemapKept.body.includes(`/${SHARE_PAGE_SLUG}</loc>`) ? 'lists it' : 'missing  '} /sitemap.xml`);
          failures.push(
            ...checkShareAndSitemap({
              before: shareBefore,
              first: shareFirst,
              probesInWindow,
              windowMs,
              kept: { sitemap: sitemapKept, failedProbes: state.versionFailures - shareFailuresFrom, shellReads: sitemapKeptShellReads },
            }),
          );

          // F41 f, gate on (RW-4 P1): after a purge, the home page's
          // regeneration (a KNOWN reader) reads the known version.
          await wait(1000);
          await siteUpdated();
          const regenFrom = shellReads.length;
          await read('/');
          await read('/');
          await wait(2000); // a regeneration that runs after the answer completes
          const regenShellReads = shellReads.slice(regenFrom);
          console.log(`  F41 f home regeneration after a purge, shell reads ${JSON.stringify(regenShellReads)}`);
          failures.push(...checkRegenerationKnown({ shellReads: regenShellReads, updatedAt: state.updatedAt }));

          // F41 j (RW-4 I9, review pass 6 N1): a portal preview learns
          // nothing. The owner saves (no webhook), their preview reads the
          // draft first, and then, with every public shell read failing, the
          // public page answers from the newest PUBLIC shell this server
          // served. A preview classed FULL would teach L the draft here.
          await wait(5500);
          state.updatedAt = new Date().toISOString();
          const preview = await previewRead(`/${NEW_PAGE_SLUG}`);
          console.log(`  F41 j preview render: ${preview.status} ${preview.body.includes(DRAFT_TEXT) ? 'draft words' : 'public words'}, hops ${preview.hops.join(' ')}, cookies ${preview.cookies} /${NEW_PAGE_SLUG}`);
          await siteUpdated();
          state.shellDown = true;
          const publicRead = await read(`/${NEW_PAGE_SLUG}`);
          state.shellDown = false;
          console.log(`  F41 j public page, every shell read failing: ${publicRead.status} ${publicRead.body.includes(DRAFT_TEXT) ? 'DRAFT WORDS' : publicRead.body.includes(CHANGED_TEXT) ? 'public page' : 'not its page'} /${NEW_PAGE_SLUG}`);
          failures.push(...checkPreviewNeverLearned({ preview, publicRead }));
        }
      }
    } finally {
      if (process.platform === 'win32') await run('taskkill', ['/pid', String(server.pid), '/T', '/F'], {});
      else server.kill('SIGTERM');
      // Wait for the port to close, so the next run cannot read this server.
      for (let i = 0; i < 40 && (await get('/robots.txt')).status > 0; i += 1) await new Promise((r) => setTimeout(r, 250));
    }
  }
  upstream.close();
  console.log(`\nupstream paths read: ${[...seen].sort().join(', ')}`);
  console.log(`shell reads: ${shellReads.length}, versioned ${shellReads.filter((p) => /[?&]v=/.test(p)).length}`);
  console.log(failures.length ? `\nFAIL (${gateOn ? 'gate on' : 'gate off'}):\n  ${failures.join('\n  ')}` : `\nPASS (${gateOn ? 'gate on' : 'gate off'})`);
  process.exit(failures.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
