import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import {
  FROZEN_HEADERS,
  FROZEN_RETRY_AFTER_SECONDS,
  FROZEN_STATUS,
  renderFrozenPage,
} from './frozenGate.ts';

// The header set below IS the correctness of the frozen gate. The whole reason
// the gate lives in middleware rather than in the render is that a successful
// render on an SSG route is storable by construction, and a stored frozen page
// cannot be purged from an Amplify-managed CloudFront distribution. If these
// headers regress, unfreezing stops bringing sites back and there is no lever
// to pull. Every case here must FAIL against a gate that omits them.

test('the frozen page is never storable: no-store, not merely no-cache', () => {
  const cc = FROZEN_HEADERS['Cache-Control'];
  assert.match(cc, /\bno-store\b/, 'no-store is what forbids writing it to disk at all');
  assert.match(cc, /\bprivate\b/, 'private keeps it out of shared caches');
  assert.match(cc, /\bmax-age=0\b/);
  assert.match(cc, /\bmust-revalidate\b/);
});

test('the CDN-specific opt-outs are set too', () => {
  assert.equal(FROZEN_HEADERS['CDN-Cache-Control'], 'no-store');
  assert.equal(FROZEN_HEADERS['Vercel-CDN-Cache-Control'], 'no-store');
});

test('status is 503, so a transient billing problem does not cost the customer rankings', () => {
  // NOT 404 (invites deindexing) and NOT 402: VR_Client_API's
  // CustomErrorResponses pins ErrorCachingMinTTL 0 on 400/403/404/405/5xx but
  // has no 402 entry, so a 402 silently picks up CloudFront's default 10s
  // error cache.
  assert.equal(FROZEN_STATUS, 503);
});

test('Retry-After is present, numeric, and matches the edge staleness ceiling', () => {
  assert.equal(FROZEN_RETRY_AFTER_SECONDS, 3600);
  assert.equal(FROZEN_HEADERS['Retry-After'], '3600');
  assert.ok(
    Number.isInteger(Number(FROZEN_HEADERS['Retry-After'])),
    'Retry-After must be delta-seconds, not a date string',
  );
});

test('the frozen page opts out of indexing at the page level', () => {
  assert.equal(FROZEN_HEADERS['X-Robots-Tag'], 'noindex');
  assert.match(renderFrozenPage(), /<meta name="robots" content="noindex">/);
});

test('the header map is frozen, so a caller cannot mutate the shared policy', () => {
  assert.ok(Object.isFrozen(FROZEN_HEADERS));
});

test('the page is a complete, self-contained document', () => {
  const html = renderFrozenPage();
  // It is emitted before the app renders, so it has no access to the Tailwind
  // bundle or the layout. Depending on any of that would mean the page a site
  // shows when its data path is closed depends on the pipeline being gated.
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<\/html>$/);
  assert.equal(html.includes('class="'), false, 'no CSS classes: nothing external to load');
  assert.equal(html.includes('<link'), false, 'no external stylesheet');
  assert.equal(html.includes('<script'), false, 'no script: it must render with JS off');
});

test('the page tells a visitor what to do without exposing the owner billing state', () => {
  const html = renderFrozenPage();
  assert.match(html, /This site is temporarily unavailable/);
  assert.match(html, /check again in a little while/i);
  // A visitor is the CUSTOMER's customer. They do not need to know the owner's
  // account situation, and telling them is a bad thing to do to the customer.
  for (const leak of ['billing', 'unpaid', 'payment', 'quota', 'suspended', 'frozen', 'overdue']) {
    assert.equal(
      html.toLowerCase().includes(leak),
      false,
      `visitor-facing copy must not mention "${leak}"`,
    );
  }
});

test('the owner gets an actionable route back', () => {
  const html = renderFrozenPage();
  assert.match(html, /If this is your site/);
  assert.match(html, /https:\/\/www\.vivreal\.io\/app/);
});

test('copy obeys brand/voice.md: zero em dashes and zero en dashes', () => {
  // The one hard rule in brand/voice.md, and this page is customer-facing.
  const html = renderFrozenPage();
  assert.equal(html.includes('—'), false, 'em dash found');
  assert.equal(html.includes('–'), false, 'en dash found');
});

/**
 * The human-readable text only: tag contents, with markup, inline styles and
 * URLs stripped. Checking jargon against the raw HTML would false-positive on
 * things a visitor never reads (the portal href legitimately contains "http",
 * the inline font stack contains "system").
 */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

test('copy obeys brand/voice.md: no owner-invisible jargon in the visible text', () => {
  const text = visibleText(renderFrozenPage());
  assert.ok(text.length > 0, 'extractor produced nothing, the check would be vacuous');
  for (const jargon of [
    'render',
    'schema',
    'api',
    'cache',
    'pwa',
    'origin',
    '503',
    'http',
    'server',
    'cdn',
  ]) {
    assert.equal(text.includes(jargon), false, `owner-invisible term "${jargon}" in visible copy`);
  }
});
