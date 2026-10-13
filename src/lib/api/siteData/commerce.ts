import type { SiteData } from '@/types/SiteData';

/**
 * F-C19: the site payload's `commerce` (VR_Client_API v5), validated at the
 * boundary. Anything that is not the contract's shape reads as absent, which
 * every reader treats as selling, so a malformed payload can never take a
 * shop's Add buttons away. A list state other than `paused` or `moving` is
 * dropped for the same reason.
 */
export function readCommerce(raw: unknown): SiteData['commerce'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const { state, lists } = raw as { state?: unknown; lists?: unknown };
  if (state !== 'selling' && state !== 'paused' && state !== 'moving') return undefined;
  const byList: Record<string, 'paused' | 'moving'> = {};
  if (lists && typeof lists === 'object') {
    for (const [id, listState] of Object.entries(lists as Record<string, unknown>)) {
      if (listState === 'paused' || listState === 'moving') byList[id] = listState;
    }
  }
  return { state, lists: byList };
}
