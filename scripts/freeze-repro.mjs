#!/usr/bin/env node
/**
 * freeze-repro: reproduce, on a real server, the failure the render floor
 * exists for, and show whether it is fixed (vivreal-hq
 * docs/bugs/site-first-read-fallback/plan.md, T13). Run before release; not
 * part of `npm test` (it builds the app and takes about seven minutes).
 *
 *   node scripts/freeze-repro.mjs [--dir <repo root>] [--stale-wait-ms 305000]
 *                                 [--freeze-ms 60000] [--skip-build]
 *
 * WHAT IT DOES, in production's order:
 *  1. Starts a stub VR_Client_API serving a fixture site: home `/` and `/menu`
 *     bind collection "Menu" (item "Lemon Tart"); `/features/ai-sites` is a
 *     nested two-level page binding "Specials" (item "Plum Galette"), read at
 *     build only by the floor's fill pass.
 *  2. `npm run build` with `SITE_RENDER_MODE=isr` and
 *     `NEXT_PRIVATE_STANDALONE=true` (what Amplify sets), against the stub.
 *  3. Adds `/new-page` to the stub's site AFTER the build.
 *  4. Waits until the build's prerendered pages are past `revalidate` (300 s),
 *     then starts a COLD standalone `server.js` (empty data cache, as a fresh
 *     Amplify instance has).
 *  5. Requests `/` with the stub holding every request open, so the stale
 *     page is answered and a background regeneration starts and blocks on its
 *     reads. Then FREEZES the server process for 60 s (SIGSTOP on Linux and
 *     macOS; NtSuspendProcess on Windows, which has no SIGSTOP), while the
 *     stub drops every socket and stops listening. Then thaws it.
 *  6. With the stub refusing everything, requests `/`, `/menu`,
 *     `/features/ai-sites` and `/new-page`, and reads the server log.
 *
 * PASS (the fixed build): the regeneration's reads fail with elapsedMs of
 * 60 s or more; `/` and `/menu` answer 200 with "Lemon Tart";
 * `/features/ai-sites` answers 200 with "Plum Galette"; `/new-page` answers
 * 5xx (the floor never makes a negative claim); `site.snapshot.floor` lines
 * name those paths; zero `site.snapshot.miss`; `site.snapshot.present` names
 * the standalone snapshot. On the build before the floor (52fbad4), the
 * nested page answers 5xx and the script exits 1: that is the red.
 *
 * No dependency beyond Node. Prints one JSON summary and exits 0 on PASS.
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const ROOT = path.resolve(opt('dir', process.cwd()));
const STALE_WAIT_MS = Number(opt('stale-wait-ms', 305_000));
const FREEZE_MS = Number(opt('freeze-ms', 60_000));
const SKIP_BUILD = args.includes('--skip-build');
const SITE_ID = 'freezerepro00000000000001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[freeze-repro] ${msg}`);

/* --------------------------------------------------------------- the stub */

const block = (id, collectionId) => ({
  id,
  type: { kind: 'layout', dispatchId: 'cards' },
  order: 1,
  enabled: true,
  config: { bindings: [{ displayAs: 'cards', enabled: true, collectionId, sectionConfig: { showHeader: false } }] },
});
const headerBlock = (title) => ({
  id: `h-${title}`,
  type: { kind: 'static', dispatchId: 'section-header' },
  order: 0,
  enabled: true,
  config: { labels: { title, align: 'left' } },
});
const pageOf = (slug, name, collectionId, extra = {}) => ({
  slug,
  path: `/${slug}`,
  name,
  format: 'static',
  enabled: true,
  collections: [],
  integrations: [],
  blocks: [headerBlock(name), block(`b-${slug}`, collectionId)],
  ...extra,
});

