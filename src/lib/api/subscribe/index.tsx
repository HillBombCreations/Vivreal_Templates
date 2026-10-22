import 'server-only';
import { ApiError, clientFetch } from '@/lib/api/client';

/**
 * `status` is the upstream HTTP status when VR_Client_API answered, absent
 * when no answer came back (a network failure). The caller reports it; this
 * function must not swallow it, or a failing write loses every subscriber
 * with nothing in Sentry (review-templates204-2026-10-21.md, Fold in).
 */
export type SubscribeResult = { ok: true } | { ok: false; status?: number };

export async function subscribeUser(
  email: string,
  collectionId: string,
  // Optional extra subscriber attributes (route-sanitized — e.g. { location }
  // from the footer newsletter's location select). Spread BEFORE email so the
  // caller can never overwrite the validated address.
  fields?: Record<string, string>,
): Promise<SubscribeResult> {
  try {
    await clientFetch<unknown>('/tenant/definedCollectionObject', {
      method: 'POST',
      body: JSON.stringify({
        collectionId,
        type: 'subscribeUser',
        objectValue: {
          ...(fields ?? {}),
          email,
        },
      }),
    });
    return { ok: true };
  } catch (err) {
    console.error('[subscribeUser] error:', err);
    return err instanceof ApiError ? { ok: false, status: err.status } : { ok: false };
  }
}
