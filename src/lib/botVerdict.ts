/**
 * Edge bot verdict for the outbound `x-vivreal-bot` header (Task 14 item 2,
 * dashboard-insights-phase-3-capture/plan.md, D7).
 *
 * D7: the storefront's product read is server-to-server
 * (`src/lib/api/products/index.ts` runs under `"server-only"`), so the UA
 * VR_Client_API sees is the Amplify server's fetch agent, not the visitor's
 * browser — a UA-based filter THERE would drop 100% of real traffic. This
 * module runs at the EDGE (middleware.ts), where the inbound request still
 * carries the visitor's real UA, and is the only place in the fleet that
 * can compute a real bot signal for 3.2.
 *
 * Regex copied VERBATIM from `VR_Analytics_API/src/ingest/botFilter.js:13`
 * (cited there as a COST gate, not a security boundary — a determined
 * abuser can spoof a browser UA; this stops honest crawlers/monitors/naive
 * scripts). The two repos share no package, so this is a pinned copy, not
 * an import.
 *
 * Forward the VERDICT only ('1' | '0'), NEVER the raw user-agent string —
 * the raw UA is a fingerprinting surface and this program carries a
 * no-visitor-linkage constraint (plan.md Global Constraints).
 */
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|curl|wget|python-requests|python-urllib|headlesschrome|phantomjs|puppeteer|playwright|scrapy|facebookexternalhit|pingdom|uptimerobot|site24x7|statuscake|monitor|go-http-client|libwww-perl|httpclient|okhttp|axios\/|node-fetch/i;

export const BOT_VERDICT_HEADER = 'x-vivreal-bot';

/**
 * `'1'` when the user-agent looks like a bot/crawler/monitor, or is
 * absent/blank (a real browser always sends a UA on a same-origin
 * navigation or fetch — no UA at all is a stronger bot signal than a
 * spoofed one). `'0'` otherwise.
 */
export function computeBotVerdict(userAgent: string | null | undefined): '1' | '0' {
  if (!userAgent || userAgent.trim() === '') return '1';
  return BOT_UA_PATTERN.test(userAgent) ? '1' : '0';
}
