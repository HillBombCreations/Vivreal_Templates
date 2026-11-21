/**
 * F160 (release C; the test guard rule SW-C19): no unit test reaches the
 * network. `npm test` preloads `aws-test-guard.mjs`, which loads
 * `network-test-guard.mjs`: any connection off this machine is refused at
 * `net.Socket.prototype.connect` (fetch, http, https, tls and net all go
 * through it) and recorded, and a file whose test swallowed a refusal still
 * fails at exit. A connection on this machine goes ahead.
 *
 * This file is also run at the base commit for the red proof, where no
 * network guard exists. So nothing here may leave the machine even then:
 * every REFUSE case first asserts the guard is installed, and the
 * off-machine target is an unrouted TEST-NET-3 IP literal (RFC 5737).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const UNROUTED = "203.0.113.10";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const guardInstalled = () => net.Socket.prototype.connect.name === "refuseOffMachineConnect";

/** The guard's own drain, read only once the guard is known to be loaded. */
async function takeViolations() {
  const guard = await import("./network-test-guard.mjs");
  return guard.takeNetworkViolations();
}

/** Connects and resolves the outcome: `connected`, or the error's code. */
const connectOutcome = (options) =>
  new Promise((resolve) => {
    const socket = net.connect(options);
    socket.once("connect", () => {
      socket.destroy();
      resolve("connected");
    });
    socket.once("error", (err) => resolve(err.code));
    socket.setTimeout(2000, () => socket.destroy(Object.assign(new Error("timed out"), { code: "TIMEOUT" })));
  });

test("REFUSE: a connection off this machine is refused with UNFAKED_NETWORK_CALL and recorded", async () => {
  assert.equal(guardInstalled(), true, "the off-machine guard on net.Socket#connect (npm test preloads it)");
  assert.equal(await connectOutcome({ host: UNROUTED, port: 443 }), "UNFAKED_NETWORK_CALL");
  assert.equal(await connectOutcome({ host: "client.vivreal.io", port: 443 }), "UNFAKED_NETWORK_CALL");
  // Drained here, or this file would fail at exit, as the guard intends.
  assert.deepEqual(await takeViolations(), [`${UNROUTED}:443`, "client.vivreal.io:443"]);
});

test("REFUSE: global fetch is refused at the socket", async () => {
  assert.equal(guardInstalled(), true, "the off-machine guard on net.Socket#connect (npm test preloads it)");
  let failure = null;
  await fetch(`https://${UNROUTED}/`).catch((err) => {
    failure = err;
  });
  assert.ok(failure instanceof Error, "fetch failed");
  assert.ok(JSON.stringify(await takeViolations()).includes(UNROUTED));
});

test("ALLOW: a connection on this machine goes ahead and records nothing", async () => {
  assert.equal(guardInstalled(), true, "the off-machine guard on net.Socket#connect (npm test preloads it)");
  const server = net.createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    assert.equal(await connectOutcome({ host: "127.0.0.1", port }), "connected");
    assert.equal(await connectOutcome({ host: "localhost", port }), "connected");
    assert.equal(await connectOutcome({ port }), "connected");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.deepEqual(await takeViolations(), []);
});

test("REFUSE: a file whose test swallows an off-machine request still fails (one-file run)", async () => {
  // Never spawned without the guard: the probe's request would then really be
  // attempted (to an unrouted address, but still off this machine).
  assert.equal(guardInstalled(), true, "the off-machine guard on net.Socket#connect (npm test preloads it)");
  // A runner refuses to start inside another's test file (NODE_TEST_CONTEXT),
  // so the child runs as a fresh, targeted run would.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = await new Promise((resolve) => {
    execFile(
      process.execPath,
      ["--import", "./scripts/aws-test-guard.mjs", "--test", "--test-reporter=tap", "scripts/network-test-guard.probe.mjs"],
      { cwd: ROOT, env, timeout: 60_000 },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, out: `${stdout}${stderr}` }),
    );
  });
  assert.notEqual(run.code, 0, `the probe run must fail:\n${run.out}`);
  assert.match(run.out, /network-test-guard: refused a connection off this machine from a test/);
  assert.match(run.out, /203\.0\.113\.10:443/);
});
