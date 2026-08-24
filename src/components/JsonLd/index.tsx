/**
 * JsonLd — server component that emits a JSON-LD `<script>` tag.
 *
 * Helps both classic search crawlers (Google rich results) and AI assistants
 * understand the structured content of each page. Stringifies the schema with
 * `JSON.stringify` and emits via `dangerouslySetInnerHTML` per Google's
 * recommended pattern (https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).
 *
 * XSS safety:
 *   1. Inputs come from server-side fetches we control (siteData + page
 *      content), not from request URL params or user-form bodies.
 *   2. JSON.stringify on a plain object cannot produce raw `</script>` for
 *      primitive values.
 *   3. We additionally replace `<` with its unicode escape to defang any
 *      adversarial content field that contained literal `</script>` markup.
 *
 * Schema shapes used:
 *   - `WebSite` + `Organization` / `LocalBusiness` — emitted in root layout (every page)
 *   - `Product` — emitted on ecommerce detail pages with a price
 *   - `Event` — emitted on shows detail pages
 *   - `Article` — fallback for other content detail pages
 */

interface JsonLdProps {
  schema: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function JsonLd({ schema }: JsonLdProps) {
  // JSON-LD emission per Google's documented pattern. Inputs are
  // server-controlled (siteData + content from our own VR_Client_API); `<` is
  // defanged via unicode escape to belt-and-suspenders against any adversarial
  // content field containing literal `</script>`.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  );
}

// The pure payload builders live in ./schema.ts so the plain-Node test runner
// can import them (this file's JSX makes it unloadable there). Re-exported so
// every `@/components/JsonLd` import site is unchanged.
export { buildSiteJsonLd, buildDetailJsonLd } from './schema';
export type { DetailJsonLdInput } from './schema';
