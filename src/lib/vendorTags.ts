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
 * id, wrong type — each renders NOTHING, silently. There is no partial success
 * and no error path that emits a half-built tag.
 *
 * WHERE IT RENDERS. Not here, and never in <head>. These snippets are handed to
 * the consent controller (`lib/consent.ts`), which injects them on grant and on
 * restore and only then. GA4 can ship in <head> denied because it has a consent
 * API; Clarity has none, so NOT LOADING is the only gate that exists for it.
 * The controller is also apex-gated, so nothing in this registry can reach a
 * customer site today regardless of what a site doc carries.
 *
 * ADDING A VENDOR IS NOT A CONFIG CHANGE. It is one entry in REGISTRY below,
 * with a privacy-policy consequence (C6's disclosure treatment) and a GATE 3
 * cookie-enumeration consequence. That friction is the feature.
 *
 * ★ STANDING RULE FOR WHOEVER ADDS THE NEXT ONE. This registry deliberately
 * carries no per-vendor host allowlist, because the one vendor in it is
 * fleet-safe: Clarity is aggregate session replay and heatmaps, and a customer
 * who configures it is entitled to run it on their own site. A vendor that
 * performs PERSON-LEVEL IDENTIFICATION is a different class and must NOT be
 * enablable by config on a customer domain — if one is ever added, re-introduce
 * an apex-only gate IN CODE here (an earlier revision of this file carried one
 * for RB2B, dropped by owner decision on 2026-08-20), rather than relying on
 * the consent controller's gate alone.
 */

import type { VendorScript } from './consent.ts';

export type VendorProvider = 'clarity';

/** The config shape as it arrives from `siteData.analytics.additional[]`. */
export interface AdditionalVendorConfig {
  provider?: string;
  id?: string;
}

interface VendorEntry {
  /** Stable DOM id, so a re-apply within one page lifetime cannot double-inject. */
  domId: string;
  /**
   * The id charset.
   *
   * `(?![\s\S])` rather than `$` deliberately: JavaScript's `$` also matches
   * BEFORE a trailing newline, so `/^[a-z0-9]{6,24}$/` accepts `"abcdef\n"`.
   * A newline reaching an inline script would break it rather than inject (it
   * lands inside a quoted string literal), but "breaks rather than injects" is
   * not a property worth relying on in the one place that has no CSP behind it.
   */
  idPattern: RegExp;
  /** The hard-coded snippet body. The validated id is its ONLY input. */
  snippet: (id: string) => string;
}

/**
 * Microsoft Clarity — aggregate session replay + heatmaps.
 *
 * Ported from the tag running on Vivreal_SSR_Landing, with one correction: the
 * live copy hard-codes the project id into the script URL as well as passing it
 * as `i`. Here the URL is built FROM `i`, so the single validated id feeds both
 * positions and the two can never drift apart.
 *
 * `?ref=bwt` is retained from the live tag. It marks the project as
 * Bing-Webmaster-Tools-linked; the owner verified on 2026-08-20 that
 * `https://www.clarity.ms/tag/<id>` serves 200 `application/x-javascript`, so
 * the loader URL is current either way. Keeping the suffix means the new site
 * issues byte-identically the same request the live site issues today, which is
 * one fewer difference to explain if the existing Clarity project's numbers
 * move at cutover.
 */
function claritySnippet(id: string): string {
  return `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");`;
}

/** One entry per vendor. Adding the next one is adding a sibling here. */
const REGISTRY: Record<VendorProvider, VendorEntry> = {
  clarity: {
    domId: 'vr-vendor-clarity',
    idPattern: /^[a-z0-9]{6,24}(?![\s\S])/,
    snippet: claritySnippet,
  },
};

function isKnownProvider(provider: unknown): provider is VendorProvider {
  // Explicit literal comparison, not `provider in REGISTRY` — the latter walks
  // the prototype chain, so `'constructor'` and `'__proto__'` would pass.
  return provider === 'clarity';
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
): VendorScript | null {
  if (!entry || typeof entry !== 'object') return null;

  const { provider, id } = entry;
  if (!isKnownProvider(provider)) return null;
  if (typeof id !== 'string') return null;

  const vendor = REGISTRY[provider];
  if (!vendor.idPattern.test(id)) return null;

  return { domId: vendor.domId, innerHTML: vendor.snippet(id) };
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
): VendorScript[] {
  if (!Array.isArray(additional)) return [];

  const seen = new Set<string>();
  const out: VendorScript[] = [];
  for (const entry of additional) {
    const script = resolveVendorScript(entry);
    if (!script) continue;
    if (seen.has(script.domId)) continue;
    seen.add(script.domId);
    out.push(script);
  }
  return out;
}
