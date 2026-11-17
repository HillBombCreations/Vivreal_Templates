/**
 * SEC-1 F455 (vivreal-hq plan-sec-1.md, row SEC-T4): a small script policy
 * source matcher for the tests. Test support only: it answers "would a browser
 * holding this policy let this page load that script, or send to that
 * address?", so the script policy tests can assert what the policy ADMITS and
 * REFUSES rather than only which words it contains.
 *
 * WHAT IT MODELS, and nothing more:
 *   - The directive a request falls under, with the browser's fallback: a
 *     script reads `script-src-elem`, then `script-src`, then `default-src`; a
 *     fetch or beacon reads `connect-src`, then `default-src`. A policy with
 *     none of them admits ANY address, which is why a policy without
 *     `connect-src` stops no upload at all.
 *   - Scheme sources (`https:`), and host sources by scheme, host and port: a
 *     leading `*.` matches one or more labels and never the bare host; no port
 *     means the scheme's default port; `:*` is any port.
 *   - A source path ending in `/` matches as a prefix; any other path matches
 *     exactly. The query is ignored.
 *   - `'self'` as exactly the page origin passed in. Every other quoted keyword
 *     (`'unsafe-inline'`, `'unsafe-eval'`, a nonce or a hash) admits no
 *     address: an injected script tag carries none of them.
 *
 * WHAT IT DOES NOT MODEL, so it throws rather than answer wrongly:
 * `'strict-dynamic'` (the browser then ignores the host list), a bare `*`, and
 * a host source with no scheme.
 *
 * NOT MODELLED AT ALL: redirects. Once a request has redirected, the browser
 * matches only a source's host, not its path (CSP Level 3), so an allowed host
 * that redirects can still end at a path this matcher refuses. The plan names
 * that as residual 5 (plan-sec-1.md, section 5.8).
 *
 * Pure (no `next/*`), for the plain Node test runner.
 */

export type CspRequestKind = 'script' | 'connect';

/** The directives each kind of request reads, in the browser's order. */
const DIRECTIVE_FALLBACK: Readonly<Record<CspRequestKind, readonly string[]>> = Object.freeze({
  script: Object.freeze(['script-src-elem', 'script-src', 'default-src']),
  connect: Object.freeze(['connect-src', 'default-src']),
});

const DEFAULT_PORT: Readonly<Record<string, string>> = Object.freeze({ http: '80', https: '443', ws: '80', wss: '443' });

const SCHEME_SOURCE = /^([a-z][a-z0-9+.-]*):$/i;
const HOST_SOURCE = /^([a-z][a-z0-9+.-]*):\/\/((?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::(\d+|\*))?(\/[^?#]*)?$/i;

/** Directive name to its source list; the first of a repeated directive wins, as in a browser. */
export function parsePolicy(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    if (!directives.has(name)) directives.set(name, tokens.slice(1));
  }
  return directives;
}

/** CSP Level 3 "scheme-part match": a source's scheme admits itself and its secure upgrade. */
function schemeMatches(sourceScheme: string, urlScheme: string): boolean {
  if (sourceScheme === urlScheme) return true;
  if (sourceScheme === 'http') return urlScheme === 'https';
  if (sourceScheme === 'ws') return urlScheme === 'wss' || urlScheme === 'http' || urlScheme === 'https';
  if (sourceScheme === 'wss') return urlScheme === 'https';
  return false;
}

/** `*.a.com` admits `x.a.com` and `x.y.a.com`, never `a.com` (a host never starts with a dot). */
function hostMatches(sourceHost: string, urlHost: string): boolean {
  return sourceHost.startsWith('*.') ? urlHost.endsWith(sourceHost.slice(1)) : sourceHost === urlHost;
}

function portMatches(sourcePort: string | undefined, url: URL): boolean {
  // The URL parser drops a port that is its scheme's default, so '' means "the default port".
  if (sourcePort === undefined) return url.port === '';
  if (sourcePort === '*') return true;
  return (url.port || DEFAULT_PORT[url.protocol.slice(0, -1)]) === sourcePort;
}

function pathMatches(sourcePath: string | undefined, urlPath: string): boolean {
  if (!sourcePath) return true;
  return sourcePath.endsWith('/') ? urlPath.startsWith(sourcePath) : urlPath === sourcePath;
}

function sourceAdmits(source: string, url: URL, selfOrigin: string | undefined): boolean {
  const lower = source.toLowerCase();
  if (lower === "'strict-dynamic'") {
    throw new Error("cspMatch does not model 'strict-dynamic': the browser then ignores the host list");
  }
  if (lower === "'self'") return selfOrigin !== undefined && url.origin === new URL(selfOrigin).origin;
  if (source.startsWith("'")) return false;
  const scheme = SCHEME_SOURCE.exec(source);
  if (scheme) return schemeMatches(scheme[1].toLowerCase(), url.protocol.slice(0, -1));
  const host = HOST_SOURCE.exec(source);
  if (!host) throw new Error(`cspMatch does not model the source ${JSON.stringify(source)}`);
  const [, sourceScheme, sourceHost, sourcePort, sourcePath] = host;
  return (
    schemeMatches(sourceScheme.toLowerCase(), url.protocol.slice(0, -1)) &&
    hostMatches(sourceHost.toLowerCase(), url.hostname) &&
    portMatches(sourcePort, url) &&
    pathMatches(sourcePath, url.pathname)
  );
}

/**
 * Would a browser holding `policy` (a header value) let a page at `selfOrigin`
 * load this script (`kind` 'script') or send to this address (`kind`
 * 'connect')? True means admitted. Report-only and enforced read the same.
 */
export function cspAdmits(policy: string, kind: CspRequestKind, address: string, selfOrigin?: string): boolean {
  const directives = parsePolicy(policy);
  const governing = DIRECTIVE_FALLBACK[kind].find((name) => directives.has(name));
  if (governing === undefined) return true;
  const url = new URL(address);
  return directives.get(governing)!.some((source) => sourceAdmits(source, url, selfOrigin)); // `has` checked by the find above
}
