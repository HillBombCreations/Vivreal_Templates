// Loader for `../scrubbedCapture.sdk.test.ts` ONLY. It is the subscribe
// route's loader (`src/app/api/subscribe/testSupport/routeLoader.mjs`, which
// fakes `next/server`, `server-only` and the config half of
// `@/lib/api/client`) with ONE difference: `@sentry/nextjs` resolves to
// `realSentry.mjs`, the real SDK, instead of the controllable stub.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import * as routeLoader from '../../../app/api/subscribe/testSupport/routeLoader.mjs';

const REAL_SENTRY_URL = pathToFileURL(path.resolve(import.meta.dirname, 'realSentry.mjs')).href;

export async function resolve(specifier, context, nextResolve) {
  // `realSentry.mjs` itself loads the package; never send it back to itself.
  if (specifier === '@sentry/nextjs' && context.parentURL !== REAL_SENTRY_URL) {
    return { url: REAL_SENTRY_URL, shortCircuit: true };
  }
  return routeLoader.resolve(specifier, context, nextResolve);
}

export const load = routeLoader.load;