let withNewPage = false;
function siteDetails() {
  const pages = [
    { ...pageOf('home', 'Home', 'menu-col'), format: 'home' },
    pageOf('menu', 'Menu', 'menu-col'),
    pageOf('features/ai-sites', 'AI sites', 'specials-col'),
  ];
  if (withNewPage) pages.push(pageOf('new-page', 'New page', 'menu-col'));
  return {
    name: 'Freeze Repro Cafe',
    domainName: '',
    siteDetails: { schema: {}, values: { name: 'Freeze Repro Cafe', lifecycleState: 'demo' } },
    pages,
    richTextImageUrls: {},
  };
}
const items = (title) => ({
  items: [{ _id: `${title.replace(/\W/g, '').toLowerCase()}1`, publishDate: '2026-01-01T00:00:00.000Z', objectValue: { title, description: `${title}, made today.` } }],
  totalCount: 1,
  richTextImageUrls: {},
});

function startStub() {
  let mode = 'serve';
  const held = new Set();
  const sockets = new Set();
  const counts = { total: 0, held: 0 };
  const server = http.createServer((req, res) => {
    counts.total += 1;
    if (mode === 'hold') {
      counts.held += 1;
      held.add(res);
      return;
    }
    const url = new URL(req.url, 'http://stub');
    let data = { items: [], totalCount: 0, richTextImageUrls: {} };
    if (url.pathname === '/tenant/siteDetails') data = siteDetails();
    else if (url.searchParams.get('collectionId') === 'menu-col') data = items('Lemon Tart');
    else if (url.searchParams.get('collectionId') === 'specials-col') data = items('Plum Galette');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: true, data, error: null }));
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        counts,
        hold() {
          mode = 'hold';
        },
        /** Drop every socket and stop listening: every later connect is refused. */
        refuse() {
          mode = 'refuse';
          server.close();
          for (const s of sockets) s.destroy();
          held.clear();
        },
        close() {
          server.close();
          for (const s of sockets) s.destroy();
        },
      });
    });
  });
}

/* ------------------------------------------------------------- the freeze */

function freeze(pid, thaw) {
  if (process.platform !== 'win32') {
    process.kill(pid, thaw ? 'SIGCONT' : 'SIGSTOP');
    return;
  }
  // Windows has no SIGSTOP. NtSuspendProcess suspends every thread of the
  // process, which is the same thing to the code inside it: timers, sockets
  // and the event loop stop until NtResumeProcess.
  const fn = thaw ? 'NtResumeProcess' : 'NtSuspendProcess';
  const ps =
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class Ntp { " +
    '[DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr h); ' +
    "[DllImport(\"ntdll.dll\")] public static extern int NtResumeProcess(IntPtr h); }'; " +
    `$p = [System.Diagnostics.Process]::GetProcessById(${pid}); $r = [Ntp]::${fn}($p.Handle); if ($r -ne 0) { exit 1 }`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
}

/* ------------------------------------------------------------------- main */

async function get(port, p) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, { redirect: 'manual', signal: AbortSignal.timeout(60_000) });
    const body = await res.text();
    return { status: res.status, cache: res.headers.get('x-nextjs-cache'), body };
  } catch (err) {
    return { status: 0, cache: null, body: String(err?.cause?.code ?? err) };
  }
}

