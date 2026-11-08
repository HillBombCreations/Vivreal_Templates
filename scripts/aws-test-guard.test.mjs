/**
 * REFUSE and ALLOW for ./aws-test-guard.mjs: a test process cannot reach real
 * AWS. `npm test` preloads the guard into every test process
 * (`node --import ./scripts/aws-test-guard.mjs --test ...`). This file never
 * imports it, so it fails wherever the guard is NOT loaded: a test script
 * that dropped the `--import`, or a bare `node --test` of this file.
 *
 * Every test asserts the fake key FIRST, so without the guard nothing below
 * that line runs with the machine's own credentials.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFile, execSync, spawnSync } from "node:child_process";

import { createAwsCliClient } from "./fleet-build.mjs";

/** Copied, not imported: importing the guard here would load it. */
const FAKE_KEY = "AKIATESTGUARDNOTREAL";
const REFUSED = /aws-test-guard: refused to start the AWS CLI from a test/;

/** A boolean, never `assert.equal`: on an unguarded machine that would print the real key id. */
function assertGuarded() {
  assert.ok(
    process.env.AWS_ACCESS_KEY_ID === FAKE_KEY,
    "this test process carries the fake AWS key (npm test preloads scripts/aws-test-guard.mjs)",
  );
}

test("REFUSE: a test process carries only fake AWS credentials, and a child process inherits them", () => {
  assertGuarded();
  for (const name of ["AWS_PROFILE", "AWS_DEFAULT_PROFILE", "AWS_SESSION_TOKEN", "AWS_ROLE_ARN", "AWS_WEB_IDENTITY_TOKEN_FILE"]) {
    assert.equal(process.env[name], undefined, `${name} is removed`);
  }
  assert.ok(process.env.AWS_SHARED_CREDENTIALS_FILE, "the credentials file is pointed somewhere");
  assert.equal(fs.existsSync(process.env.AWS_SHARED_CREDENTIALS_FILE), false, "and that file does not exist");
  assert.ok(process.env.AWS_CONFIG_FILE, "the config file is pointed somewhere");
  assert.equal(fs.existsSync(process.env.AWS_CONFIG_FILE), false, "and that file does not exist");
  assert.equal(process.env.AWS_EC2_METADATA_DISABLED, "true");

  // ALLOW: a process that is not the AWS CLI still starts, and it inherits the fake key.
  const child = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.env.AWS_ACCESS_KEY_ID))"], {
    encoding: "utf8",
  });
  assert.equal(child.status, 0);
  assert.equal(child.stdout, FAKE_KEY);
});

test("REFUSE: the real fleet-build AWS client cannot start the CLI from a test", async () => {
  assertGuarded();
  const client = createAwsCliClient({ region: "us-east-1" });
  await assert.rejects(client.listApps(), REFUSED);
  await assert.rejects(
    client.startJob({ appId: "dtestnotreal", branch: "stable", jobType: "RELEASE", commitId: "a".repeat(40), jobReason: "test", commitMessage: "test" }),
    REFUSED,
  );
});

test("REFUSE: every child_process door to the AWS CLI throws before a process starts; ALLOW: other programs run", async () => {
  assertGuarded();
  assert.throws(() => execFile("aws", ["--version"]), REFUSED);
  assert.throws(() => execFile("C:/Program Files/Amazon/AWSCLIV2/aws.exe", ["--version"]), REFUSED);
  assert.throws(() => spawnSync("AWS.CMD", ["--version"]), REFUSED);
  assert.throws(() => execSync("aws --version"), REFUSED);

  const out = await new Promise((resolve, reject) => {
    execFile(process.execPath, ["-e", "process.stdout.write('ran')"], (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
  assert.equal(out, "ran");
  assert.equal(execSync(`"${process.execPath}" -e "process.stdout.write('ran')"`, { encoding: "utf8" }), "ran");
});
