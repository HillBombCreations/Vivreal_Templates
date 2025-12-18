export function noStore(extra: Record<string, string> = {}) {
  return {
    'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate, private',
    Vary: 'Cookie, Authorization',
    ...extra,
  };
}