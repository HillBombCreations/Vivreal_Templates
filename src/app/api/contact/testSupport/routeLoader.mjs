// Node module-customization loader for `route.ts` ONLY (review-templates-
// 184.md item 2). `route.ts` cannot be loaded by the plain-node test runner
// as-is: it imports `next/server`, which has no "exports" map and no `.js`-
// less resolution outside Next's own bundler (confirmed: `node -e
// "import('next/server')"` fails with `ERR_MODULE_NOT_FOUND` even with
// nothing else involved), and it imports several `@/...` path-aliased
// modules that only Next's bundler, not plain Node, knows how to resolve.
// That split is why every sibling route test (`checkout/route.test.ts`,
// `delivery-quote/route.test.ts`, and this file's own OLD version) pins
// `route.ts`'s SOURCE TEXT instead of calling it. Source-text pinning cannot
// tell a correct ordering from a reordering that merely keeps the same
// substrings in existence — review-templates-184.md's mutation table found
// two mutations that changed the flush's real timing and left those checks
// green.
//
// This loader (registered with `node:module`'s `register()`, scoped to the
// ONE test file that calls it — `node --test` runs each test file in its
// own child process by default, confirmed empirically for this repo's Node
// 22) makes `route.ts` actually importable, so the behaviour itself can be
// pinned:
//   - `next/server` resolves to a tiny stand-in (`NextResponse.json` that
//     returns a plain `{ status, body }` object; `NextRequest` is never
//     constructed by this loader, since the test hands `POST` a duck-typed
//     `{ json() }` object instead).
//   - `@sentry/nextjs` resolves to a controllable fake (`sentryStub.mjs`)
//     instead of the real SDK. The real package DOES load under plain Node,
//     but which build of it loads depends on which export condition Node
//     picks outside Next's own runtime, and a quick check found that build
//     exposes neither `captureMessage` nor `flush` at the top level — so
//     importing the real thing here would make `route.ts` crash on a call
//     that works in the actual edge runtime, not exercise the ordering this
//     test exists to pin. A controllable fake is also what the review
//     recommended ("stub Sentry.flush and fetch with controlled promises").
//   - `@/x` rewrites to this package's own `./src/x.ts`, so every OTHER
//     import (`@/lib/contactRecipient`, `@/lib/leadAttribution`,
//     `@/lib/api/errorCapture`, `@hillbombcreations/email-brand`) stays the
//     REAL module. Only the two things a plain-node process cannot load at
//     all are faked; everything else in the request path is the genuine
//     code, including the real `resolveSiteContact` / `resolveContactRecipient`
//     this route calls.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC_ROOT = pathToFileURL(`${path.resolve(process.cwd(), 'src')}/`).href;
const SENTRY_STUB_URL = pathToFileURL(
  path.resolve(import.meta.dirname, 'sentryStub.mjs'),
).href;
const NEXT_SERVER_STUB_URL = 'routetestloader:next/server';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    return { url: NEXT_SERVER_STUB_URL, shortCircuit: true };
  }
  if (specifier === '@sentry/nextjs') {
    return { url: SENTRY_STUB_URL, shortCircuit: true };
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
        // Duck-typed stand-in. route.ts only reads NextRequest as a TYPE
        // (erased by --experimental-strip-types) and calls NextResponse.json
        // as a value — nothing else from "next/server" is used here.
        export class NextRequest {}
        export class NextResponse {
          static json(body, init) {
            return { status: (init && init.status) || 200, body };
          }
        }
      `,
    };
  }
  return nextLoad(url, context);
}
