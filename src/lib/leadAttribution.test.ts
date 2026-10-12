/**
 * Unit tests for server-side lead attribution (C4; design test-plan item 5).
 *
 * The property that matters most is the NEGATIVE one: with no `vr_attr` cookie
 * on the request — which is the state of every customer site in the fleet,
 * where the cookie does not exist — the outbound payload must be IDENTICAL to
 * today's, by reference where possible. Attribution is an enrichment; it must
 * never be able to cost a lead.
 *
 * The routes themselves import `next/server`, which this runner cannot load, so
 * the merge logic lives in `leadAttribution.ts` and the routes are thin call
 * sites. What is tested here is the whole of C4's behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTRIBUTION_COOKIE_NAME,
  readCookieFromHeader,
  parseAttributionCookie,
  attributionLeadFields,
  mergeAttributionFields,
  mergeAttributionCustomFields,
} from './leadAttribution.ts';
import type { Attribution } from './attribution.ts';
import { VIVREAL_MARKETING_SITE_ID } from './vivrealApex.ts';

/** Vivreal's own marketing site: the only kind of site whose leads may carry attribution. */
const OWN_SITE = VIVREAL_MARKETING_SITE_ID;

/** A request from a visitor who ACCEPTED (the vr_consent mirror), carrying `attribution` as vr_attr. */
function cookieHeader(attribution: unknown, extra = ''): string {
  const encoded = encodeURIComponent(JSON.stringify(attribution));
  return `${extra}${extra ? '; ' : ''}vr_consent=accepted; ${ATTRIBUTION_COOKIE_NAME}=${encoded}`;
}

const PROOF: Attribution = {
  v: 2,
  first: {
    utm_source: 'gate3',
    utm_medium: 'cpc',
    utm_campaign: 'proof',
    source: 'gate3',
    landing_path: '/',
    first_seen_at: 1_700_000_000_000,
  },
  last: {
    utm_source: 'later',
    utm_campaign: 'second',
    source: 'later',
    landing_path: '/pricing',
  },
};

// ── cookie header parsing ──────────────────────────────────────────────────

test('reads a named cookie out of a raw Cookie header', () => {
  assert.equal(readCookieFromHeader('a=1; vr_attr=xyz; b=2', 'vr_attr'), 'xyz');
  assert.equal(readCookieFromHeader('vr_attr=xyz', 'vr_attr'), 'xyz');
  assert.equal(readCookieFromHeader('a=1;vr_attr=xyz', 'vr_attr'), 'xyz');
});

test('does not match a cookie whose name merely ends with the target', () => {
  assert.equal(readCookieFromHeader('not_vr_attr=xyz', 'vr_attr'), null);
  assert.equal(readCookieFromHeader('xvr_attr=xyz; y=1', 'vr_attr'), null);
});

test('absent / empty / malformed headers are null, never a throw', () => {
  assert.equal(readCookieFromHeader(null, 'vr_attr'), null);
  assert.equal(readCookieFromHeader(undefined, 'vr_attr'), null);
  assert.equal(readCookieFromHeader('', 'vr_attr'), null);
  assert.equal(readCookieFromHeader('garbage-with-no-equals', 'vr_attr'), null);
  assert.equal(readCookieFromHeader(';;;', 'vr_attr'), null);
});

// ── payload parsing ────────────────────────────────────────────────────────

test('parses a well-formed v2 payload', () => {
  const parsed = parseAttributionCookie(cookieHeader(PROOF));
  assert.equal(parsed!.v, 2);
  assert.equal(parsed!.first.utm_campaign, 'proof');
});

test('rejects a wrong-version, malformed or empty payload (fail-closed)', () => {
  assert.equal(parseAttributionCookie(cookieHeader({ v: 1, first: {} })), null);
  assert.equal(parseAttributionCookie(cookieHeader({ v: 2 })), null); // no `first`
  assert.equal(parseAttributionCookie(`${ATTRIBUTION_COOKIE_NAME}=not-json%7B`), null);
  assert.equal(parseAttributionCookie(`${ATTRIBUTION_COOKIE_NAME}=`), null);
  assert.equal(parseAttributionCookie(`${ATTRIBUTION_COOKIE_NAME}=%E0%A4%A`), null); // bad escape
  assert.equal(parseAttributionCookie('other=1'), null);
});

// ── flattening ─────────────────────────────────────────────────────────────

test('flattens the FIRST touch, not the last', () => {
  const fields = attributionLeadFields(PROOF);
  assert.equal(fields.utm_campaign, 'proof', 'first touch is what earned the visit');
  assert.equal(fields.source, 'gate3');
  assert.equal(fields.landing_path, '/');
  assert.equal(Object.keys(fields).includes('first_seen_at'), false, 'non-lead keys dropped');
});

test('drops absent, empty and non-string values', () => {
  const fields = attributionLeadFields({
    v: 2,
    first: {
      utm_source: 'x',
      utm_campaign: '   ',
      landing_path: 42 as unknown as string,
    },
    last: {},
  });
  assert.deepEqual(fields, { utm_source: 'x' });
});

test('caps each value at 200 chars, matching the route field ceiling', () => {
  const fields = attributionLeadFields({
    v: 2,
    first: { utm_campaign: 'c'.repeat(500) },
    last: {},
  });
  assert.equal(fields.utm_campaign.length, 200);
});

test('a null attribution flattens to nothing', () => {
  assert.deepEqual(attributionLeadFields(null), {});
});

// ── ★ the negative property: no cookie ⇒ today's exact payload ─────────────

