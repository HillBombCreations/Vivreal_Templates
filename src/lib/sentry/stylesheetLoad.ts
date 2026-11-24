/**
 * VIVREAL-TEMPLATES-Q (release C, fix pass 2; Justin, `decisions.md:1168`;
 * plan-release-C.md 3.10, walk D-32, live L-TPL-8): a page's stylesheet or
 * font that fails to load.
 *
 * What happened: one visitor on wavesofgrainco.com/contact (2026-11-21
 * 18:37:55Z) had a `<head><link>` stylesheet fail to load. React gives each
 * stylesheet it manages a promise (`link._p`, rejected by the link's
 * `onerror`) that nothing awaits, so the failure reached Sentry as a stackless
 * unhandled rejection whose reason is the link's `error` Event: one blip paged
 * like an outage, and named neither the file nor the page.
 *
 * Now:
 * - A stylesheet or font link that fails is tried once more, as a plain copy
 *   right after it (cascade order kept; no `data-precedence`, so React's own
 *   bookkeeping is untouched). A good second load draws the page styled and
 *   reports nothing.
 * - When the second load fails too, one handled warning names the file and
 *   the page path (`report`). There is no third attempt.
 * - `dropStylesheetLoadRejection`, a Sentry event processor, drops ONLY an
 *   unhandled rejection whose reason is a stylesheet or font link's load
 *   failure. Every other unhandled rejection is reported as before.
 *
 * Plain DOM interfaces, no Sentry or React import, so `node --test` drives it
 * with a fake document.
 */

export const STYLESHEET_LOAD_WARNING = 'A stylesheet or font failed to load twice';
const RETRY_ATTRIBUTE = 'data-vr-stylesheet-retry';

export interface LinkLike {
  tagName: string;
  rel: string;
  href: string;
  sheet?: unknown;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  hasAttribute(name: string): boolean;
  addEventListener(type: string, listener: () => void): void;
  after(node: LinkLike): void;
}

export interface DocumentLike {
  readyState: string;
  addEventListener(type: string, listener: (event: { target: unknown }) => void, capture: boolean): void;
  createElement(tag: 'link'): LinkLike;
  querySelectorAll(selector: string): ArrayLike<unknown>;
}

export interface WindowLike {
  location: { pathname: string; origin: string };
  addEventListener(type: string, listener: () => void): void;
}

/** A `<link>` that loads a stylesheet, or preloads a style or a font. */
export function isStylesheetOrFontLink(node: unknown): node is LinkLike {
  if (typeof node !== 'object' || node === null) return false;
  const el = node as Partial<LinkLike>;
  if (typeof el.tagName !== 'string' || el.tagName.toUpperCase() !== 'LINK') return false;
  const rels = String(el.rel ?? '').toLowerCase().split(/\s+/);
  if (rels.includes('stylesheet')) return true;
  const as = typeof el.getAttribute === 'function' ? String(el.getAttribute('as') ?? '').toLowerCase() : '';
  return rels.includes('preload') && (as === 'style' || as === 'font');
}

/** The file a report names: its path on this site, else its host and path. Never a query. */
export function fileOf(href: string, origin: string): string {
  try {
    const url = new URL(href, origin);
    return url.origin === origin ? url.pathname : `${url.host}${url.pathname}`;
  } catch {
    return '(unreadable address)';
  }
}

/**
 * Whether a SETTLED stylesheet link failed to load. By the spec a failed link
 * has no `sheet`. Chromium instead keeps an empty sheet whose `cssRules` read
 * throws, which a loaded sheet from this site never does (walk D-P6-5,
 * measured 2026-11-23 on a Templates production build: the aborted
 * `/_next/static` sheet read `sheet` object, `cssRules` throwing). A sheet
 * from another host is unreadable whether it loaded or not, so it counts as
 * failed only with no sheet: guessing would fetch every outside font sheet
 * twice on every page view.
 */
export function stylesheetFailed(link: LinkLike, origin: string): boolean {
  const { sheet } = link;
  if (sheet === null) return true;
  if (typeof sheet !== 'object') return false;
  try {
    if (new URL(link.href, origin).origin !== origin) return false;
  } catch {
    return false;
  }
  try {
    Reflect.get(sheet, 'cssRules');
    return false;
  } catch {
    return true;
  }
}

/**
 * Tries each failed stylesheet or font link once more, and calls `report` once
 * when that second load fails too. Covers links that fail after this runs (a
 * capture listener on the document) and those that failed before it ran: a
 * page's head stylesheets block rendering, so they have settled, and their
 * `error` has fired, before any client script can listen. Those are found at
 * the window's `load` by `stylesheetFailed`.
 */
export function installStylesheetRetry(
  doc: DocumentLike,
  win: WindowLike,
  report: (failed: { file: string; page: string }) => void,
): void {
  const tried = new Set<string>();
  const reported = new Set<string>();

  const retryOnce = (link: LinkLike) => {
    if (link.hasAttribute(RETRY_ATTRIBUTE) || !link.href || tried.has(link.href)) return;
    tried.add(link.href);
    const copy = doc.createElement('link');
    copy.setAttribute('rel', link.rel);
    for (const name of ['as', 'type', 'media', 'crossorigin', 'referrerpolicy']) {
      const value = link.getAttribute(name);
      if (value !== null) copy.setAttribute(name, value);
    }
    copy.setAttribute(RETRY_ATTRIBUTE, '');
    copy.addEventListener('error', () => {
      if (reported.has(link.href)) return;
      reported.add(link.href);
      report({ file: fileOf(link.href, win.location.origin), page: win.location.pathname });
    });
    copy.setAttribute('href', link.href);
    link.after(copy);
  };

  doc.addEventListener(
    'error',
    (event) => {
      if (isStylesheetOrFontLink(event.target)) retryOnce(event.target);
    },
    true,
  );

  const sweepFailedAtLoad = () => {
    const links = doc.querySelectorAll('link[rel~="stylesheet"]');
    for (let i = 0; i < links.length; i += 1) {
      const link = links[i];
      // At the window's load every head stylesheet has settled.
      if (isStylesheetOrFontLink(link) && stylesheetFailed(link, win.location.origin)) retryOnce(link);
    }
  };
  if (doc.readyState === 'complete') sweepFailedAtLoad();
  else win.addEventListener('load', sweepFailedAtLoad);
}

type SentryEventLike = { exception?: { values?: Array<{ mechanism?: { type?: string } }> } };

/** Whether an unhandled rejection's reason is a stylesheet or font link's `error` Event. */
export function isStylesheetLoadRejection(reason: unknown): boolean {
  if (typeof reason !== 'object' || reason === null) return false;
  const event = reason as { type?: unknown; target?: unknown };
  return event.type === 'error' && isStylesheetOrFontLink(event.target);
}

/**
 * Sentry event processor: drops the stackless unhandled rejection a stylesheet
 * or font load failure raises (the retry above reports a second failure as a
 * warning with its file and page). Anything else passes unchanged.
 */
export function dropStylesheetLoadRejection<E extends SentryEventLike>(
  event: E,
  hint?: { originalException?: unknown; mechanism?: { type?: string } },
): E | null {
  // The browser SDK hands the mechanism in the hint (`globalhandlers`, type
  // `auto.browser.global_handlers.onunhandledrejection`) and writes it onto the
  // event too; either one names an unhandled rejection.
  const mechanism = `${hint?.mechanism?.type ?? ''} ${event.exception?.values?.[0]?.mechanism?.type ?? ''}`;
  if (!/unhandledrejection/i.test(mechanism)) return event;
  return isStylesheetLoadRejection(hint?.originalException) ? null : event;
}
