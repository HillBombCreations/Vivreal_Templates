// Node module-customization loader for `../boundListPaging.test.ts` ONLY
// (`node --test` runs each test file in its own child process, so it touches
// nothing else). It loads the REAL `../buildPageContext.ts` and every reader
// it calls (`@/lib/api/collections` included) under plain node, with exactly
// these modules replaced:
//   - `server-only`: an empty module (it exists to fail a client bundle).
//   - `src/lib/api/client.ts`, however it is imported (`../client` from the
//     collections reader, `@/lib/api/client` from the shows and team
//     readers): `clientStub.mjs`, whose `clientFetchCached` answers from the
//     test's fake Client API, keyed by the exact request path the real
//     readers built. The real module imports `next/headers` and
//     `next/cache`, which plain node cannot run; everything below it (the
//     data cache, the floor seam) is the far side of the one read this test
//     counts.
//   - `@/lib/api/siteData`: `getPageBindingsByRole` serves only a legacy page
//     with no blocks (`../bindings.ts`); a blocks page never calls it, and the
//     stub throws if one does.
//   - `@hillbombcreations/site-renderer` (the package entry only): its
//     `dist/composition/index.js`, the file the entry re-exports
//     `pageDrawsContent` from (`dist/index.js:385`), so that function is the
//     REAL one. The entry also loads the Next provider (`next/link`), which
//     plain node cannot resolve; `buildPageContext` imports nothing else from
//     it at run time (the rest are types, erased). `pageEmptinessDraws.test.ts`
//     reads the renderer the same way.
// Every other import is the genuine source. The repo writes relative imports
// with no extension (`'../client'`) and mixes `.ts` and `.tsx`, so both are
// resolved here, and `.tsx` is handed to node's own type stripper.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const CLIENT_FILE = path.join(SRC_DIR, 'lib', 'api', 'client.ts');
const CLIENT_STUB_URL = pathToFileURL(path.resolve(import.meta.dirname, 'clientStub.mjs')).href;
const SERVER_ONLY_STUB_URL = 'pagecontexttestloader:server-only';
const SITE_DATA_STUB_URL = 'pagecontexttestloader:siteData';
const RENDERER_COMPOSITION = path.resolve(
  process.cwd(),
  'node_modules/@hillbombcreations/site-renderer/dist/composition/index.js',
);

/** `base` to the first of `base.ts`, `.tsx`, `/index.ts`, `/index.tsx` that exists, else null. */
function sourceFile(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function stubOrFile(file) {
  if (path.resolve(file) === CLIENT_FILE) return { url: CLIENT_STUB_URL, shortCircuit: true };
  return { url: pathToFileURL(file).href, shortCircuit: true };
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: SERVER_ONLY_STUB_URL, shortCircuit: true };
  if (specifier === '@/lib/api/siteData') return { url: SITE_DATA_STUB_URL, shortCircuit: true };
  if (specifier === '@hillbombcreations/site-renderer') {
    return { url: pathToFileURL(RENDERER_COMPOSITION).href, shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    const file = sourceFile(path.join(SRC_DIR, specifier.slice(2)));
    if (!file) throw new Error(`pageContextLoader: cannot resolve ${specifier}`);
    return stubOrFile(file);
  }
  const parentFile = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : null;
  if (parentFile && parentFile.startsWith(SRC_DIR) && (specifier.startsWith('./') || specifier.startsWith('../'))) {
    const file = sourceFile(path.resolve(path.dirname(parentFile), specifier));
    if (file) return stubOrFile(file);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === SERVER_ONLY_STUB_URL) return { format: 'module', shortCircuit: true, source: 'export {};' };
  if (url === SITE_DATA_STUB_URL) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export function getPageBindingsByRole() {
          throw new Error('pageContextLoader: a legacy page (no blocks) reached getPageBindingsByRole');
        }
      `,
    };
  }
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    return { format: 'module-typescript', shortCircuit: true, source: fs.readFileSync(fileURLToPath(url), 'utf8') };
  }
  return nextLoad(url, context);
}
