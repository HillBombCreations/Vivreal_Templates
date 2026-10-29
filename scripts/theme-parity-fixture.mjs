#!/usr/bin/env node
/**
 * Builds the fleet fixture `src/lib/theme/themeParity.test.ts` runs (owner
 * find 3, gate G-T step 6: old theme writers against the renderer builder,
 * over every site's stored settings).
 *
 *   node scripts/theme-parity-fixture.mjs <dump.json> <out.json>
 *
 * `<dump.json>` is `{ "<siteId>": { "raw": <VR_Client_API siteDetails response> } }`,
 * the shape the gate G-R fetch wrote. Point the test at a fresh build with
 * `THEME_PARITY_FIXTURE=<out.json> npm test`, or regenerate the committed one.
 *
 * What it keeps. The parity run needs, per site, every STRING key of the
 * `siteData` object `getSiteData()` builds (the old `Providers` loop stamped
 * each one as `--<key>`), and the VALUES only of the keys a theme writer reads.
 * So: the renderer's whitelist keys verbatim, `typography` cut to its three
 * family strings, `chrome` verbatim, and every other string key with its value
 * replaced by REDACTED. Nothing else leaves the dump: no URLs, no favicon, no
 * keys, no customer copy. A redacted key is still checked, because a key with a
 * reader that the builder drops fails the run whatever its value.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { THEME_TOKEN_KEYS } from '@hillbombcreations/site-renderer/theme';

export const REDACTED = '<redacted>';

/* The top-level fields getSiteData() lays over `siteDetails.values`
 * (src/lib/api/siteData/index.tsx). The chrome block mirrors SITE_CHROME_FIELDS
 * (src/lib/api/siteData/chrome.ts): those come from the top level ONLY, so a
 * mirror copy in `values` is replaced even when the top level is absent. */
const SITE_CHROME_FIELDS = [
  'emailPopup', 'announcement', 'utilityStrip', 'fulfillmentStrip', 'utilityDock',
  'edgeDock', 'footerNewsletter', 'floatingCta', 'favicon', 'motionPreset',
];
const TOP_LEVEL_FIELDS = ['domainName', 'name', 'tier', 'paymentsProvider', 'updatedAt', 'subscribersCollectionId', 'indexNowKey'];
const TYPOGRAPHY_FIELDS = ['displayFamily', 'bodyFamily', 'monoFamily'];

/** The theme-relevant, redacted `siteData` for one Client API response. */
export function toFixtureSiteData(raw) {
  const values = raw?.siteDetails?.values;
  if (!values || typeof values !== 'object') throw new Error('not a siteDetails response: no siteDetails.values');
  const siteData = { ...values };
  for (const field of TOP_LEVEL_FIELDS) if (raw[field] !== undefined) siteData[field] = raw[field];
  for (const field of SITE_CHROME_FIELDS) siteData[field] = raw[field] ?? undefined;

  const keep = new Set([...THEME_TOKEN_KEYS, 'chrome']);
  const out = {};
  for (const [key, value] of Object.entries(siteData)) {
    if (keep.has(key)) out[key] = value;
    else if (key === 'typography' && value && typeof value === 'object') {
      const typography = {};
      for (const field of TYPOGRAPHY_FIELDS) if (typeof value[field] === 'string') typography[field] = value[field];
      out.typography = typography;
    } else if (typeof value === 'string') out[key] = REDACTED;
  }
  return out;
}

/**
 * A site whose Client API fetch failed, from a READ-ONLY database read of its
 * `sites` document. Accepts the document (`{ siteDetails: { values } }`, as a
 * `findOne` with that projection returns it) or the bare `values` object.
 * Only `siteDetails.values` is used: the top-level fields the Client API adds
 * are not on the stored document, and they only ever affect which keys are
 * listed as dropped, never a value a theme writer reads.
 */
export function rawFromDbValues(doc) {
  const values = doc?.siteDetails?.values ?? doc;
  if (!values || typeof values !== 'object' || Array.isArray(values) || typeof values.primary !== 'string') {
    throw new Error('not a sites document or siteDetails.values object: no string primary');
  }
  return { siteDetails: { values } };
}

/**
 * The fixture from a Client API dump plus any DB-read sites. A DB read is a
 * stand-in for a FAILED fetch only: it is refused for a site the dump already
 * carries settings for, so the two sources can never be mixed for one site.
 * Each DB site is marked `source: 'db'`, and leaves `notFetched`.
 */
export function buildFixture(dump, dbSites = {}) {
  const sites = [];
  const notFetched = [];
  for (const [id, entry] of Object.entries(dump)) {
    if (entry?.raw?.siteDetails?.values) sites.push({ id, siteData: toFixtureSiteData(entry.raw) });
    else if (!(id in dbSites)) notFetched.push(id);
  }
  for (const [id, doc] of Object.entries(dbSites)) {
    if (sites.some((site) => site.id === id)) throw new Error(`${id}: the Client API dump already has its settings; a DB read only replaces a failed fetch`);
    sites.push({ id, source: 'db', siteData: toFixtureSiteData(rawFromDbValues(doc)) });
  }
  if (sites.length === 0) throw new Error('no site carried siteDetails.values');
  sites.sort((x, y) => x.id.localeCompare(y.id));
  return { sites, notFetched: notFetched.sort() };
}

function main(args) {
  const positional = [];
  const dbSites = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--db') {
      const spec = args[i + 1] ?? '';
      const at = spec.indexOf('=');
      if (at <= 0) throw new Error('--db takes <siteId>=<file.json>');
      dbSites[spec.slice(0, at)] = JSON.parse(fs.readFileSync(spec.slice(at + 1), 'utf8'));
      i += 1;
    } else positional.push(args[i]);
  }
  const [dumpPath, outPath] = positional;
  if (!dumpPath || !outPath) throw new Error('usage: node scripts/theme-parity-fixture.mjs <dump.json> <out.json> [--db <siteId>=<sitesDoc.json>]...');
  const fixture = buildFixture(JSON.parse(fs.readFileSync(dumpPath, 'utf8')), dbSites);
  fs.writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
  const fromDb = fixture.sites.filter((site) => site.source === 'db').map((site) => site.id);
  console.log(`wrote ${fixture.sites.length} sites to ${outPath} (from a DB read: ${fromDb.join(', ') || 'none'}); no settings for: ${fixture.notFetched.join(', ') || 'none'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
