/**
 * V7.319 (research-sentry-quota-2026-10-17.md, section 5 rank 4). Pins that
 * the three Sentry entry points reach the tested policies. `client.ts` and the
 * two instrumentation files import `server-only`, `next/*` or
 * `@sentry/nextjs`, none of which load under `node --test`, so the policies
 * live in plain modules (captureThrottle.ts, reportingGate.ts,
 * ignoredBrowserErrors.ts) with behavioural suites of their own, and this file
 * pins only that the entry points call them. Matched on names, not layout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const client = read('../api/client.ts');
const instrumentationClient = read('../../instrumentation-client.ts');
const instrumentationServer = read('../../instrumentation.ts');

test('[V7.319 REFUSE] a swallowed upstream failure is not captured once per call', () => {
  // In an incident one render reads ~14 paths, so one dead upstream cost ~14
  // events per page view, 13 of every 14 of them repeats.
  const captures = client.match(/Sentry\.captureException\(/g) ?? [];
  assert.equal(captures.length, 2, 'positive control: the two swallow points still capture');
  const gated = client.match(/if \(\w+\.capture\)\s*\{?\s*Sentry\.captureException\(/g) ?? [];
  assert.equal(gated.length, 2, 'both captures sit behind the per-process throttle');
  assert.match(client, /from '\.\/captureThrottle'/);
  // Review of PR 197, C5: keyed by the failure signature, so a second failing
  // path in the same window still reaches Sentry.
  assert.equal((client.match(/\.take\(stripQueryString\(path\)\)/g) ?? []).length, 2, 'both captures key the window by path');
});

test('[V7.319 REFUSE] no runtime sends without the environment gate', () => {
  for (const [name, src] of [
    ['instrumentation-client.ts', instrumentationClient],
    ['instrumentation.ts', instrumentationServer],
  ] as const) {
    const inits = src.match(/Sentry\.init\(/g) ?? [];
    assert.ok(inits.length >= 1, `positive control: ${name} initialises Sentry`);
    // Inside an init the label and the gate sit together; the helper calls
    // that compute them are not counted.
    assert.equal(
      (src.match(/environment: sentryEnvironment,\s*enabled: sentryEnabled,/g) ?? []).length,
      inits.length,
      `${name}: every init is labelled and gated`,
    );
  }
});

test('[V7.319 REFUSE] the browser drops View Transition aborts before they count against the quota', () => {
  assert.match(instrumentationClient, /ignoreErrors: IGNORED_BROWSER_ERRORS/);
});

test('[V7.319 ALLOW] the errors-only settings are unchanged', () => {
  assert.match(instrumentationClient, /tracesSampleRate: 0/);
  assert.match(instrumentationClient, /replaysSessionSampleRate: 0/);
  assert.match(instrumentationServer, /tracesSampleRate: 0/);
  assert.match(instrumentationClient, /dsn: process\.env\.NEXT_PUBLIC_SENTRY_DSN/);
});
