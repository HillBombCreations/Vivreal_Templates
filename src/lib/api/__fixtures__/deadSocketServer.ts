// Test fixture for fetchWithReconnect.socket.test.ts — a real HTTP server run
// in a forked CHILD PROCESS so the test (the parent) exercises real sockets
// rather than a `fetch` stub. review-templates-183.md concern 1 removed this
// file's Model A ("pending error", `Atomics.wait` plus a scheduled socket
// reset) coverage: it could not be made to fail on the pre-fix code, and
// pinned a platform-dependent race outcome. The fork is kept anyway — it is
// the established, already-verified pattern for isolating this server from
// the test process, and changing it is out of scope for a should-fix.
//
// IPC protocol (parent -> child), one JSON-shaped message at a time:
//   { cmd: 'start' }                -> replies { ok: true, port }
//   { cmd: 'connectionCount' }      -> replies { ok: true, count }
//   { cmd: 'armStaleOnWrite' }      -> MODEL B ("dead until written"): every
//                                       currently-open socket is flagged; the
//                                       first byte it receives after this call
//                                       gets resetAndDestroy() instead of a
//                                       response. Sockets opened AFTER this
//                                       call are served normally. Replies
//                                       { ok: true } immediately.
//   { cmd: 'exit' }                 -> closes the server and exits

import http from 'node:http';
import type { Socket } from 'node:net';

interface ChildCommand {
  cmd: 'start' | 'connectionCount' | 'armStaleOnWrite' | 'exit';
}

const sockets = new Set<Socket>();
let connectionCount = 0;

const server = http.createServer((_req, res) => {
  // Small delay so concurrent warm-up requests overlap on distinct sockets
  // rather than serializing, matching the research harness.
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  }, 20);
});

// A long keep-alive so Node's own idle timeout never interferes with the
// test's own timing.
server.keepAliveTimeout = 120_000;

server.on('connection', (socket: Socket) => {
  connectionCount += 1;
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

process.on('message', (msg: ChildCommand) => {
  if (msg.cmd === 'start') {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      process.send?.({ ok: true, port });
    });
    return;
  }
  if (msg.cmd === 'connectionCount') {
    process.send?.({ ok: true, count: connectionCount });
    return;
  }
  if (msg.cmd === 'armStaleOnWrite') {
    for (const socket of sockets) {
      socket.once('data', () => socket.resetAndDestroy());
    }
    process.send?.({ ok: true });
    return;
  }
  if (msg.cmd === 'exit') {
    server.close(() => process.exit(0));
    // Force-exit if close() hangs on a lingering socket.
    setTimeout(() => process.exit(0), 200).unref();
  }
});
