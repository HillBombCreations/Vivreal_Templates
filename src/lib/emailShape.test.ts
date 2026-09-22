/**
 * The address rule on the public subscribe form.
 *
 * WHAT THIS PINS. A read-only production probe on 2026-09-22 found ten rows in
 * a live "Email Subscribers" collection whose stored address is not an
 * address: scanner traffic from 2026-08-02 that glued a SQL time-delay payload
 * onto a real-looking mailbox. They reached storage through this route, whose
 * rule was an UNANCHORED `/\S+@\S+\.\S+/` and therefore asked only whether an
 * address-shaped substring appeared anywhere in the value. All ten passed it.
 *
 * The strings below are the EXACT stored values, generated out of the probe
 * rather than retyped, because they carry quotes, backslashes and a run of
 * replacement characters that a shell heredoc or an editor parameter rewrites
 * silently. A test asserting a rewritten payload is not a test of what
 * production stored. Any code point above 126 is written as an escape so this
 * file stays ASCII.
 *
 * TWO LEGS, ONE RUN, ON PURPOSE. Refusing junk is half the job. A rule that
 * also refuses a real customer is the worse defect, so the legitimate leg runs
 * beside it. If the rule is ever tightened past what real mail allows, this
 * file goes red instead of quietly costing signups.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL_SHAPE, MAX_EMAIL_LENGTH, isValidEmail } from './emailShape.ts';

/** Verbatim from production. Generated, never hand-typed. */
const PRODUCTION_INJECTION_PAYLOADS = [
  "testing@example.com0'xor(if(now()=sysdate(),sleep(15),0))xor'z",
  "testing@example.com0\"xor(if(now()=sysdate(),sleep(15),0))xor\"z",
  "testing@example.com-1 waitfor delay '0:0:15' -- ",
  "testing@example.comFI45NehB'; waitfor delay '0:0:15' -- ",
  "testing@example.comftSd7KsK' OR 996=(SELECT 996 FROM PG_SLEEP(15))--",
  "testing@example.combztPoVk8') OR 171=(SELECT 171 FROM PG_SLEEP(15))--",
  "testing@example.coma9puxRsh')) OR 471=(SELECT 471 FROM PG_SLEEP(15))--",
  "testing@example.com'||dbms_pipe.receive_message(chr(98)||chr(98)||chr(98),15)||'",
  "testing@example.com'\"",
  "testing@example.com\uFFFD\uFFFD\uFFFD\uFFFD%2527%2522\\'\\\"",
];

/**
 * Real, awkward, and must keep working.
 *
 * The apostrophe row is the one worth naming: it is a surname, not an
 * injection, and a rule that treated a quote as hostile everywhere would
 * refuse every O'Brien on the internet. The quote is legal to the LEFT of the
 * at sign and illegal to the right, which is exactly where every payload above
 * put it.
 */
const LEGITIMATE_ADDRESSES = [
  'jo@bakery.test',
  'jo+newsletter@bakery.co.uk',
  "o'brien@example.com",
  'first.last@sub.domain.example.com',
  'hello@vivreal.io',
  'studio@shutterbug.photography',
  'contact@some-agency.international',
  'a_b-c@example.travel',
  'x@y.co',
  "weird!but#legal$%&*+/=?^`{|}~@example.com",
  'jose@example.com',
  'jos\u00E9@ex\u00E4mple.com',
  '\u7528\u6237@\u4F8B\u5B50.\u6D4B\u8BD5',
  'shop@example.xn--p1ai',
];

test('the production fixture parsed at all', () => {
  // Guards the vacuous pass: an empty table makes every loop below succeed
  // without asserting anything.
  assert.equal(PRODUCTION_INJECTION_PAYLOADS.length, 10);
  assert.equal(LEGITIMATE_ADDRESSES.length, 14);
});

test('every address production actually stored is refused', () => {
  for (const payload of PRODUCTION_INJECTION_PAYLOADS) {
    assert.equal(EMAIL_SHAPE.test(payload), false, JSON.stringify(payload));
    assert.equal(isValidEmail(payload), false, JSON.stringify(payload));
  }
});

test('a legitimate address is never refused', () => {
  for (const address of LEGITIMATE_ADDRESSES) {
    assert.equal(EMAIL_SHAPE.test(address), true, JSON.stringify(address));
    assert.equal(isValidEmail(address), true, JSON.stringify(address));
    // Surrounding whitespace from a paste is trimmed, not rejected.
    assert.equal(isValidEmail('  ' + address + '  '), true, JSON.stringify(address));
  }
});

test('a non-string is refused without throwing', () => {
  for (const junk of [null, undefined, 42, [], {}, true]) {
    assert.equal(isValidEmail(junk), false, JSON.stringify(junk ?? null));
  }
});

test('the boundary, stated out loud', () => {
  // Legal per RFC, none of them a customer.
  assert.equal(isValidEmail('"jo smith"@example.com'), false, 'quoted local part');
  assert.equal(isValidEmail('jo@[192.168.0.1]'), false, 'address literal');
  assert.equal(isValidEmail('jo@my_host.com'), false, 'underscore in a hostname label');

  // Malformed.
  assert.equal(isValidEmail('jo@localhost'), false, 'no dot in the domain');
  assert.equal(isValidEmail('a@b.c'), false, 'one character top level domain');
  assert.equal(isValidEmail('.jo@example.com'), false, 'leading dot');
  assert.equal(isValidEmail('jo.@example.com'), false, 'trailing dot');
  assert.equal(isValidEmail('jo..smith@example.com'), false, 'doubled dot');
  assert.equal(isValidEmail('jo@example..com'), false, 'doubled dot in the domain');
  assert.equal(isValidEmail('jo@-example.com'), false, 'leading hyphen on a label');
  assert.equal(isValidEmail('jo@example-.com'), false, 'trailing hyphen on a label');
  assert.equal(isValidEmail('jo@example@com.co'), false, 'two at signs');
  assert.equal(isValidEmail('jo smith@example.com'), false, 'an embedded space');

  // The unanchored rule this replaced returned TRUE for the next two. They are
  // the shape of the defect, not an edge case.
  assert.equal(isValidEmail('drop table users foo@bar.com'), false, 'an address inside other text');
  assert.equal(isValidEmail('foo@bar.com; DELETE FROM x'), false, 'an address with a tail');
});

test('length is capped before the regex ever runs', () => {
  const local = 'a'.repeat(64);
  assert.equal(isValidEmail(local + '@example.com'), true, '64 character local part');
  assert.equal(isValidEmail('a'.repeat(65) + '@example.com'), false, '65 character local part');

  const longDomain = 'a'.repeat(60) + '.' + 'b'.repeat(60) + '.' + 'c'.repeat(60) + '.example.com';
  const tooLong = 'jo@' + longDomain + '.' + 'd'.repeat(MAX_EMAIL_LENGTH);
  assert.ok(tooLong.length > MAX_EMAIL_LENGTH, 'the fixture is actually over the cap');
  assert.equal(isValidEmail(tooLong), false);
});
