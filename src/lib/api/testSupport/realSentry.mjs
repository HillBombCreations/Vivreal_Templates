// The REAL `@sentry/nextjs`, loaded ONLY through `realSentryLoader.mjs` for
// `../scrubbedCapture.sdk.test.ts`. Nothing about the SDK is faked: this is
// the package's Node server build (`exports["."].node`,
// `build/cjs/index.server.js`), the same one a Templates route runs on.
//
// Why `createRequire`: an ESM `import` of the package under plain node picks
// the same CJS file, but node cannot see its named exports through the CJS
// lexer (`captureMessage`, `flush` and `withScope` come back undefined, which
// is what `../../../app/api/contact/testSupport/routeLoader.mjs` ran into).
// `require` returns the full module object.
//
// The one addition: `init` gets a transport that keeps each serialized
// envelope in memory instead of sending it, so the test never touches the
// network and can read exactly what would have left the process. Every other
// option is the caller's (the repo's own `src/instrumentation.ts`).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Sentry = require('@sentry/nextjs');
const { createTransport } = require('@sentry/core');

const envelopes = [];
let initOptions = null;

function decode(body) {
  return typeof body === 'string' ? body : Buffer.from(body).toString('utf8');
}

export function init(options) {
  initOptions = options;
  return Sentry.init({
    ...options,
    transport: (transportOptions) =>
      createTransport(transportOptions, async (request) => {
        envelopes.push(decode(request.body));
        return { statusCode: 200 };
      }),
  });
}

export const withScope = Sentry.withScope;
export const captureMessage = Sentry.captureMessage;
export const flush = Sentry.flush;
export const close = Sentry.close;
export const SDK_VERSION = Sentry.SDK_VERSION;

/** Test-only control surface. Never imported by app code. */
export const __realSentryControl = {
  /** Each serialized envelope the SDK sent, in order. */
  get envelopes() {
    return envelopes;
  },
  /** The options `init` received, before the transport was added. */
  get initOptions() {
    return initOptions;
  },
};
