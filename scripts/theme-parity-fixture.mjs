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

function main([dumpPath, outPath]) {
  if (!dumpPath || !outPath) throw new Error('usage: node scripts/theme-parity-fixture.mjs <dump.json> <out.json>');
  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  const sites = [];
  const skipped = [];
  for (const [id, entry] of Object.entries(dump).sort(([a], [b]) => a.localeCompare(b))) {
    if (!entry?.raw?.siteDetails?.values) skipped.push(id);
    else sites.push({ id, siteData: toFixtureSiteData(entry.raw) });
  }
  if (sites.length === 0) throw new Error(`${dumpPath}: no site in the dump carried siteDetails.values`);
  fs.writeFileSync(outPath, `${JSON.stringify({ sites, notFetched: skipped }, null, 2)}\n`);
  console.log(`wrote ${sites.length} sites to ${outPath}; no settings in the dump for: ${skipped.join(', ') || 'none'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
