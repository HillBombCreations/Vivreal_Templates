// Node module-customization loader for `route.tsx` ONLY, registered by
// `../route.test.ts` (`node --test` runs each test file in its own child
// process, so it touches nothing else). Same approach as
// `../../contact/testSupport/routeLoader.mjs`, whose header explains why
// `next/server` and `@sentry/nextjs` cannot be loaded as-is under plain node.
//
// What is faked, and only this:
//   - `next/server`: `NextResponse.json` returns a plain `{ status, body }`.
//   - `@sentry/nextjs`: the contact route's controllable stub, the same file,
//     so the test can read captures and settle `flush()` on its own schedule.
//   - `server-only`: an empty module (it exists to fail a client bundle).
//   - `@/lib/api/client`: `clientStub.mjs`, which runs the REAL
//     `doClientFetch` and re-exports the REAL `ApiError`. The real `client.ts`
//     imports `next/headers` for the preview token, which a POST from this
//     route never needs. The test mocks `globalThis.fetch`, the far upstream,
//     so the status `subscribeUser` reports is the one the real core threw.
//
// Every other `@/...` import resolves to the genuine source. This repo mixes
// `.ts` and `.tsx` (the route and `@/lib/api/subscribe` are `.tsx` with no
// JSX in them), so `.tsx` is handed to node's own type stripper.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const SENTRY_STUB_URL = pathToFileURL(
  path.resolve(import.meta.dirname, '../../contact/testSupport/sentryStub.mjs'),
).href;
const CLIENT_STUB_URL = pathToFileURL(path.resolve(import.meta.dirname, 'clientStub.mjs')).href;
const NEXT_SERVER_STUB_URL = 'subscriberoutetestloader:next/server';
const SERVER_ONLY_STUB_URL = 'subscriberoutetestloader:server-only';

/** `@/a/b` to the first of `src/a/b.ts`, `.tsx`, `/index.ts`, `/index.tsx` that exists. */
function resolveAlias(specifier) {
  const base = path.join(SRC_DIR, specifier.slice(2));
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`routeLoader: cannot resolve ${specifier}`);
  return pathToFileURL(found).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return { url: NEXT_SERVER_STUB_URL, shortCircuit: true };
  if (specifier === 'server-only') return { url: SERVER_ONLY_STUB_URL, shortCircuit: true };
  if (specifier === '@sentry/nextjs') return { url: SENTRY_STUB_URL, shortCircuit: true };
  if (specifier === '@/lib/api/client') return { url: CLIENT_STUB_URL, shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: resolveAlias(specifier), shortCircuit: true };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === NEXT_SERVER_STUB_URL) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export class NextResponse {
          static json(body, init) {
            return { status: (init && init.status) || 200, body };
          }
        }
      `,
    };
  }
  if (url === SERVER_ONLY_STUB_URL) {
    return { format: 'module', shortCircuit: true, source: 'export {};' };
  }
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    return {
      format: 'module-typescript',
      shortCircuit: true,
      source: fs.readFileSync(fileURLToPath(url), 'utf8'),
    };
  }
  return nextLoad(url, context);
}
