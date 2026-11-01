import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { PageConfig, SiteData } from '@/types/SiteData';
// Leaf files of the renderer, by path: its root entry imports `next/link`,
// which plain Node cannot resolve (same as `lib/booking/bookPage.test.ts`).
import { deriveNav } from '../../node_modules/@hillbombcreations/site-renderer/dist/chrome/deriveNav.js';
import { deriveFooterPages } from '../../node_modules/@hillbombcreations/site-renderer/dist/chrome/deriveFooterPages.js';
import type { PageConfig as RendererPageConfig } from '../../node_modules/@hillbombcreations/site-renderer/dist/index.js';
import * as composition from '../lib/api/composition/rendererSiteData.ts';

/**
 * Owner, next release 2026-11: a renamed home page shows the owner's name in
 * live menus, as it already does in the Studio. WD-5: a blank site still shows
 * one "Home".
 *
 * The Studio preview (portal `preview-shell/page.tsx`) hands `deriveNav` and
 * `deriveFooterPages` every page, home included. The live shells (Navbar,
 * Footer) hand them `menuPageConfigs(siteData)`. These tests run both inputs
 * through the installed renderer and compare what each menu shows.
 *
 * The site data is the shape `getSiteData` returns: home split out into
 * `homePageConfig`, every other page in `pageConfigs` (`siteData/index.tsx`,
 * which is `server-only` and cannot load here). On a tree without
 * `menuPageConfigs`, the shells fed the derives `pageConfigs` alone, so the
 * fallback below reproduces the live menu there, and the red is the menu
 * assertion rather than a missing export.
 */
type MenuSite = Pick<SiteData, 'homePageConfig' | 'pageConfigs'>;
const exported = (composition as { menuPageConfigs?: (site: MenuSite) => PageConfig[] }).menuPageConfigs;
const liveMenuPages = (site: MenuSite): PageConfig[] => (exported ? exported(site) : site.pageConfigs);

// Templates' PageConfig mirrors the renderer's; the shells make the same cast.
const asRenderer = (pages: PageConfig[]) => pages as unknown as RendererPageConfig[];
const shown = (items: { label?: string; name: string; path: string }[]) => items.map((i) => [i.label ?? i.name, i.path]);

/** What the live header and footer menus show for this site. */
function liveMenus(site: MenuSite) {
  const pages = asRenderer(liveMenuPages(site));
  return { nav: shown(deriveNav(pages)), footerPages: shown(deriveFooterPages(pages)) };
}

/** What the Studio shows: every stored page, home included, as the preview shell passes them. */
function studioMenus(site: MenuSite) {
  const pages = asRenderer([...(site.homePageConfig ? [site.homePageConfig] : []), ...site.pageConfigs]);
  return { nav: shown(deriveNav(pages)), footerPages: shown(deriveFooterPages(pages)) };
}

const page = (fields: Record<string, unknown>) => fields as unknown as PageConfig; // Only the fields the derives read.

// VR_Secure_API `createSiteWithExistingCollections.js`: the home page a blank site is seeded with.
const BLANK_SITE: MenuSite = {
  homePageConfig: page({ slug: 'home', path: '/', name: 'Home', format: 'home', displayOnHeader: true, displayOnFooter: true, enabled: true }),
  pageConfigs: [],
};

const RENAMED_HOME_SITE: MenuSite = {
  homePageConfig: page({ slug: 'home', name: 'Welcome', format: 'home', displayOnHeader: true, displayOnFooter: true }),
  pageConfigs: [page({ slug: 'about', name: 'About', format: 'static', displayOnHeader: true, displayOnFooter: true })],
};

test('REFUSE (WD-5): a blank site has exactly one Home, on the live site and in the Studio', () => {
  const expected = { nav: [['Home', '/']], footerPages: [] };
  assert.deepEqual({ live: liveMenus(BLANK_SITE), studio: studioMenus(BLANK_SITE) }, { live: expected, studio: expected });
});

test('ALLOW (owner, 2026-11): a renamed home page shows its name once, on the live site as in the Studio', () => {
  const expected = { nav: [['Welcome', '/'], ['About', '/about']], footerPages: [['About', '/about']] };
  assert.deepEqual({ live: liveMenus(RENAMED_HOME_SITE), studio: studioMenus(RENAMED_HOME_SITE) }, { live: expected, studio: expected });
});

test('REFUSE: a site with no home page config still leads with one Home', () => {
  const site: MenuSite = { homePageConfig: null, pageConfigs: [page({ slug: 'about', name: 'About' })] };
  assert.deepEqual(liveMenus(site).nav, [['Home', '/'], ['About', '/about']]);
});

test('REFUSE: no site data (the degraded fallback) gives an empty list, never a throw', () => {
  assert.ok(exported, 'menuPageConfigs is exported from rendererSiteData.ts');
  assert.deepEqual(exported(null as unknown as MenuSite), []); // The shells pass `siteData`, which can be null.
});

test('both shells feed the menus menuPageConfigs, and keep pageConfigs for the chrome props', () => {
  const read = (relative: string) => {
    const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert.ok(source.length > 500, `${relative} was not read (moved or renamed?)`);
    return source;
  };
  const navbar = read('./Navigation/Navbar.tsx');
  assert.match(navbar, /deriveNav\(menuPageConfigs\(siteData\)/);
  assert.match(navbar, /pageConfigs=\{pageConfigs\}/);
  const footer = read('./Footer/index.tsx');
  assert.match(footer, /const menuPages = menuPageConfigs\(siteData\)/);
  assert.match(footer, /deriveNav\(menuPages\)/);
  assert.match(footer, /deriveFooterPages\(menuPages\)/);
  assert.match(footer, /pageConfigs=\{pageConfigs\}/);
});
