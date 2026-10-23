/**
 * Shared constants of the build-baked site snapshot (the render floor).
 * vivreal-hq docs/bugs/site-first-read-fallback/plan.md, sections 5.1 and 5.6.
 *
 * Plain module: the runtime floor, the recorder and the fill pass import it,
 * and the fill pass copies the values the build wrapper needs into its
 * manifest shard, so `scripts/build-with-snapshot.mjs` (plain JavaScript,
 * which cannot import TypeScript on the build image's Node) never keeps a
 * second copy of any of them.
 */

/** The snapshot file, written under `<distDir>/server/app/`, never under `static` or `public`. */
export const SNAPSHOT_FILE_NAME = 'site-snapshot.json';

/** The snapshot format version. The runtime refuses any other. */
export const SNAPSHOT_VERSION = 1;

/**
 * Build-only: the directory the recorder writes its shards to. Set by the
 * build wrapper and nothing else, so the recorder is inert in every other
 * process (a plain `next build`, `next start`, the deployed server, tests).
 */
export const RECORD_DIR_ENV = 'VIVREAL_SNAPSHOT_RECORD_DIR';

/**
 * The ONLY sites whose snapshot may carry `forceFloor: true` (plan 5.6): the
 * owner-approved temporary QA branch of qa-scratch-2-site (`pod_01.sites`
 * `_id`, Amplify app d1pynww5n5bp0). The wrapper requires the build's SITE_ID
 * to be listed here before it writes `forceFloor: true`, and the runtime
 * requires its own SITE_ID to be listed here before it honours it, so a file
 * copied into another app's bundle can never force that app's floor.
 */
export const FORCE_FLOOR_SITE_IDS: readonly string[] = Object.freeze(['6ad2755e8cd83f003a3ecc97']);
