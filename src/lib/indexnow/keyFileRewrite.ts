/**
 * The site-root rewrite onto the IndexNow key route (discovery batch 2.2),
 * spread into `next.config.ts` `beforeFiles`. Any 32 lowercase hex `.txt` name
 * at the root reaches `/api/indexnow/key/<name>`; `./keyFile.ts` decides the
 * answer.
 *
 * A module of its own with NO imports, because `next.config.ts` loads it while
 * building every site in the fleet, and nothing it pulls in may fail there.
 */
export const KEY_FILE_REWRITE = {
  source: '/:key([0-9a-f]{32}).txt',
  destination: '/api/indexnow/key/:key',
};