test('★ no cookie ⇒ the subscribe payload is UNCHANGED, by reference', () => {
  const fields = { location: 'Denver' };
  assert.equal(mergeAttributionFields(fields, null, OWN_SITE), fields);
  assert.equal(mergeAttributionFields(fields, '', OWN_SITE), fields);
  assert.equal(mergeAttributionFields(fields, 'other=1', OWN_SITE), fields);
  assert.equal(mergeAttributionFields(undefined, null, OWN_SITE), undefined);
});

test('★ a malformed cookie falls through to today’s payload, never throws', () => {
  const fields = { location: 'Denver' };
  for (const header of [
    `${ATTRIBUTION_COOKIE_NAME}=not-json{`,
    `${ATTRIBUTION_COOKIE_NAME}=%`,
    `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent('[]')}`,
    `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent('null')}`,
  ]) {
    assert.equal(mergeAttributionFields(fields, header, OWN_SITE), fields, header);
  }
});

test('★ no cookie ⇒ the contact payload is UNCHANGED, by reference', () => {
  const custom = { budget: '10k' };
  assert.equal(mergeAttributionCustomFields(custom, null, OWN_SITE), custom);
  assert.equal(mergeAttributionCustomFields(undefined, null, OWN_SITE), undefined);
  assert.equal(
    mergeAttributionCustomFields(undefined, 'other=1', OWN_SITE),
    undefined,
    'no cookie must not conjure an empty object where there was none',
  );
});

// ── the positive path ──────────────────────────────────────────────────────

test('subscribe: attribution is folded into the field bag', () => {
  const merged = mergeAttributionFields({ location: 'Denver' }, cookieHeader(PROOF), OWN_SITE);
  assert.deepEqual(merged, {
    location: 'Denver',
    utm_source: 'gate3',
    utm_medium: 'cpc',
    utm_campaign: 'proof',
    source: 'gate3',
    landing_path: '/',
  });
});

test('subscribe: attribution lands even when there were no submitted fields', () => {
  const merged = mergeAttributionFields(undefined, cookieHeader(PROOF), OWN_SITE);
  assert.equal((merged as Record<string, string>).utm_campaign, 'proof');
});

test('contact: attribution is folded into customFields', () => {
  const merged = mergeAttributionCustomFields({ budget: '10k' }, cookieHeader(PROOF), OWN_SITE)!;
  assert.equal(merged.budget, '10k');
  assert.equal(merged.utm_campaign, 'proof');
});

test('contact: non-string customField values survive the merge untouched', () => {
  const merged = mergeAttributionCustomFields(
    { newsletter: true, interests: ['a', 'b'] },
    cookieHeader(PROOF), OWN_SITE
  )!;
  assert.equal(merged.newsletter, true);
  assert.deepEqual(merged.interests, ['a', 'b']);
  assert.equal(merged.utm_campaign, 'proof');
});

// ── ★ never clobber ────────────────────────────────────────────────────────

test('★ a submitted field WINS over an attribution key of the same name', () => {
  // A contact form can legitimately carry its own "How did you hear about us?"
  // keyed `source`. Overwriting the visitor's answer with a derived value would
  // be data loss in the one payload this feature exists to enrich.
  const merged = mergeAttributionFields(
    { source: 'A friend told me', utm_campaign: 'client-supplied' },
    cookieHeader(PROOF), OWN_SITE
  ) as Record<string, string>;

  assert.equal(merged.source, 'A friend told me');
  assert.equal(merged.utm_campaign, 'client-supplied');
  assert.equal(merged.utm_medium, 'cpc', 'non-colliding keys still land');
});

test('★ the same never-clobber rule holds for contact customFields', () => {
  const merged = mergeAttributionCustomFields(
    { source: 'Word of mouth' },
    cookieHeader(PROOF), OWN_SITE
  )!;
  assert.equal(merged.source, 'Word of mouth');
  assert.equal(merged.utm_source, 'gate3');
});

test('the merge does not mutate the caller’s object', () => {
  const fields = { location: 'Denver' };
  mergeAttributionFields(fields, cookieHeader(PROOF), OWN_SITE);
  assert.deepEqual(fields, { location: 'Denver' });
});

test('attribution is read even when other cookies share the header', () => {
  const header = cookieHeader(PROOF, '_ga=GA1.1.fake; cookie_consent_v1=accepted');
  const merged = mergeAttributionFields(undefined, header, OWN_SITE) as Record<string, string>;
  assert.equal(merged.utm_campaign, 'proof');
});

// ── ★ consent and site gate (review of f32b2f9) ───────────────────────────

test('★ REFUSE: a vr_attr with no accept (a pre-2026-10-12 cookie) attaches nothing', () => {
  const legacy = `${ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(PROOF))}`;
  const fields = { location: 'Denver' };
  assert.equal(mergeAttributionFields(fields, legacy, OWN_SITE), fields, 'no vr_consent');
  assert.equal(mergeAttributionFields(fields, `vr_consent=rejected; ${legacy}`, OWN_SITE), fields, 'rejected');
  assert.equal(mergeAttributionCustomFields(undefined, `cookie_consent_v1=accepted; ${legacy}`, OWN_SITE), undefined, 'an old v1 accept is not consent');
});

test('★ REFUSE: on a customer site an existing vr_attr is never attached to a lead, even with an accept', () => {
  const custom = { budget: '10k' };
  for (const siteId of ['6abbccc32f8f56089eebf884', '', undefined]) {
    assert.equal(mergeAttributionCustomFields(custom, cookieHeader(PROOF), siteId), custom, String(siteId));
    assert.equal(mergeAttributionFields(undefined, cookieHeader(PROOF), siteId), undefined, String(siteId));
  }
  // CONTROL: the same header on Vivreal's own site does attach it.
  assert.equal(mergeAttributionCustomFields(custom, cookieHeader(PROOF), OWN_SITE)!.utm_campaign, 'proof');
});
