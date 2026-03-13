import 'server-only';
import { clientFetch } from '@/lib/api/client';

export async function subscribeUser(email: string, collectionId: string): Promise<boolean> {
  try {
    await clientFetch<unknown>('/tenant/definedCollectionObject', {
      method: 'POST',
      body: JSON.stringify({
        collectionId,
        type: 'subscribeUser',
        objectValue: {
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
