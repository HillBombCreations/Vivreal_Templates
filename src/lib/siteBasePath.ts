/**
 * The site's base path build setting (release B, F270: the help centre served
 * at https://vivreal.io/help; vivreal-hq
 * docs/projects/next-release-B/design-help-path.md SW-B-H5, SW-B-H6, row TP-2).
 *
 * ONE setting, `SITE_BASE_PATH`, carried only by the help app. Unset (every
 * other site) means no base path at all, so their builds are unchanged.
 * `next.config.ts` reads it once, at build, and turns it into Next's
 * `basePath` plus the inlined `VIVREAL_SITE_BASE_PATH` (`src/lib/sitePath.ts`).
 *
 * The grammar is SW-B-H6, the same table the renderer's `normalizeBasePath`
 * applies: one lowercase segment, words joined by single hyphens, never a path
 * another app on the same host owns. A wrong value THROWS, so the build fails
 * rather than shipping a site whose every link points somewhere else.
 *
 * No imports: `next.config.ts` loads it before anything is bundled.
 */

const BASE_PATH_GRAMMAR = /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Paths another app on vivreal.io already owns: the portal (`/app`), the APIs
 * and the MCP endpoint, Next's own assets, and the old docs address the front
 * door redirects. `/_next` can never match the grammar (the underscore) and
 * stays listed so the table reads the same as the renderer's.
 */
const RESERVED_BASE_PATHS: ReadonlySet<string> = new Set(['/app', '/api', '/_next', '/docs', '/mcp']);

/** `''` when unset or empty, the value when it is a valid base path; anything else throws. */
export function readSiteBasePath(raw: string | undefined): string {
  if (raw === undefined || raw === '') return '';
  if (BASE_PATH_GRAMMAR.test(raw) && !RESERVED_BASE_PATHS.has(raw)) return raw;
  throw new Error(`SITE_BASE_PATH must be one lowercase path segment such as /help, got ${raw}`);
}
