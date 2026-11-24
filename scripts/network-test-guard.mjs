// No test in this repo reaches the network (F160, release C; the test guard
// rule SW-C19). The AWS half is `aws-test-guard.mjs`; this is the rest of the
// 2026-11-06 widening: a CMS test once reached Square's real sandbox.
//
// Loaded by `aws-test-guard.mjs`, which `npm test` preloads into every test
// process (`node --import ./scripts/aws-test-guard.mjs --test ...`).
//
// Every outbound connection goes through `net.Socket.prototype.connect`:
// global `fetch` (undici), `http`, `https`, `tls` and `net` alike. A
// connection to this machine (a test's own server on 127.0.0.1, ::1 or
// localhost, or a local socket path) goes ahead. Any other is refused before
// a packet leaves: the socket is destroyed with `UNFAKED_NETWORK_CALL`, and
// the target is recorded. A caller that swallows the error still fails its
// file: at exit a recorded refusal is printed and the exit code is set to 1,
// which `node --test` reports as a failed file.
//
// Only test processes load this. No script the build or the fleet runs does.
import net from 'node:net';

export const NETWORK_TEST_GUARD_REFUSAL = 'network-test-guard: refused a connection off this machine from a test';
export const UNFAKED_NETWORK_CALL = 'UNFAKED_NETWORK_CALL';

const violations = [];

/** A host on this machine: loopback by name or address. No DNS is asked. */
function isLocalHost(host) {
  const h = String(host).trim().toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || h === '0:0:0:0:0:0:0:1' || /^127\./.test(h) || /^::ffff:127\./.test(h);
}

/** `{ host, port }` or `{ path }` from any form `socket.connect` takes (net.connect passes its own normalized array). */
function targetOf(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (first !== null && typeof first === 'object') {
    if (typeof first.path === 'string') return { path: first.path };
    return { host: first.host ?? 'localhost', port: first.port };
  }
  if (typeof first === 'string' && !/^\d+$/.test(first)) return { path: first };
  return { host: typeof args[1] === 'string' ? args[1] : 'localhost', port: first };
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function refuseOffMachineConnect(...args) {
  const target = targetOf(args);
  if (target.path !== undefined || isLocalHost(target.host)) return originalConnect.apply(this, args);
  const where = `${target.host}:${target.port}`;
  violations.push(where);
  const error = Object.assign(new Error(`${NETWORK_TEST_GUARD_REFUSAL} (${where})`), { code: UNFAKED_NETWORK_CALL });
  process.nextTick(() => this.destroy(error));
  return this;
};

/** The refusals recorded so far, emptied: for the guard's own test, which makes them on purpose. */
export function takeNetworkViolations() {
  return violations.splice(0, violations.length);
}

process.on('exit', () => {
  if (violations.length === 0) return;
  console.error(`${NETWORK_TEST_GUARD_REFUSAL}: ${violations.join(', ')}. Stub the call; a unit test never leaves this machine.`);
  process.exitCode = 1;
});
