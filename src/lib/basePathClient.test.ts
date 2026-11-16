/**
 * TP-8 to TP-11 (release B, F270): the client side of the help site's base
 * path. This process is the help app's build (`VIVREAL_SITE_BASE_PATH`
 * `/help`, set before any module reads it). The pure decisions run for real;
 * the three mounts the plain-Node runner cannot load (a client component and a
 * server-only module) are pinned from source, as `chromeProps.test.ts` does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.VIVREAL_SITE_BASE_PATH = '/help';

// Namespaces, read per test: at a base without these rows each test fails on
// its own assertion (the source pins run first) rather than the file failing
// to load.
const sitePathNs = (await import('./sitePath.ts').catch((err: unknown) => ({ loadError: String(err) }))) as Record<string, unknown>; // checked in each test
const paymentsNs = (await import('./payments.ts')) as unknown as Record<string, unknown>; // checked in each test

function beaconPagePath(routerPath: string | null, browserPath: string): string {
  assert.equal(typeof sitePathNs.beaconPagePath, 'function', `sitePath.ts exports beaconPagePath ${String(sitePathNs.loadError ?? '')}`);
  return (sitePathNs.beaconPagePath as (r: string | null, b: string) => string)(routerPath, browserPath);
}

function siteMountsCart(basePath: string, pages: Array<{ format?: string }>): boolean {
  assert.equal(typeof paymentsNs.siteMountsCart, 'function', 'payments.ts exports siteMountsCart');
  return (paymentsNs.siteMountsCart as (b: string, p: Array<{ format?: string }>) => boolean)(basePath, pages);
}

const source = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

/** A page that needs the cart today: a products page (prong 1 of `pagesNeedCart`). */
const SHOP_PAGES = [{ format: 'products' }];

test('[TP-9 ALLOW] a help view reports /help/<path>; with no router path, the browser path as it is', () => {
  assert.equal(sitePathNs.SITE_BASE_PATH, '/help');
  assert.equal(beaconPagePath('/a', '/help/a'), '/help/a');
  assert.equal(beaconPagePath('/', '/help'), '/help');
  assert.equal(beaconPagePath(null, '/help/a'), '/help/a');
});

test('[TP-9 REFUSE] under /help the beacon never reports an unbased path', () => {
  assert.match(source('../components/SiteBeacon/index.tsx'), /const path = beaconPagePath\(pathname, window\.location\.pathname\);/);
  for (const path of ['/a', '/your-website/site-dashboard', '/pricing']) {
    assert.ok(beaconPagePath(path, `/help${path}`).startsWith('/help/'), path);
  }
});

test('[TP-11 ALLOW] no base path: exactly today\'s gate', () => {
  assert.equal(siteMountsCart('', SHOP_PAGES), true);
  assert.equal(siteMountsCart('', [{ format: 'standard' }]), false);
});

test('[TP-11 REFUSE] under a base path the cart never mounts, even with product pages', () => {
  const providers = source('../components/Providers/index.tsx');
  assert.match(providers, /const hasProducts = siteMountsCart\(SITE_BASE_PATH, pages as CartGatePage\[\]\);/);
  assert.match(providers, /\{hasProducts \? \(\s*<CartProvider>/);
  assert.equal(siteMountsCart('/help', SHOP_PAGES), false);
});

test('[TP-10 ALLOW] the renderer gets the base: provider prop, composition option, contact bar prop', () => {
  assert.match(source('../components/Providers/index.tsx'), /basePath=\{SITE_BASE_PATH\}/);
  assert.match(
    source('./api/composition/buildPageContext.ts'),
    /options: \{ mode: 'live', emitSectionAnchors: false, \.\.\.\(SITE_BASE_PATH \? \{ basePath: SITE_BASE_PATH \} : \{\}\) \}/,
  );
  assert.match(source('../components/ContactButtonsChrome.tsx'), /basePath=\{SITE_BASE_PATH\}/);
});

test('[TP-8 REFUSE] the schedule tab switch never feeds the browser path (which has the base) to the router', () => {
  const code = source('../components/PageTemplates/CoordinatedScheduleComposed/index.tsx');
  assert.match(code, /const pathname = usePathname\(\);/);
  assert.match(code, /router\.replace\(pathname \+ url\.search, \{ scroll: false \}\);/);
  assert.doesNotMatch(code, /router\.replace\(url\.pathname/);
});
