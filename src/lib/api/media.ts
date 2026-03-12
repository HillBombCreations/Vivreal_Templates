/**
 * CDN media URL resolution.
 *
 * All user-uploaded media is served through the Vivreal CDN
 * (Lambda@Edge → S3 origin). This module builds the public URL
 * from a bucket name + object key.
 */

const CDN_BASE_URL = (process.env.CDN_BASE_URL || 'https://media.vivreal.io').replace(/\/+$/, '');
const BUCKET_NAME = process.env.BUCKET_NAME || '';

/**
 * Build a CDN URL for a media object.
 * Returns empty string if bucket or key is missing.
 */
export function mediaCdnUrl(key: string | undefined, bucket?: string): string {
  const b = (bucket || BUCKET_NAME).trim();
  const k = (key || '').trim().replace(/^\/+/, '');
  if (!b || !k) return '';
  return `${CDN_BASE_URL}/${b}/${k}`;
}
