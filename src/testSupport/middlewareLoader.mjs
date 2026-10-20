// Node module-customization loader for `src/middleware.ts`, registered by
// `src/middleware.test.ts` only (`node --test` runs each test file in its own
// process). Same approach as `src/app/api/contact/testSupport/routeLoader.mjs`:
//   - `next/server` has no "exports" map plain Node can resolve, so it maps to
//     a small stand-in carrying exactly what middleware.ts calls
//     (`new NextResponse`, `NextResponse.next`, `NextResponse.redirect`).
//   - `@/x` rewrites to `./src/x.ts`, so every other module middleware.ts
//     imports (edgeSiteMap, frozenGate, redirects, previewToken, botVerdict,
//     neverAPagePath) is the REAL code, including the real edge-map fetch the
//     test counts through a mocked global `fetch`.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC_ROOT = pathToFileURL(`${path.resolve(process.cwd(), 'src')}/`).href;
const NEXT_SERVER_STUB_URL = 'middlewaretestloader:next/server';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    return { url: NEXT_SERVER_STUB_URL, shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    return nextResolve(`${SRC_ROOT}${specifier.slice(2)}.ts`, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === NEXT_SERVER_STUB_URL) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        export class NextRequest {}
        export class NextResponse {
          constructor(body, init) {
            this.kind = 'response';
            this.body = body ?? null;
            this.status = (init && init.status) || 200;
            this.headers = new Headers((init && init.headers) || {});
          }
          static next() {
            const response = new NextResponse(null, { status: 200 });
            response.kind = 'next';
            return response;
          }
          static redirect(url, status) {
            const response = new NextResponse(null, { status: status || 307 });
            response.kind = 'redirect';
            response.headers.set('location', String(url));
            return response;
          }
        }
      `,
    };
  }
  return nextLoad(url, context);
}
