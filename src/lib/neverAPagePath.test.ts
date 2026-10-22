import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import { hasProbeExtension, isNeverAPagePath, NEVER_A_PAGE_HEADERS } from './neverAPagePath.ts';

// research-site-5xx-2026-10-17.md fix 1: scanner probes answered 500 during a
// VR_Client_API outage because only the page list could prove them absent.
// These pin which paths are provably not a page (REFUSE, 404 with no data)
// and, just as hard, that nothing real is caught (ALLOW).

// Extension probes: not a page, but possibly an authored redirect's `from`
// (Site_Migrator writes `/about.php`), so they are NOT data-free. Middleware
// checks the redirects before the 404 (middleware.test.ts).
const EXTENSION_PROBES = [
  '/ebkid.php',
  '/xmlrpc.php',
  '/wp-login.php',
  '/magento/index.php/admin',
  '/index.php/apps/files',
  '/admin/config.PHP',
  '/default.asp',
  '/login.aspx',
  '/index.jsp',
  '/test.cgi',
  '/about.php',
];

for (const probe of EXTENSION_PROBES) {
  test(`REFUSE: ${probe} has a probe extension and is not data-free`, () => {
    assert.equal(hasProbeExtension(probe), true);
    assert.equal(isNeverAPagePath(probe), false);
  });
}

const PROBES = [
  '/wp-admin',
  '/wp-admin/',
  '/wp-admin/css/install.css',
  '/WP-Admin/setup-config',
  '/wp-content/plugins/x/readme',
  '/wp-includes/wlwmanifest',
  '/wp-json/wp/v2/users',
  '/wp-config.php.bak',
  '/wp-config.old',
  '/cgi-bin/luci',
  '/phpmyadmin/index',
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.envrc',
  '/.git/config',
  '/.git/HEAD',
  '/.gitignore',
  '/.aws/credentials',
  '/.ssh/id_rsa',
  '/.svn/entries',
  '/.hg/store',
  '/.htaccess',
  '/.htpasswd',
  '/.DS_Store',
];

for (const probe of PROBES) {
  test(`REFUSE: ${probe} can never be a page`, () => {
    assert.equal(isNeverAPagePath(probe), true);
  });
}

// TEMPLATES-5 R1 (triage-sentry-clickup-2026-10-22.md): the 2026-10-22 scanner
// burst, nested git metadata, lockfiles and stray source maps. Each read site
// data before this rule, and each fallback render was a Sentry event.
const DEEP_PROBES = [
  '/html/.git/config',
  '/app/.git/HEAD',
  '/a/b/.git/',
  '/backend/.env',
  '/api/.env.local',
  '/public/.DS_Store',
  '/x/.htaccess',
  '/.vscode/settings.json',
  '/yarn.lock',
  '/Gemfile.lock',
  '/poetry.lock',
  '/frontend/package.lock',
  '/composer.json',
  '/composer.lock',
  '/vendor/composer.json',
  '/COMPOSER.JSON',
  '/main.js.map',
  '/assets/app.js.map',
  '/static/js/main.chunk.js.map',
  '/styles.css.map',
  '/_next/main.js.map',
  '/_NEXT/static/chunks/main.js.map',
  '/.well-known/.env',
];

for (const probe of DEEP_PROBES) {
  test(`REFUSE: ${probe} can never be a page (R1)`, () => {
    assert.equal(isNeverAPagePath(probe), true);
  });
}

// What the R1 rules must NOT catch: a dot in the middle of a segment, words
// that merely contain `map`, `lock`, `composer` or `git`, Next's own source
// maps, and every `.well-known` route.
const R1_REAL_PATHS = [
  '/sitemap.xml',
  '/sitemaps/0.xml',
  '/robots.txt',
  '/feeds/schedule.ics',
  '/.well-known/mcp.json',
  '/.well-known/llms.txt',
  '/.well-known/acme-challenge/abc123',
  '/_next/static/chunks/main-app.js.map',
  '/_next/static/css/app.css.map',
  '/roadmap',
  '/site-map',
  '/maps/downtown',
  '/locksmith-services',
  '/lock',
  '/padlock-guide',
  '/composer',
  '/composers/bach',
  '/github-tips',
  '/team/jane.doe',
  '/blog/version-1.2',
  '/shop/6721f0c2a1b2c3d4e5f60718',
  '/og/about',
];

