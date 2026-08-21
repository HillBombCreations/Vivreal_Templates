/**
 * TRAIN-1.54.0 gap 2a — the grouping/tagging contract for SSR upstream-failure
 * capture.
 *
 * These assertions are about ALERTABILITY, not cosmetics. Every one of them
 * pins a property that, if it regressed, would reproduce the 2026-08-20
 * outcome: telemetry that technically exists but is unusable. The two that
 * matter most are the fingerprint being tenant-agnostic (otherwise a fleet-wide
 * upstream outage mints one Issue per site and none of them looks alarming) and
 * the tenant identifier still being present as a TAG (otherwise the fleet-wide
 * signal is undebuggable once it fires).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FETCH_FAILURE_FINGERPRINT,
  SITE_DETAILS_FALLBACK_FINGERPRINT,
  buildFetchFailureCapture,
  buildSiteDetailsFallbackCapture,
  stripQueryString,
} from './errorCapture.ts';

test('stripQueryString drops the query string', () => {
  assert.equal(
    stripQueryString('/tenant/siteDetails?siteId=6a7775170b61da3d89d72852'),
    '/tenant/siteDetails',
  );
});

test('stripQueryString leaves a query-less path untouched', () => {
  assert.equal(stripQueryString('/tenant/siteDetails'), '/tenant/siteDetails');
});

test('stripQueryString keeps only the first segment when several ? appear', () => {
  assert.equal(stripQueryString('/tenant/x?a=1?b=2'), '/tenant/x');
});

test('fetch-failure fingerprints are identical across sites — a fleet-wide upstream outage must be ONE Issue with a spiking event count, not one Issue per tenant', () => {
  const siteA = buildFetchFailureCapture({
    source: 'clientFetchCached',
    path: '/tenant/siteDetails?siteId=aaaaaaaaaaaaaaaaaaaaaaaa',
    siteId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  });
  const siteB = buildFetchFailureCapture({
    source: 'clientFetchCached',
    path: '/tenant/siteDetails?siteId=bbbbbbbbbbbbbbbbbbbbbbbb',
    siteId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  });

  assert.deepEqual(siteA.fingerprint, siteB.fingerprint);
  assert.deepEqual(siteA.fingerprint, [
    FETCH_FAILURE_FINGERPRINT,
    '/tenant/siteDetails',
  ]);
});

test('the tenant is still filterable — siteId lands in tags, never in the fingerprint', () => {
  const capture = buildFetchFailureCapture({
    source: 'clientFetchSafe',
    path: '/tenant/collectionObjects?collectionId=abc&siteId=xyz',
    siteId: 'xyz',
  });

  assert.equal(capture.tags.siteId, 'xyz');
  assert.equal(capture.tags.source, 'clientFetchSafe');
  assert.equal(capture.tags.path, '/tenant/collectionObjects');
  assert.ok(!capture.fingerprint.includes('xyz'));
});

test('different API paths stay different Issues — a dead collections read and a dead siteDetails read are not the same incident', () => {
  const chrome = buildFetchFailureCapture({
    source: 'clientFetchCached',
    path: '/tenant/siteDetails?siteId=x',
    siteId: 'x',
  });
  const content = buildFetchFailureCapture({
    source: 'clientFetchCached',
    path: '/tenant/collectionObjects?siteId=x',
    siteId: 'x',
  });

  assert.notDeepEqual(chrome.fingerprint, content.fingerprint);
});

test('captures are level error — a level below error is not alertable', () => {
  assert.equal(
    buildFetchFailureCapture({ source: 'clientFetchSafe', path: '/tenant/x', siteId: 'x' }).level,
    'error',
  );
  assert.equal(buildSiteDetailsFallbackCapture({ siteId: 'x' }).level, 'error');
});

test('an absent SITE_ID degrades to an "unknown" tag rather than an empty one — an empty tag value is indistinguishable from an unset tag in Sentry search', () => {
  assert.equal(
    buildFetchFailureCapture({ source: 'clientFetchSafe', path: '/tenant/x', siteId: undefined })
      .tags.siteId,
    'unknown',
  );
  assert.equal(
    buildFetchFailureCapture({ source: 'clientFetchSafe', path: '/tenant/x', siteId: '' })
      .tags.siteId,
    'unknown',
  );
  assert.equal(buildSiteDetailsFallbackCapture({ siteId: undefined }).tags.siteId, 'unknown');
});

test('the fallback-render capture is a DISTINCT Issue from the fetch failure that caused it — "this site is serving an empty page" is the alertable business condition, one failed fetch is not', () => {
  const fallback = buildSiteDetailsFallbackCapture({ siteId: 'x' });
  const fetchFailure = buildFetchFailureCapture({
    source: 'clientFetchCached',
    path: '/tenant/siteDetails?siteId=x',
    siteId: 'x',
  });

  assert.deepEqual(fallback.fingerprint, [SITE_DETAILS_FALLBACK_FINGERPRINT]);
  assert.notDeepEqual(fallback.fingerprint, fetchFailure.fingerprint);
});

test('the fallback fingerprint carries no tenant component at all — every site rendering empty must roll into the same Issue', () => {
  assert.deepEqual(
    buildSiteDetailsFallbackCapture({ siteId: 'aaaa' }).fingerprint,
    buildSiteDetailsFallbackCapture({ siteId: 'bbbb' }).fingerprint,
  );
});
