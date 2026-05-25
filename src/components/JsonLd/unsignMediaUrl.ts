/**
 * Strip CloudFront signing query parameters from a media URL so the result
 * is safe to embed in long-lived structured data (JSON-LD, Open Graph).
 *
 * Why this exists:
 *   The `getSignedUrl()` helper in `@/lib/api/media` produces signed
 *   CloudFront URLs that VR_Client_API signs with a 300-second TTL
 *   (`CLOUDFRONT_SIGNED_URL_TTL_SECONDS=300` in `VR_Client_API/sam-template.yaml:100`).
 *   Those URLs are correct for direct `<img>` rendering — the browser
 *   fetches immediately. But JSON-LD `image` fields are read by crawlers
 *   and AI agents potentially DAYS or WEEKS after page render, by which
 *   time the signature has expired and CloudFront returns 403. The
 *   structured data still references the URL; the image never resolves.
 *
 * The fix:
 *   Strip the three CloudFront-signing query params (`Expires`,
 *   `Signature`, `Key-Pair-Id`) before embedding in JSON-LD. The naked
 *   URL still resolves through CloudFront — the OAI / signed-URL policy
 *   only fires when the corresponding query params are present, so the
 *   stripped form falls into the "no signed-URL policy" path which
 *   either returns the object (if the CDN allows unsigned reads via the
 *   underlying S3 ACL) or returns the same 403 it would have returned
 *   to an expired signature.
 *
 *   That second path matters: if the CloudFront distribution requires a
 *   signed URL for ALL reads (Vivreal's does — see
 *   `signCloudFrontUrl.js`), the unsigned form 403s too. In that case
 *   JSON-LD imageUrl is unusable today regardless of approach. The
 *   stripping at least makes the URL stable (no per-request expiry),
 *   so the moment Vivreal Operations re-policies the distribution to
 *   allow public reads on a `/jsonld/*` path or similar, every
 *   already-indexed JSON-LD record self-heals — no re-crawl required.
 *
 *   In the interim, the JSON-LD `image` field with the stripped URL
 *   degrades gracefully: Google's rich-results parser tolerates an
 *   unreachable image (no rich card, but the rest of the structured
 *   data still indexes). With signed-and-expired URLs, the URL itself
 *   may look like spam to anti-cloaking heuristics.
 *
 * What it returns:
 *   - Input `undefined` / `null` / empty / non-string → `undefined`
 *     (caller passes that through to JSON-LD builders which omit the
 *     `image` field when undefined).
 *   - Input that doesn't have CloudFront signing params → returned
 *     unchanged.
 *   - Input with CloudFront signing params → returned with those three
 *     params removed; other query params (e.g. `?v=`, `?width=`) are
 *     preserved.
 *
 *   The URL is parsed via `URL` so we round-trip through whatever
 *   normalization the platform applies — keeps the output canonical.
 *
 * NOT a security boundary. Anyone who has the stripped URL can attempt
 * to fetch it; the CloudFront distribution's policy is what enforces
 * access control. This helper is about avoiding cache-busting expiry,
 * not about authorization.
 */

const CLOUDFRONT_SIGNING_PARAMS = ['Expires', 'Signature', 'Key-Pair-Id'];

export function unsignMediaUrl(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length === 0) return undefined;

  // The URL parser is more forgiving than a regex and handles edge
  // cases like fragments, ports, encoded characters correctly.
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    // Malformed URL — pass through as-is. JSON-LD will reject it via
    // Google's validator but we don't want to silently drop data.
    return input;
  }

  let modified = false;
  for (const param of CLOUDFRONT_SIGNING_PARAMS) {
    if (parsed.searchParams.has(param)) {
      parsed.searchParams.delete(param);
      modified = true;
    }
  }

  if (!modified) return input;

  // If we stripped all params, drop the trailing `?` for cleaner URLs.
  if ([...parsed.searchParams.keys()].length === 0) {
    parsed.search = '';
  }

  return parsed.toString();
}
