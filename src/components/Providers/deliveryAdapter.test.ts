import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { requestDeliveryQuote } from '../../lib/delivery/quoteClient.ts';

/**
 * The injection itself.
 *
 * `Providers/index.tsx` is JSX, which `node --experimental-strip-types` cannot
 * load, and this repo has no DOM test runner, so the wiring is asserted by
 * reading the file. That is weaker than mounting it, so the weakness is
 * contained deliberately: the opening tag is EXTRACTED FIRST and the extraction
 * is asserted before anything is asserted about its contents, because a
 * source-reading test whose extraction returns nothing passes vacuously and
 * would report this exact bug as fixed while it is still live.
 *
 * What this pins is one thing worth a test on its own: the prop is on the
 * PROVIDER ELEMENT. `DeliveryCheck` reads `onDeliveryQuote` off the renderer
 * context and disables itself when it is absent, so a `requestDeliveryQuote`
 * that exists and is imported but is not passed here leaves every live site
 * with a greyed-out ZIP box and a dead button, which is the state this fixes.
 */

const source = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');

/**
 * The opening tag of the renderer provider element, brace-aware so the arrow
 * function in `onSubscribe` does not end the scan at its own `=>`.
 */
function providerOpeningTag(): string {
  const start = source.indexOf('<NextProvider');
  if (start === -1) return '';
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0 && source[i - 1] !== '=') return source.slice(start, i + 1);
  }
  return '';
}

const tag = providerOpeningTag();

test('the provider element is found before anything is asserted about it', () => {
  // The guard. Everything below is vacuous without it.
  assert.notEqual(tag, '', 'no <NextProvider ...> opening tag was found in Providers/index.tsx');
  assert.ok(tag.length > 100, 'the extracted tag is too short to be the real one: ' + tag);
  // Proves the scanner reached the end of the real tag rather than an early
  // `>`, by finding a prop that is known to be near the end of it.
  assert.match(tag, /onSubscribe=/, 'the extracted tag stopped short of the props');
});

test('the delivery adapter is passed to the renderer provider', () => {
  assert.notEqual(tag, '');
  assert.match(
    tag,
    /onDeliveryQuote=\{requestDeliveryQuote\}/,
    'DeliveryCheck disables itself with no adapter on the context, so this prop is the feature',
  );
});

test('it is bound to the real client, not a local stub', () => {
  assert.match(
    source,
    /import \{ requestDeliveryQuote \} from '@\/lib\/delivery\/quoteClient';/,
  );
  // The same module this test imported, so the name in the JSX cannot be
  // satisfied by some other local declaration.
  assert.equal(typeof requestDeliveryQuote, 'function');
});

test('the adapter is passed unconditionally', () => {
  // A site missing its API key gets a 503, which the client turns into "could
  // not check right now". Gating the prop instead would hand the owner the
  // disabled control, which reads as broken rather than as not set up yet.
  assert.match(tag, /onDeliveryQuote=/, 'nothing is passed, so there is nothing to check');
  assert.doesNotMatch(tag, /onDeliveryQuote=\{[^}]*\?/, 'the adapter must not be conditional');
  assert.doesNotMatch(tag, /onDeliveryQuote=\{[^}]*&&/, 'the adapter must not be conditional');
});

test('nothing wraps the adapter in an optimistic fallback', () => {
  // The review praised the deliberate refusal to fake success on a delivery
  // answer. An inline wrapper here would be a second place for that contract
  // to live, and the place it would drift.
  assert.match(tag, /onDeliveryQuote=/, 'nothing is passed, so there is nothing to check');
  assert.doesNotMatch(tag, /onDeliveryQuote=\{async/, 'pass the client by reference');
});