for (const page of R1_REAL_PATHS) {
  test(`ALLOW: ${page} is not caught by the R1 probe rules`, () => {
    assert.equal(isNeverAPagePath(page), false);
  });
}

// Slugs a real owner can produce. `nameToSlug` (portal pageUtils.ts) turns
// "WP Engine review" into `wp-engine-review`, and the manual slug field and
// VR_Secure_API (`slug: Joi.string()`) accept anything, so prefixes that look
// like probes must still render.
const REAL_PAGE_PATHS = [
  '/',
  '/about',
  '/shop',
  '/menu',
  '/checkoutsuccess',
  '/wp-engine-review',
  '/wordpress',
  '/wp',
  '/wpadmin-tips',
  '/wp-configuration-guide',
  '/wp-config',
  '/cgi-bin-guide',
  '/phpmyadmin-help',
  '/php-classes',
  '/env-setup',
  '/environment',
  '/git-workshop',
  '/features/ai-sites',
  '/shop/6721f0c2a1b2c3d4e5f60718',
  '/blog/version-1.2',
  '/products/the-php-handbook',
  '/team/jane.doe',
  '/santa-monica/injectables-fillers/botox',
];

for (const page of REAL_PAGE_PATHS) {
  test(`ALLOW: real page path ${page} is not a probe`, () => {
    assert.equal(isNeverAPagePath(page), false);
    assert.equal(hasProbeExtension(page), false);
  });
}

// Every code route the app serves, derived from the route tree on disk so a
// route added later is covered without editing this list.
const APP_DIR = fileURLToPath(new URL('../app/', import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

/** `src/app/<segments>/<file>` -> the URL a visitor requests for it. */
function appRouteUrl(file: string): string | null {
  const rel = path.relative(APP_DIR, file).split(path.sep);
  const name = rel.pop() ?? '';
  const segments = rel.map((segment) =>
    segment.startsWith('[...') ? 'a/b/c' : segment.startsWith('[') ? 'sample-value' : segment,
  );
  const base = `/${segments.join('/')}`.replace(/\/$/, '') || '/';
  const join = (leaf: string) => (base === '/' ? `/${leaf}` : `${base}/${leaf}`);
  if (/^(page|route)\.tsx?$/.test(name)) return base;
  if (name === 'robots.tsx') return join('robots.txt');
  if (name === 'icon.tsx') return join('icon');
  if (name === 'apple-icon.tsx') return join('apple-icon');
  return null;
}

const CODE_ROUTE_URLS = walkFiles(APP_DIR)
  .filter((file) => !file.includes(`${path.sep}testSupport${path.sep}`) && !file.endsWith('.test.ts'))
  .map(appRouteUrl)
  .filter((url): url is string => url !== null);

const PUBLIC_URLS = walkFiles(PUBLIC_DIR).map(
  (file) => `/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`,
);

const FRAMEWORK_URLS = [
  '/_next/static/chunks/main-app.js',
  '/_next/static/css/app.css',
  '/_next/image',
  '/_next/data/build/page.json',
  '/sitemaps/2.xml',
  '/.well-known/llms.txt',
  '/.well-known/mcp.json',
  '/.well-known/security.txt',
  '/.well-known/apple-app-site-association',
  '/feeds/schedule.ics',
];

test('control: the route walk found the real code routes', () => {
  // A walk that parses nothing would make the ALLOW loop below vacuous.
  for (const known of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/favicon.ico', '/.well-known/llms.txt', '/api/contact', '/mcp', '/og/sample-value']) {
    assert.ok(CODE_ROUTE_URLS.includes(known), `route walk missed ${known}: ${CODE_ROUTE_URLS.join(', ')}`);
  }
  assert.ok(CODE_ROUTE_URLS.length >= 30, `only ${CODE_ROUTE_URLS.length} routes found`);
  assert.ok(PUBLIC_URLS.length >= 10, `only ${PUBLIC_URLS.length} public files found`);
});

test('ALLOW: no code route, public file or framework path is a probe', () => {
  const caught = [...CODE_ROUTE_URLS, ...PUBLIC_URLS, ...FRAMEWORK_URLS].filter(
    (url) => isNeverAPagePath(url) || hasProbeExtension(url),
  );
  assert.deepEqual(caught, []);
});

test('the probe 404 is uncacheable exactly like the healthy not-found page', () => {
  assert.equal(
    NEVER_A_PAGE_HEADERS['Cache-Control'],
    'private, no-cache, no-store, max-age=0, must-revalidate',
  );
});
