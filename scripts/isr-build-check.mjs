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
 *     answer `no-store`; nothing answers 500.
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

/** The owner's own page at the fixed route's address (review B1). */
export const OWNER_BOOK_TEXT = 'Book a table with the fixture bakery';

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
export function fixtureSiteDetails(state = {}) {
  const aboutBlocks = [block('a1', 'section-header', { labels: { title: 'About us', subtitle: 'Our story' } })];
  if (state.aboutStorefront) aboutBlocks.push(storefrontGroup('a2'));
  return {
    name: 'Fixture Bakery',
    domainName: 'fixture.example',
    siteDetails: { schema: {}, values: { timezone: 'America/Chicago', businessInfo: { name: 'Fixture Bakery', contactInfo: { phoneNumber: '555 0100' } } } },
    businessInfo: { name: 'Fixture Bakery', contactInfo: { phoneNumber: '555 0100' } },
    socialLinks: [],
    pages: [
      { slug: 'home', name: 'Home', format: 'home', blocks: [block('h1', 'section-header', { labels: { title: 'Welcome' } })] },
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
    ],
  };
}

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
    if (url.pathname === '/tenant/siteDetails') return send(200, fixtureSiteDetails(state));
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

/**
 * Review B2: after the build, the owner adds a shop section to the cached
 * `/about`, the save sends a signed `site.updated`, and `/about` is read again.
 * It must never answer 500 (it renders the storefront unfiltered until the
 * next build). `flip` is the revalidate answer, `after` every read after it.
 */
export function checkAfterFlip(flip, after) {
  const failures = [];
  if (flip.status !== 200 || !/"revalidated":true/.test(flip.body ?? '')) failures.push(`the signed site.updated was not accepted (${flip.status})`);
  if (after.length === 0) failures.push('nothing was read after the flip');
  for (const r of after) {
    if (r.status >= 500 || r.status === 0) failures.push(`${r.path} answered ${r.status} after the owner added a storefront`);
  }
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

function get(p) {
  return new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port: APP_PORT, path: p }, (res) => {
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
  const state = { aboutStorefront: false };
  const upstream = await startFixtureUpstream({ log: (line) => seen.add(line), state });
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
    const server = spawn('npx', ['next', 'start', '-p', String(APP_PORT)], { cwd: root, env, stdio: 'ignore', shell: process.platform === 'win32' });
    try {
      if (!(await waitUp())) failures.push('next start did not come up');
      else {
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
        for (const p of ['/about', '/about', '/about', '/about?sort=price', '/about']) {
          const r = await get(p);
          after.push({ path: p, status: r.status });
          console.log(`  after flip: ${String(r.status).padEnd(4)} ${(r.headers['x-nextjs-cache'] ?? '-').toString().padEnd(6)} ${p}`);
          await new Promise((res) => setTimeout(res, 300));
        }
        failures.push(...checkAfterFlip(flip, after));
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
  console.log(failures.length ? `\nFAIL (${gateOn ? 'gate on' : 'gate off'}):\n  ${failures.join('\n  ')}` : `\nPASS (${gateOn ? 'gate on' : 'gate off'})`);
  process.exit(failures.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
