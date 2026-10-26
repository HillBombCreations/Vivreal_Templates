/**
 * The two names a stored consent choice lives under, in a leaf module with no
 * imports.
 *
 * WHY A LEAF. `gaInitScript.ts` has to read the stored choice (the GA init sets
 * its consent default from it), and `gaInitScript.ts` is also imported by the
 * server component <SiteAnalytics>. Importing the client consent controller
 * (`consent.ts`) from there would pull it into the server graph. Both modules
 * import these from here, and `consent.ts` re-exports them so every existing
 * importer keeps working unchanged.
 */

/** localStorage key holding the visitor's choice (`'accepted'` or `'rejected'`). */
export const COOKIE_CONSENT_KEY = 'cookie_consent_v2';

/** Host-only cookie mirroring an ACCEPT, so the server (and the GA init) can tell. */
export const CONSENT_COOKIE_NAME = 'vr_consent';