async function main() {
  const stub = await startStub();
  const clientApi = `http://127.0.0.1:${stub.port}`;
  const env = {
    ...process.env,
    SITE_ID,
    API_KEY: 'freeze-repro-stub-key',
    NEXT_PUBLIC_CLIENT_API: clientApi,
    SITE_RENDER_MODE: 'isr',
    NEXT_PRIVATE_STANDALONE: 'true',
  };
  delete env.VIVREAL_SNAPSHOT_RECORD_DIR;
  log(`stub upstream on ${clientApi}; repo ${ROOT}; commit ${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()}`);

  if (!SKIP_BUILD) {
    log('building (npm run build, ISR, standalone) ...');
    const code = await new Promise((resolve) => {
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: ROOT, env, stdio: 'inherit', shell: process.platform === 'win32' });
      child.on('exit', (c) => resolve(c ?? 1));
    });
    if (code !== 0) throw new Error(`build exited ${code}`);
  }
  const builtAt = Date.now();
  withNewPage = true;
  log('added /new-page to the stub site (after the build)');

  const standalone = path.join(ROOT, '.next', 'standalone');
  fs.rmSync(path.join(standalone, '.next', 'cache'), { recursive: true, force: true });
  const wait = STALE_WAIT_MS - (Date.now() - builtAt);
  if (wait > 0) {
    log(`waiting ${Math.round(wait / 1000)} s so the prerendered pages are past revalidate (300 s) ...`);
    await sleep(wait);
  }

  const port = 3900 + Math.floor(Math.random() * 90);
  const logFile = path.join(ROOT, '.next', 'freeze-repro-server.log');
  const out = fs.openSync(logFile, 'w');
  const server = spawn(process.execPath, ['server.js'], {
    cwd: standalone,
    env: { ...env, PORT: String(port), HOSTNAME: '127.0.0.1' },
    stdio: ['ignore', out, out],
  });
  for (let i = 0; i < 60; i += 1) {
    await sleep(500);
    if ((await get(port, '/robots.txt')).status !== 0) break;
  }
  log(`cold standalone server.js pid ${server.pid} on :${port}`);

  stub.hold();
  const held0 = stub.counts.held;
  const first = await get(port, '/');
  log(`GET / -> ${first.status} x-nextjs-cache=${first.cache} (stale answer; the regeneration is now blocked on the stub)`);
  for (let i = 0; i < 40 && stub.counts.held === held0; i += 1) await sleep(250);
  await sleep(1500);
  log(`${stub.counts.held - held0} upstream reads held open; FREEZING pid ${server.pid} for ${FREEZE_MS / 1000} s, stub drops every socket`);
  freeze(server.pid, false);
  stub.refuse();
  await sleep(FREEZE_MS);
  freeze(server.pid, true);
  log('thawed; letting the regeneration fail or finish ...');
  await sleep(20_000);

  const results = {};
  for (const p of ['/', '/menu', '/features/ai-sites', '/new-page']) {
    const r = await get(port, p);
    results[p] = { status: r.status, cache: r.cache, lemonTart: r.body.includes('Lemon Tart'), plumGalette: r.body.includes('Plum Galette') };
    log(`GET ${p} -> ${r.status} x-nextjs-cache=${r.cache} LemonTart=${results[p].lemonTart} PlumGalette=${results[p].plumGalette}`);
    await sleep(3000);
  }
  await sleep(5000);
  server.kill();
  stub.close();
  fs.closeSync(out);

  const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
  const events = (name) => lines.filter((l) => l.includes(`"event":"${name}"`)).map((l) => JSON.parse(l.slice(l.indexOf('{'))));
  const longFailed = lines.filter((l) => /"outcome":"failed"/.test(l) && Number(/"elapsedMs":(\d+)/.exec(l)?.[1] ?? 0) >= FREEZE_MS);
  const floorLines = events('site.snapshot.floor');
  const summary = {
    platform: process.platform,
    freeze: process.platform === 'win32' ? 'NtSuspendProcess' : 'SIGSTOP',
    responses: results,
    regenerationFailedReadsElapsed60sPlus: longFailed.length,
    fallbackLines: lines.filter((l) => l.includes('returning fallback for')).length,
    floorLines: floorLines.length,
    floorPaths: [...new Set(floorLines.map((e) => `${e.path} (${e.reason})`))],
    missLines: events('site.snapshot.miss').length,
    present: events('site.snapshot.present').map((e) => ({ resolvedPath: e.resolvedPath, bytes: e.bytes })),
    serverLog: logFile,
  };
  const checks = {
    'regeneration reads failed after 60 s+': longFailed.length > 0,
    '/ 200 with Lemon Tart': results['/'].status === 200 && results['/'].lemonTart,
    '/menu 200 with Lemon Tart': results['/menu'].status === 200 && results['/menu'].lemonTart,
    '/features/ai-sites 200 with Plum Galette': results['/features/ai-sites'].status === 200 && results['/features/ai-sites'].plumGalette,
    '/new-page 5xx': results['/new-page'].status >= 500,
    'site.snapshot.floor lines': floorLines.length > 0,
    'zero site.snapshot.miss': summary.missLines === 0,
    'snapshot found at the standalone path': summary.present.some((p) => /standalone/.test(p.resolvedPath ?? '')),
  };
  summary.checks = checks;
  summary.verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  console.log(JSON.stringify(summary, null, 2));
  return summary.verdict === 'PASS' ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`[freeze-repro] ERROR ${err?.stack ?? err}`);
    process.exit(2);
  },
);
