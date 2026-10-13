/**
 * What a GET on `/mcp` answers (v5 item 2, MCP sign-in on our own pages).
 *
 * `/mcp` is a JSON-RPC endpoint and takes POST only. A person who pastes
 * `vivreal.io/mcp` into a browser (the address an AI app is told to connect
 * to) used to get a bare 405 with nothing to read. On the Vivreal marketing
 * site a browser now goes to `/connect-your-ai`, the page that explains how
 * to connect. Everything else keeps the 405:
 *   - any customer site, whatever it asks for (a bakery's `/mcp` is that
 *     shop's own tool endpoint and has no connect page);
 *   - any non-browser GET on vivreal.io (an MCP client probing for a
 *     server-sent stream must get the protocol's 405, not an HTML page).
 *
 * The Location is RELATIVE on purpose: behind Amplify `request.url` names the
 * internal localhost origin, so an absolute URL built from it would send the
 * browser nowhere (memory amplify-request-url-is-localhost).
 *
 * Pure and edge-safe (the marketing gate module imports nothing), so the
 * route stays a thin call site and the decision runs under `node --test`.
 */
import { servesPublicDomainSearch } from './domains/publicSearch.ts';

export const CONNECT_YOUR_AI_PATH = '/connect-your-ai';

/** Methods `/mcp` serves, for the 405's `Allow` header. */
export const MCP_ALLOWED_METHODS = 'POST, OPTIONS';

export type McpGetAnswer =
  | { status: 307; headers: { Location: string } }
  | { status: 405; headers: { Allow: string } };

/**
 * True when the Accept header asks for an HTML page. A media range with
 * `q=0` is an explicit refusal and does not count; `*\/*` alone does not
 * count either, since every HTTP client sends it.
 */
export function acceptsHtml(accept: string | null | undefined): boolean {
  if (typeof accept !== 'string' || !accept) return false;
  return accept.split(',').some((range) => {
    const [type, ...params] = range.split(';').map((part) => part.trim().toLowerCase());
    if (type !== 'text/html') return false;
    const q = params.find((p) => p.startsWith('q='));
    return q === undefined || Number(q.slice(2)) > 0;
  });
}

export function mcpGetAnswer(accept: string | null | undefined, siteId: string | null | undefined): McpGetAnswer {
  if (servesPublicDomainSearch(siteId) && acceptsHtml(accept)) {
    return { status: 307, headers: { Location: CONNECT_YOUR_AI_PATH } };
  }
  return { status: 405, headers: { Allow: MCP_ALLOWED_METHODS } };
}
