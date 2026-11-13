import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

/**
 * SW-10 (hotfix 2026-11-13, vivreal-hq hotfix plan T-2, F263 item 3): the
 * Sentry release is always the 40-hex commit SHA.
 *
 * Left to the SDK, the release is the first CI variable it finds, on Amplify
 * `AWS_COMMIT_ID`, and a `start-job` rebuild (Secure's and EventHandler's
 * site rebuilds, the release checks) sets that to the word `HEAD`. So
 * `AWS_COMMIT_ID` counts only when it is a SHA; otherwise
 * `git rev-parse HEAD`; a value that is not 40 hex is never the release.
 *
 * The wiring rows load the REAL `next.config.ts` with the REAL
 * `withSentryConfig` and read the release it wrote into the build
 * (`env._sentryRelease`, the value every runtime's `Sentry.init` reports:
 * `@sentry/nextjs` `config/withSentryConfig/buildTime.js` and
 * `server/index.js`), compared with this checkout's own `git rev-parse HEAD`.
 * Each row imports a fresh copy of the config (a distinct query string), since
 * the release is decided when the config module loads.
 *
 * Red at d4d67593 (this file only): `AWS_COMMIT_ID=HEAD` gave release `HEAD`,
 * and a non-hex value was the release as given.
 */

const SHA = 'd4d675932a59e51fafa9f1442aed2e8a12175c8d';
const HEAD_OF_THIS_CHECKOUT = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

/** Every variable the SDK's own fallback reads before `AWS_COMMIT_ID`, cleared so only the row's value decides. */
const CI_RELEASE_VARIABLES = ['SENTRY_RELEASE', 'GITHUB_SHA', 'CI_COMMIT_SHA', 'CODEBUILD_RESOLVED_SOURCE_VERSION'];

let fresh = 0;

/** The release `next.config.ts` writes into the build with `AWS_COMMIT_ID` set to `value`. */
async function releaseWith(value: string | undefined): Promise<unknown> {
  const saved = new Map([...CI_RELEASE_VARIABLES, 'AWS_COMMIT_ID'].map((k) => [k, process.env[k]]));
  for (const k of CI_RELEASE_VARIABLES) delete process.env[k];
  if (value === undefined) delete process.env.AWS_COMMIT_ID;
  else process.env.AWS_COMMIT_ID = value;
  try {
    fresh += 1;
    const config = (await import(`../../../next.config.ts?release-row=${fresh}`)).default as { env?: Record<string, unknown> };
    return config.env?._sentryRelease;
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('POSITIVE CONTROL: this checkout has a 40-hex HEAD to fall back to', () => {
  assert.match(HEAD_OF_THIS_CHECKOUT, /^[0-9a-f]{40}$/);
});

test('ALLOW: a 40-hex AWS_COMMIT_ID is the release', async () => {
  assert.equal(await releaseWith(SHA), SHA);
  assert.equal(await releaseWith(SHA.toUpperCase()), SHA);
});

test('REFUSE (red at d4d67593): AWS_COMMIT_ID=HEAD, a start-job rebuild, is never the release; the checkout\'s SHA is', async () => {
  const release = await releaseWith('HEAD');
  assert.notEqual(release, 'HEAD');
  assert.equal(release, HEAD_OF_THIS_CHECKOUT);
});

test('ALLOW: with no AWS_COMMIT_ID (a local build) the checkout\'s SHA is the release', async () => {
  assert.equal(await releaseWith(undefined), HEAD_OF_THIS_CHECKOUT);
});

test('REFUSE (red at d4d67593): a value that is not 40 hex is never the release', async () => {
  for (const value of ['abc1234', 'v0.2.0', `${SHA}0`, SHA.slice(1), `${SHA.slice(0, 39)}g`, ' ', 'HEAD ']) {
    assert.equal(await releaseWith(value), HEAD_OF_THIS_CHECKOUT, JSON.stringify(value));
  }
});

test('sentryReleaseName: Amplify\'s SHA wins and git is not asked; HEAD falls back to git, trimmed and lower-cased', async () => {
  const { sentryReleaseName } = await import('../../../next.config.ts');
  let gitAsked = 0;
  assert.equal(
    sentryReleaseName(SHA, () => {
      gitAsked += 1;
      return HEAD_OF_THIS_CHECKOUT;
    }),
    SHA,
  );
  assert.equal(gitAsked, 0);
  assert.equal(sentryReleaseName('HEAD', () => `${SHA.toUpperCase()}\n`), SHA);
  assert.equal(sentryReleaseName(undefined, () => SHA), SHA);
});

test('REFUSE: with neither a SHA from Amplify nor one from git, there is no release name at all', async () => {
  const { sentryReleaseName } = await import('../../../next.config.ts');
  assert.equal(sentryReleaseName('HEAD', () => undefined), undefined);
  assert.equal(sentryReleaseName('HEAD', () => 'fatal: not a git repository'), undefined);
  assert.equal(sentryReleaseName('not-a-sha', () => 'HEAD'), undefined);
});
