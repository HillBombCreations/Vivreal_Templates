/**
 * The named-vendor tag registry (G14 / change item C9).
 *
 * `analytics.additional[]` declares extra marketing tags as
 * `{ provider, id }` — and NOTHING ELSE crosses the config boundary. `provider`
 * is an ENUM that maps to a snippet hard-coded in this file; `id` is validated
 * against a per-provider charset before it is interpolated. NO URLs, NO script
 * bodies, NO GTM container, ever.
 *
 * WHY THIS SHAPE AND NOT A CUSTOM-SCRIPT SLOT. A `siteData`-driven raw script
 * slot is stored XSS with extra steps across every customer site, and a GTM
 * container is the same thing with a UI. Templates sites carry NO
 * document-level CSP (`next.config.ts`'s CSP is scoped to `next/image` SVG
 * responses), so these regexes are the only line of defence — which forecloses
 * the raw-slot option permanently rather than merely losing it on cost.
 *
 * The risk class this DOES accept is the one the codebase already accepts:
 * `SiteAnalytics` interpolates a validated GA4 id into an inline script today.
 * `{provider, id}` against a hard-coded snippet is that same pattern, not a
 * new one.
 *
 * FAIL-CLOSED IN EVERY DIRECTION. Unknown provider, non-matching id, missing
 * id, wrong type, `rb2b` on a customer host — each renders NOTHING, silently.
 * There is no partial success and no error path that emits a half-built tag.
 *
 * WHERE IT RENDERS. Not here, and never in <head>. These snippets are handed to
 * the consent controller (`lib/consent.ts`), which injects them on grant and on
 * restore and only then. GA4 can ship in <head> denied because it has a consent
 * API; Clarity and RB2B have none, so NOT LOADING is the only gate that exists
 * for them.
 *
 * ADDING A VENDOR IS NOT A CONFIG CHANGE. It is a code change here, with a
 * privacy-policy consequence (C6's seven-point disclosure treatment) and a
 * GATE 3 cookie-enumeration consequence. That friction is the feature.
 */

import type { VendorScript } from './consent.ts';
import { isVivrealApex } from './vivrealApex.ts';

export type VendorProvider = 'clarity' | 'rb2b';

/** The config shape as it arrives from `siteData.analytics.additional[]`. */
export interface AdditionalVendorConfig {
  provider?: string;
  id?: string;
}

/**
 * Per-provider id shapes.
 *
 * `(?![\s\S])` rather than `$` deliberately: JavaScript's `$` also matches
 * BEFORE a trailing newline, so `/^[A-Z0-9]{8,24}$/` accepts `"ABCD1234\n"`.
 * A newline reaching an inline script would break it rather than inject (it
 * lands inside a quoted string literal), but "breaks rather than injects" is
 * not a property worth relying on in the one place that has no CSP behind it.
 * These anchors accept exactly the same id SET as the design's regexes.
 */
const ID_PATTERN: Record<VendorProvider, RegExp> = {
  rb2b: /^[A-Z0-9]{8,24}(?![\s\S])/,
  clarity: /^[a-z0-9]{6,24}(?![\s\S])/,
};

/**
 * Per-provider host allowlist, enforced in CODE rather than config.
 *
 * RB2B is person-level de-anonymisation — it resolves an anonymous visitor to a
 * named individual against a third-party identity graph. It must not be
 * possible to enable it on a customer site, so a config that somehow carried
 * `provider:'rb2b'` on `acme.com` still renders nothing. Clarity (aggregate
 * session replay and heatmaps) is a materially lower exposure and is allowed on
 * any site that configures it.
 */
const HOST_ALLOWED: Record<VendorProvider, (hostname: string | null) => boolean> = {
  rb2b: (hostname) => isVivrealApex(hostname),
  clarity: () => true,
};

/** Stable DOM ids, so a re-apply within one page lifetime cannot double-inject. */
const DOM_ID: Record<VendorProvider, string> = {
  rb2b: 'vr-vendor-rb2b',
  clarity: 'vr-vendor-clarity',
};

