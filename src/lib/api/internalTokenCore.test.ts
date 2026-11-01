/**
 * Next release 2026-11, plan 3.F0, T4: the internal-meter token Templates
 * mints must be byte-identical to what VR_Client_API verifies.
 *
 * VECTOR is copied VERBATIM from VR_Client_API PR #133
 * (`test/verifyInternalCaller.test.js`, plan Revision 20 "the shared vector"),
 * as Vivreal_EventHandler PR #110 copies it. A fake master, test only. Checked
 * independently there with openssl:
 *
 *   printf '%s' 'vivreal-internal-meter/v1/507f1f77bcf86cd799439011' \
 *     | openssl dgst -sha256 -hmac 'vivreal-internal-meter-test-master-v1'
 *   printf '%s' '507f1f77bcf86cd799439011:1793534400000:render' \
 *     | openssl dgst -sha256 -hmac '<derivedKey>'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  INTERNAL_METER_HEADER,
  INTERNAL_TOKEN_TTL_MS,
  internalTokenForRequest,
  isRenderReadRequest,
  mintInternalToken,
  readInternalMeterConfig,
} from './internalTokenCore.ts';

const VECTOR = Object.freeze({
    master: 'vivreal-internal-meter-test-master-v1',
    groupID: '507f1f77bcf86cd799439011',
    derivedKey: 'cca796487b1197059ec5d67c7d45e6e9a75d93239d8bbe794361f4ff7f2a028f',
    expiresMs: 1793534400000,
    payload: '507f1f77bcf86cd799439011:1793534400000:render',
    token: 'v1.NTA3ZjFmNzdiY2Y4NmNkNzk5NDM5MDExOjE3OTM1MzQ0MDAwMDA6cmVuZGVy.1866840d663c31111c552bd67e050fb8b67089f2d17a5458a123983486e2b1c0',
});

const CONFIG = { key: VECTOR.derivedKey, groupID: VECTOR.groupID };
const NOW = VECTOR.expiresMs - INTERNAL_TOKEN_TTL_MS;

test('ALLOW: the shared vector mints the exact token VR_Client_API and EventHandler use', async () => {
  assert.equal(await mintInternalToken(CONFIG, VECTOR.expiresMs), VECTOR.token);
});

test('the vector is self-consistent (derivation and payload), so a copy error here cannot pass', async () => {
  // EventHandler derives the key Templates holds; Templates never sees the master.
  const derived = crypto.createHmac('sha256', VECTOR.master).update(`vivreal-internal-meter/v1/${VECTOR.groupID}`).digest('hex');
  assert.equal(derived, VECTOR.derivedKey);
  const [version, payloadB64, sig] = VECTOR.token.split('.');
  assert.equal(version, 'v1');
  assert.equal(Buffer.from(payloadB64, 'base64url').toString('utf8'), VECTOR.payload);
  // The RAW payload is signed, with the derived key as its UTF-8 hex string.
  assert.equal(crypto.createHmac('sha256', VECTOR.derivedKey).update(VECTOR.payload).digest('hex'), sig);
});

test('ALLOW: a render read gets a token that expires TTL ahead, within Client\'s 15 minute bound', async () => {
  const token = await internalTokenForRequest(CONFIG, '/tenant/siteDetails?siteId=abc', undefined, NOW);
  assert.equal(token, VECTOR.token, 'NOW + TTL is the vector expiry');
  assert.ok(INTERNAL_TOKEN_TTL_MS > 0 && INTERNAL_TOKEN_TTL_MS <= 15 * 60 * 1000);
  assert.equal(INTERNAL_METER_HEADER, 'x-vivreal-internal');
});

test('ALLOW: the three render reads, as Templates sends them, are render reads', () => {
  for (const path of [
    '/tenant/siteDetails?siteId=6abf2e0604c8fdb7032a2105',
    '/tenant/collectionObjects?collectionId=65f0c0ffee0000000000beef&limit=100&skip=0',
    '/tenant/integrationObjects?type=instagram',
    '/tenant/integrationObjects?type=instagram&search=',
    '/tenant/integrationObjects?type=instagram&search=%20',
  ]) {
    assert.equal(isRenderReadRequest(path), true, path);
    assert.equal(isRenderReadRequest(path, 'get'), true, `${path} (lower-case GET)`);
  }
});

test('REFUSE: anything that is not a GET of the three paths without a visitor search mints nothing', async () => {
  const cases: Array<[string, string | undefined]> = [
    ['/tenant/siteDetails?siteId=abc', 'POST'],
    ['/tenant/sendContactEmail', 'POST'],
    ['/tenant/sendContactEmail', undefined],
    ['/tenant/definedCollectionObject', 'POST'],
    ['/tenant/integrationObjects?type=instagram&search=boots', undefined],
    ['/tenant/integrationObjects?search=a&search=', undefined],
    ['/tenant/integrationObjects?search=&search=', undefined],
    ['/tenant/siteDetailsX?siteId=abc', undefined],
    ['/tenant/siteDetails/extra', undefined],
    ['/sites/abc/mcp', undefined],
    ['/sites/abc/feeds/schedule.ics', undefined],
    ['/tenant/checkout', 'POST'],
  ];
  for (const [path, method] of cases) {
    assert.equal(isRenderReadRequest(path, method), false, `${method ?? 'GET'} ${path}`);
    assert.equal(await internalTokenForRequest(CONFIG, path, method, NOW), null, `no token for ${method ?? 'GET'} ${path}`);
  }
});

test('REFUSE: no config (the state of every site before the env backfill) mints nothing', async () => {
  assert.equal(await internalTokenForRequest(null, '/tenant/siteDetails?siteId=abc', undefined, NOW), null);
});

test('ALLOW: the env config reads the two server-side names', () => {
  assert.deepEqual(
    readInternalMeterConfig({ INTERNAL_METER_KEY: VECTOR.derivedKey, INTERNAL_METER_GROUP_ID: VECTOR.groupID }),
    CONFIG,
  );
});

test('REFUSE: a missing or malformed key or group, or a NEXT_PUBLIC_ name, gives no config', () => {
  const bad: Array<Record<string, string | undefined>> = [
    {},
    { INTERNAL_METER_KEY: VECTOR.derivedKey },
    { INTERNAL_METER_GROUP_ID: VECTOR.groupID },
    { INTERNAL_METER_KEY: VECTOR.derivedKey.toUpperCase(), INTERNAL_METER_GROUP_ID: VECTOR.groupID },
    { INTERNAL_METER_KEY: VECTOR.derivedKey.slice(1), INTERNAL_METER_GROUP_ID: VECTOR.groupID },
    { INTERNAL_METER_KEY: VECTOR.master, INTERNAL_METER_GROUP_ID: VECTOR.groupID },
    { INTERNAL_METER_KEY: VECTOR.derivedKey, INTERNAL_METER_GROUP_ID: `${VECTOR.groupID}:render` },
    { INTERNAL_METER_KEY: VECTOR.derivedKey, INTERNAL_METER_GROUP_ID: '' },
    { NEXT_PUBLIC_INTERNAL_METER_KEY: VECTOR.derivedKey, NEXT_PUBLIC_INTERNAL_METER_GROUP_ID: VECTOR.groupID },
  ];
  for (const env of bad) assert.equal(readInternalMeterConfig(env), null, JSON.stringify(Object.keys(env)));
});

test('REFUSE: a token for another group never verifies under this group\'s key (the cross-group shape)', async () => {
  const other = await mintInternalToken({ key: VECTOR.derivedKey, groupID: '507f1f77bcf86cd799439022' }, VECTOR.expiresMs);
  assert.notEqual(other, VECTOR.token);
  assert.equal(Buffer.from(other.split('.')[1], 'base64url').toString('utf8').split(':')[0], '507f1f77bcf86cd799439022');
});
