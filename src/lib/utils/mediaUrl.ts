const DEFAULT_CDN_BASE_URL = 'https://media.vivreal.io';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const trimLeadingSlash = (value: string) => value.replace(/^\/+/, '');

export const buildMediaUrl = (bucketName: string | undefined, key: string | undefined): string => {
  const bucket = String(bucketName || '').trim();
  const cleanKey = trimLeadingSlash(String(key || '').trim());

  if (!bucket || !cleanKey) return '';

  const cdnBaseUrl = trimTrailingSlash(String(process.env.CDN_BASE_URL || DEFAULT_CDN_BASE_URL).trim());
  return `${cdnBaseUrl}/${bucket}/${cleanKey}`;
};
