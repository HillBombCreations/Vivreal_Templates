import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Discovery batch 3.4, layer 2 wiring: each non-HTML route handler stamps the
// demo X-Robots-Tag itself (behaviour in demoRobotsHeader.test.ts). Kept in a
// file of its own, importing nothing from the change, so it runs (and fails)
// on a tree without it.
// The handlers import next/server and cannot load here, so the call to the
// stamping helper is pinned in each source file.
const routeSource = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

for (const [route, marker] of [
  ['../../app/llms.txt/route.ts', 'edgeRouteIsDemo()'],
  ['../../app/.well-known/mcp.json/route.ts', 'edgeRouteIsDemo()'],
  ['../../app/sitemap.xml/route.ts', 'withDemoRobotsHeader('],
  ['../../app/sitemaps/[file]/route.ts', 'withDemoRobotsHeader('],
  ['../../app/og/[slug]/route.tsx', 'withDemoRobotsHeader('],
  ['../../app/og/[slug]/[itemId]/route.tsx', 'withDemoRobotsHeader('],
] as const) {
  test(`SOURCE PIN: ${route} stamps the demo header itself`, () => {
    assert.ok(routeSource(route).includes(marker), `${route} must call ${marker}`);
  });
}
