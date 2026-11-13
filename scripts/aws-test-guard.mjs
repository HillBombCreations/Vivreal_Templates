// No test in this repo reaches real AWS (open-backlog release 2026-11; the
// fleet incident of 2026-11-05, where a unit test in another repo wrote to a
// customer's domain with the developer machine's own AWS credentials).
//
// Preloaded into every test process: `npm test` runs `node --import
// ./scripts/aws-test-guard.mjs --test ...`, and node hands `--import` to each
// test file's child process. `scripts/fleet-build.test.mjs`, the one test
// beside this repo's one AWS door, also imports it first, so a bare
// `node --test scripts/fleet-build.test.mjs` is guarded too.
//
// The door: `scripts/fleet-build.mjs` `createAwsCliClient`, which runs the
// AWS CLI (`execFile("aws", ...)`) with credentials from the environment.
// This repo has no AWS SDK dependency. Two layers:
//  1. Fake credentials. The machine's own profile, session and role
//     variables are removed, the credential and config files point at a path
//     that does not exist, the instance metadata lookup is off, and the key
//     pair is one AWS refuses. A child process inherits all of it, so even a
//     call that slips past layer 2 cannot act as anyone.
//  2. Refusal. Starting the AWS CLI through `node:child_process` throws
//     before any process starts. A test that needs the CLI hands
//     `runFleetBuild` a stub client, as `fleet-build.test.mjs` does.
//
// Only test processes load this. `fleet-build.mjs` itself never does.
import childProcess from 'node:child_process';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';

export const FAKE_AWS_ACCESS_KEY_ID = 'AKIATESTGUARDNOTREAL';
export const AWS_TEST_GUARD_REFUSAL = 'aws-test-guard: refused to start the AWS CLI from a test';

const NO_SUCH_FILE = path.join(import.meta.dirname, '.aws-test-guard-no-such-file');

for (const name of [
  'AWS_PROFILE',
  'AWS_DEFAULT_PROFILE',
  'AWS_SESSION_TOKEN',
  'AWS_SECURITY_TOKEN',
  'AWS_ROLE_ARN',
  'AWS_ROLE_SESSION_NAME',
  'AWS_WEB_IDENTITY_TOKEN_FILE',
  'AWS_CONTAINER_CREDENTIALS_FULL_URI',
  'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI',
  'AWS_CONTAINER_AUTHORIZATION_TOKEN',
]) {
  delete process.env[name];
}
process.env.AWS_ACCESS_KEY_ID = FAKE_AWS_ACCESS_KEY_ID;
process.env.AWS_SECRET_ACCESS_KEY = 'aws-test-guard-fake-secret-not-real';
process.env.AWS_SHARED_CREDENTIALS_FILE = NO_SUCH_FILE;
process.env.AWS_CONFIG_FILE = NO_SUCH_FILE;
process.env.AWS_EC2_METADATA_DISABLED = 'true';

/** `aws`, `aws.exe` or `aws.cmd`, by any path, in any letter case. */
const isAwsCli = (file) => /^aws(\.exe|\.cmd)?$/i.test(path.basename(String(file)));
/** The program a shell command line starts: the quoted path it opens with, or its first word. */
function programOf(commandLine) {
  const text = String(commandLine).trim();
  const quote = text[0];
  if (quote === '"' || quote === "'") {
    const end = text.indexOf(quote, 1);
    return end === -1 ? text.slice(1) : text.slice(1, end);
  }
  return text.split(/\s+/)[0] ?? '';
}
/** A shell command line whose program is the AWS CLI. */
const isAwsCommandLine = (command) => isAwsCli(programOf(command));

function refuse(api, what) {
  throw new Error(`${AWS_TEST_GUARD_REFUSAL} (${api} ${what})`);
}

for (const api of ['execFile', 'execFileSync', 'spawn', 'spawnSync']) {
  const original = childProcess[api];
  childProcess[api] = function awsTestGuard(file, ...rest) {
    // A whole command line as the file (`spawn("aws amplify ...", { shell: true })`)
    // is read like `exec`'s (review-t-pr227.md pass 3, N4).
    if (isAwsCli(file) || isAwsCommandLine(file)) refuse(api, programOf(file));
    return original.call(this, file, ...rest);
  };
}
for (const api of ['exec', 'execSync']) {
  const original = childProcess[api];
  childProcess[api] = function awsTestGuard(command, ...rest) {
    if (isAwsCommandLine(command)) refuse(api, programOf(command));
    return original.call(this, command, ...rest);
  };
}
// `import { execFile } from "node:child_process"` reads the ESM copy of the
// builtin, which only follows the assignments above after this call.
syncBuiltinESMExports();
