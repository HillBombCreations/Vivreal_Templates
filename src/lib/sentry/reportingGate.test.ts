/**
 * V7.319: the environment gate and the browser noise filter. Each REFUSE has
 * an ALLOW beside it, so a gate that is always off, or always on, fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSentryReportingEnabled, resolveSentryEnvironment } from './reportingGate.ts';
import { IGNORED_BROWSER_ERRORS } from './ignoredBrowserErrors.ts';

const ignored = (message: string) => IGNORED_BROWSER_ERRORS.some((re) => re.test(message));

test('[V7.319 REFUSE] a local run with a DSN does not send', () => {
  for (const nodeEnv of ['development', 'test', undefined]) {
    const environment = resolveSentryEnvironment(undefined, nodeEnv);
    assert.equal(isSentryReportingEnabled({ environment }), false, `NODE_ENV=${nodeEnv}`);
  }
});

test('[V7.319 REFUSE] a preview app built as production but labelled otherwise does not send', () => {
  const environment = resolveSentryEnvironment('preview', 'production');
  assert.equal(environment, 'preview');
  assert.equal(isSentryReportingEnabled({ environment }), false);
});

test('[V7.319 ALLOW] a live site (NODE_ENV production, no explicit label) sends, labelled production', () => {
  const environment = resolveSentryEnvironment(undefined, 'production');
  assert.equal(environment, 'production');
  assert.equal(isSentryReportingEnabled({ environment }), true);
  assert.equal(resolveSentryEnvironment('   ', 'production'), 'production', 'a blank explicit label is no label');
});

test('[V7.319 ALLOW] the documented opt in lets a developer test Sentry locally, and only "true" counts', () => {
  const environment = resolveSentryEnvironment(undefined, 'development');
  assert.equal(isSentryReportingEnabled({ environment, devOptIn: 'true' }), true);
  assert.equal(isSentryReportingEnabled({ environment, devOptIn: '1' }), false);
});

test('[V7.319 REFUSE] View Transition aborts are dropped', () => {
  assert.ok(ignored('InvalidStateError: Transition was aborted because of invalid state'));
  assert.ok(ignored('TimeoutError: Transition was aborted because of timeout in DOM update'));
});

test('[V7.319 ALLOW] real errors, including other TimeoutError and InvalidStateError, are still reported', () => {
  assert.equal(ignored('TimeoutError: signal timed out'), false);
  assert.equal(ignored("InvalidStateError: Failed to execute 'put' on 'IDBObjectStore'"), false);
  assert.equal(ignored("TypeError: Cannot read properties of undefined (reading 'map')"), false);
});
