/**
 * marketing-measurement T3: own-site beacon hygiene.
 *
 * On Vivreal's own sites (vivreal.io, help.vivreal.io) the first-party beacon
 * is not sent for staff (`vr_internal`), for any other host (the
 * `next.vivreal.io` staging host above all), or for a visit referred from
 * `next.vivreal.io`. Customer sites are untouched: the ALLOW case with a staff
 * cookie on a customer site is the fleet regression proof.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendBeacon, OWN_SITE_HOSTS } from './beaconPolicy.ts';

const OWN = {
  siteId: 'own-site-id',
  vivrealOwnSite: true,
  hostname: 'vivreal.io',
  referrer: 'https://www.google.com/',
  cookie: '',
};

test('the own-site hosts are exactly vivreal.io and help.vivreal.io', () => {
  assert.deepEqual([...OWN_SITE_HOSTS], ['vivreal.io', 'help.vivreal.io']);
});

test('ALLOW: own site on vivreal.io, no staff cookie, external referrer', () => {
  assert.equal(shouldSendBeacon(OWN), true);
  assert.equal(shouldSendBeacon({ ...OWN, hostname: 'help.vivreal.io' }), true);
  assert.equal(shouldSendBeacon({ ...OWN, referrer: '' }), true, 'a direct visit counts');
  assert.equal(shouldSendBeacon({ ...OWN, referrer: 'https://vivreal.io/pricing' }), true);
});

test('ALLOW: a customer site with vr_internal=1 on x.vivreal.io still sends (fleet unchanged)', () => {
  assert.equal(
    shouldSendBeacon({
      siteId: 'customer-site-id',
      vivrealOwnSite: false,
      hostname: 'x.vivreal.io',
      referrer: 'https://next.vivreal.io/pricing',
      cookie: 'vr_internal=1',
    }),
    true,
  );
});

test('REFUSE: own site with the vr_internal staff cookie', () => {
  assert.equal(shouldSendBeacon({ ...OWN, cookie: 'vr_internal=1' }), false);
  assert.equal(shouldSendBeacon({ ...OWN, cookie: 'a=b; vr_internal=1' }), false);
  assert.equal(shouldSendBeacon({ ...OWN, cookie: 'a=b;vr_internal=1; c=d' }), false);
});

test('ALLOW: the staff cookie name is exact', () => {
  assert.equal(shouldSendBeacon({ ...OWN, cookie: 'vr_internal_x=1' }), true);
  assert.equal(shouldSendBeacon({ ...OWN, cookie: 'not_vr_internal=1' }), true);
});

test('REFUSE: own site served on next.vivreal.io, or any host that is not an own-site host', () => {
  for (const hostname of ['next.vivreal.io', 'main.d1gukor54gwnrj.amplifyapp.com', 'localhost', 'vivreal.io.evil.example']) {
    assert.equal(shouldSendBeacon({ ...OWN, hostname }), false, hostname);
  }
});

test('REFUSE: own site with a referrer on next.vivreal.io', () => {
  assert.equal(shouldSendBeacon({ ...OWN, referrer: 'https://next.vivreal.io/pricing' }), false);
  assert.equal(shouldSendBeacon({ ...OWN, referrer: 'https://NEXT.vivreal.io/' }), false);
});

test('REFUSE: no site id, or the preview id, on any site', () => {
  for (const vivrealOwnSite of [true, false]) {
    assert.equal(shouldSendBeacon({ ...OWN, vivrealOwnSite, siteId: '' }), false);
    assert.equal(shouldSendBeacon({ ...OWN, vivrealOwnSite, siteId: 'preview' }), false);
  }
});

test('a malformed referrer does not suppress or throw', () => {
  assert.equal(shouldSendBeacon({ ...OWN, referrer: 'not a url' }), true);
});
