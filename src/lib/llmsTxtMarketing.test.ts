import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MARKETING_LLMS_LINES, withMarketingLlmsSection } from './llmsTxtMarketing.ts';
import { fetchLlmsTxt } from './llmsTxtProxy.ts';
import { VIVREAL_MARKETING_SITE_ID } from './domains/publicSearch.ts';
import { findRetiredTerms } from './__testing__/retiredTerms.ts';

/**
 * T2: vivreal.io's /llms.txt names its code routes and Bookings in the portal's
 * words; every other site's body passes through byte for byte.
 */

const UPSTREAM = ['# Vivreal', '', '> Vivreal.', '', '## Pages', '', '- [Pricing](https://vivreal.io/pricing)', ''].join('\n');
const CUSTOMER_SITE_ID = '6a0000000000000000000001';
const EM = String.fromCharCode(8212);
const EN = String.fromCharCode(8211);

const ORIGINAL_ENV = { ...process.env };
const originalFetch = globalThis.fetch;
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = originalFetch;
});

function stubUpstream(body: string, status: number) {
  globalThis.fetch = (async () =>
    new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })) as typeof fetch;
}

test('ALLOW: Bookings appears in vivreal.io /llms.txt, with /domains', () => {
  const body = withMarketingLlmsSection(UPSTREAM, VIVREAL_MARKETING_SITE_ID);
  assert.ok(body.startsWith(UPSTREAM), 'the upstream body is kept whole, first');
  assert.match(body, /^- Bookings: /m);
  assert.match(body, /\(https:\/\/vivreal\.io\/domains\)/);
});

test('REFUSE: a customer site never gains the section; its body is byte identical', () => {
  for (const siteId of [CUSTOMER_SITE_ID, '', undefined, null, ' ' + VIVREAL_MARKETING_SITE_ID + 'x']) {
    assert.equal(withMarketingLlmsSection(UPSTREAM, siteId), UPSTREAM, String(siteId));
  }
});

test('REFUSE: none of the retired terms or claims from the audit is in the section', () => {
  const text = MARKETING_LLMS_LINES.join('\n');
  assert.ok(text.length > 200, 'the check reads real content');
  assert.deepEqual(findRetiredTerms(text), []);
  assert.ok(!text.includes(EM) && !text.includes(EN), 'no em or en dash');
  // The voice guide's two standing false claims: publishing never sends email,
  // and an in-portal AI assistant does not exist.
  assert.doesNotMatch(text, /publish[^.]*email/i);
  assert.doesNotMatch(text, /assistant/i);
});

test('control: the retired check fires on the upstream text the audit flagged', () => {
  const flagged = '> Vivreal-managed site at https://next.vivreal.io.\n- [Integrations](https://next.vivreal.io/integrations)';
  assert.deepEqual(findRetiredTerms(flagged), ['integrations (use Channels)', 'next.vivreal.io (use vivreal.io)']);
});

test('ALLOW: the proxy appends the section on vivreal.io for a 200', async () => {
  process.env.API_KEY = 'k';
  process.env.SITE_ID = VIVREAL_MARKETING_SITE_ID;
  stubUpstream(UPSTREAM, 200);
  const result = await fetchLlmsTxt();
  assert.equal(result.status, 200);
  assert.match(result.body, /^- Bookings: /m);
});

test('REFUSE: the proxy passes a customer body, and any non-200, through untouched', async () => {
  process.env.API_KEY = 'k';
  process.env.SITE_ID = CUSTOMER_SITE_ID;
  stubUpstream(UPSTREAM, 200);
  assert.equal((await fetchLlmsTxt()).body, UPSTREAM);

  process.env.SITE_ID = VIVREAL_MARKETING_SITE_ID;
  stubUpstream('Site not found.', 404);
  const missing = await fetchLlmsTxt();
  assert.equal(missing.status, 404);
  assert.equal(missing.body, 'Site not found.');
});
