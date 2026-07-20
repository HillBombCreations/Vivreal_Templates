import 'server-only';
import { clientFetch } from '@/lib/api/client';

export async function subscribeUser(
  email: string,
  collectionId: string,
  // Optional extra subscriber attributes (route-sanitized — e.g. { location }
  // from the footer newsletter's location select). Spread BEFORE email so the
  // caller can never overwrite the validated address.
  fields?: Record<string, string>,
): Promise<boolean> {
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
    return true;
  } catch (err) {
    console.error('[subscribeUser] error:', err);
    return false;
  }
}