/**
 * Microsoft Clarity — aggregate session replay + heatmaps.
 *
 * Ported from the tag running on Vivreal_SSR_Landing, with one correction: the
 * live copy hard-codes the project id into the script URL as well as passing it
 * as `i`. Here the URL is built FROM `i`, so the single validated id feeds both
 * positions and the two can never drift apart.
 *
 * `?ref=bwt` is retained from the live tag — it marks the project as
 * Bing-Webmaster-Tools-linked, and dropping it would change how the existing
 * Clarity project attributes this traffic.
 */
function claritySnippet(id: string): string {
  return `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");`;
}

/**
 * RB2B — business-visitor identification.
 *
 * Ported from the tag running on Vivreal_SSR_Landing, with the correction the
 * design calls for: the live copy interpolates the key into `reb2b.load(key)`
 * but HARD-CODES the same key into the script URL path, so the two would
 * silently disagree the moment the id changed. Both positions are fed from the
 * one validated id here.
 *
 * OUTSTANDING before this tag is enabled (C7 part 3): re-check the current
 * snippet in the RB2B dashboard. The vendor's host has changed before, and this
 * is a copy of what was live at implementation time, not a fetch.
 */
function rb2bSnippet(id: string): string {
  return `!function(){var reb2b=window.reb2b=window.reb2b||[];if(reb2b.invoked)return;reb2b.invoked=true;reb2b.methods=["identify","collect"];reb2b.factory=function(method){return function(){var args=Array.prototype.slice.call(arguments);args.unshift(method);reb2b.push(args);return reb2b;};};for(var i=0;i<reb2b.methods.length;i++){var key=reb2b.methods[i];reb2b[key]=reb2b.factory(key);}reb2b.load=function(key){var script=document.createElement("script");script.type="text/javascript";script.async=true;script.src="https://s3-us-west-2.amazonaws.com/b2bjsstore/b/"+key+"/"+key+".js.gz";var first=document.getElementsByTagName("script")[0];first.parentNode.insertBefore(script,first);};reb2b.SNIPPET_VERSION="1.0.1";reb2b.load("${id}");}();`;
}

const SNIPPET: Record<VendorProvider, (id: string) => string> = {
  clarity: claritySnippet,
  rb2b: rb2bSnippet,
};

function isKnownProvider(provider: unknown): provider is VendorProvider {
  return provider === 'clarity' || provider === 'rb2b';
}

/**
 * Resolve one config entry to an injectable snippet, or `null`.
 *
 * Exported for the unit tests, which assert every rejection path individually —
 * a registry that fails closed only in aggregate is a registry nobody can
 * reason about.
 */
export function resolveVendorScript(
  entry: AdditionalVendorConfig | null | undefined,
  hostname: string | null,
): VendorScript | null {
  if (!entry || typeof entry !== 'object') return null;

  const { provider, id } = entry;
  if (!isKnownProvider(provider)) return null;
  if (typeof id !== 'string') return null;
  if (!ID_PATTERN[provider].test(id)) return null;
  if (!HOST_ALLOWED[provider](hostname)) return null;

  return { domId: DOM_ID[provider], innerHTML: SNIPPET[provider](id) };
}

/**
 * Resolve the whole `analytics.additional[]` array.
 *
 * Duplicate providers collapse to the first valid entry: two Clarity projects
 * on one page would race for the same global, and the shared DOM id would make
 * the second injection a silent no-op anyway. Better to make that explicit here
 * than to depend on the injector's guard.
 */
export function resolveVendorScripts(
  additional: readonly AdditionalVendorConfig[] | null | undefined,
  hostname: string | null,
): VendorScript[] {
  if (!Array.isArray(additional)) return [];

  const seen = new Set<string>();
  const out: VendorScript[] = [];
  for (const entry of additional) {
    const script = resolveVendorScript(entry, hostname);
    if (!script) continue;
    if (seen.has(script.domId)) continue;
    seen.add(script.domId);
    out.push(script);
  }
  return out;
}
