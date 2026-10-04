// Test fixture for fetchWithReconnect.socket.test.ts — forked as a CHILD
// PROCESS so the parent (test) process can block its OWN event loop with
// `Atomics.wait` (modelling an Amplify freeze) while this server keeps
// running and independently RSTs its open sockets, exactly as research
// section 2d's "Model A" reproduction does. If this ran in the SAME process
// as the blocked test, the server could not act while blocked either, and
// the RSTs could never be queued unseen the way a real freeze queues them.
//
// IPC protocol (parent -> child), one JSON-shaped message at a time:
//   { cmd: 'start' }                -> replies { ok: true, port }
//   { cmd: 'connectionCount' }      -> replies { ok: true, count }
//   { cmd: 'resetSocketsAfter', ms } -> MODEL A ("pending error"): schedules
//                                       resetAndDestroy() on every
//                                       currently-open socket after `ms`,
//                                       replies { ok: true } immediately
//                                       (the parent does not wait for the
//                                       reset itself, only schedules it)
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
  cmd: 'start' | 'connectionCount' | 'resetSocketsAfter' | 'armStaleOnWrite' | 'exit';
  ms?: number;
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
  if (msg.cmd === 'resetSocketsAfter') {
    setTimeout(() => {
      for (const socket of sockets) {
        socket.resetAndDestroy();
      }
    }, msg.ms ?? 0);
    process.send?.({ ok: true });
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
