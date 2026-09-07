import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The live site and the Studio preview must load the same renderer stylesheets
 * and thread the same chrome props. Three places where they did not.
 *
 * These are source reads because all three files are .tsx server components that
 * `node --experimental-strip-types` cannot load, and two of them call
 * `getSiteData()`, which is `server-only`. The same tradeoff, for the same
 * reason, as src/app/[slug]/page.test.ts. Each assertion matches on a NAME, not
 * on formatting, so a reformat cannot turn this red — and each one is preceded
 * by a guard that the file was read at all, because a source-reading test whose
 * path silently goes stale passes on nothing.
 *
 * The portal carries the other half of this gate
 * (tests/unit/components/SiteEditor/chromePropLockstep.test.ts) as a real diff
 * of both JSX prop lists. That one is the durable check; it needs both
 * checkouts, so this file states the Templates side on its own.
 */

function read(relative: string): string {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  assert.ok(source.length > 500, `${relative} was not read (moved or renamed?)`);
  return source;
}

test('the root layout loads all three renderer stylesheets, as the preview shell does', () => {
  const source = read('../app/layout.tsx');
  // content-grid and animations were always here. image-treatments was not, so
  // `.image-duotone-primary` and `.image-mask-vignette` were live in the Studio
  // preview and inert at the URL. Verified no-op for what sites paint today:
  // at renderer 1.65.0 no reachable component emits either class.
  for (const sheet of ['content-grid.css', 'animations.css', 'image-treatments.css']) {
    assert.match(
      source,
      new RegExp(`@hillbombcreations/site-renderer/styles/${sheet.replace('.', '\\.')}`),
      `the root layout must import ${sheet} — the Studio preview shell does`,
    );
  }
});

test('the Navbar shell threads the mobile logo height the Studio already offers', () => {
  const source = read('./Navigation/Navbar.tsx');
  assert.match(
    source,
    /logoHeightMobile=\{/,
    'passed in the preview shell since Lens-2 E and never here, so an author set a ' +
      'mobile logo height, saw it in the Studio, and the live header kept the derived one',
  );
  assert.match(
    source,
    /navigation\?\.brand\?\.logoHeightMobile/,
    'read from the same field the renderer documents and the Studio writes',
  );
});

test('the Footer shell threads the brand-column span the Studio already offers', () => {
  const source = read('./Footer/index.tsx');
  assert.match(
    source,
    /brandSpan=\{/,
    'same slipped-lockstep class as logoHeightMobile: a one-column brand block ' +
      'previewed narrow and shipped spanning two',
  );
  assert.match(source, /footer\?\.brandSpan/, 'read from siteData.footer.brandSpan');
});

test('the Footer shell still passes legalName, which the preview was missing', () => {
  // Not a change on this side, pinned because the portal half of this round adds
  // the matching preview prop and the pair only makes sense together: live
  // prints the business name in the legal strip so a logo-only brand override
  // (footer.brand.name: '') does not blank the copyright.
  const source = read('./Footer/index.tsx');
  assert.match(source, /legalName=\{businessName\}/);
});
