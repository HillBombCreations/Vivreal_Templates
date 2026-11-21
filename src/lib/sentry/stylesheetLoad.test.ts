/**
 * VIVREAL-TEMPLATES-Q (release C, fix pass 2; Justin, `decisions.md:1168`;
 * plan-release-C.md 3.10, walk D-32): a stylesheet or font that fails to load
 * is tried once more; a second failure is one handled warning naming the file
 * and the page; the stackless unhandled rejection React's stylesheet promise
 * raised is dropped, and only that one.
 *
 * Driven with a fake document whose links load or fail as each test says, and
 * the module read through its namespace, so at a base without it each row
 * fails on its own assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as stylesheetLoad from './stylesheetLoad.ts';

type Report = { file: string; page: string };
type Module = {
  installStylesheetRetry: (doc: unknown, win: unknown, report: (r: Report) => void) => void;
  dropStylesheetLoadRejection: (event: unknown, hint?: unknown) => unknown;
  STYLESHEET_LOAD_WARNING: string;
};

function mod(): Module {
  const ns = stylesheetLoad as unknown as Record<string, unknown>; // named exports, checked below
  for (const name of ['installStylesheetRetry', 'dropStylesheetLoadRejection']) assert.equal(typeof ns[name], 'function', `stylesheetLoad exports ${name}`);
  return ns as unknown as Module; // checked above
}

const ORIGIN = 'https://wavesofgrainco.com';
const CSS = `${ORIGIN}/_next/static/css/app-1a2b3c.css`;

/** A fake `<link>`: `fails` says how its load ends (`true` fails, `false` loads). */
class FakeLink {
  tagName = 'LINK';
  rel = '';
  href = '';
  sheet: unknown = null;
  attrs = new Map<string, string>();
  listeners = new Map<string, Array<() => void>>();
  inserted: FakeLink[] = [];
  readonly page: FakePage;
  constructor(page: FakePage) {
    this.page = page;
  }
  getAttribute(name: string) {
    return this.attrs.has(name) ? (this.attrs.get(name) as string) : null; // has() checked
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
    if (name === 'rel') this.rel = value;
    if (name === 'href') this.href = value;
  }
  hasAttribute(name: string) {
    return this.attrs.has(name);
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  after(node: FakeLink) {
    this.inserted.push(node);
    this.page.added.push(node);
    // The browser loads the copy: it fails or loads as the page says.
    this.page.settle(node, this.page.copiesFail);
  }
}

class FakePage {
  added: FakeLink[] = [];
  copiesFail = false;
  captureListener: ((event: { target: unknown }) => void) | null = null;
  loadListener: (() => void) | null = null;
  readyState = 'loading';
  head: FakeLink[] = [];
  doc = {
    readyState: 'loading',
    addEventListener: (type: string, listener: (event: { target: unknown }) => void, capture: boolean) => {
      if (type === 'error' && capture) this.captureListener = listener;
    },
    createElement: () => new FakeLink(this),
    querySelectorAll: () => this.head,
  };
  win = {
    location: { pathname: '/contact', origin: ORIGIN },
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'load') this.loadListener = listener;
    },
  };
  link(rel: string, href: string, as?: string): FakeLink {
    const l = new FakeLink(this);
    l.setAttribute('rel', rel);
    l.setAttribute('href', href);
    if (as) l.setAttribute('as', as);
    return l;
  }
  /** A load ending: an error goes through the document's capture listener first, then the link's own. */
  settle(link: FakeLink, fails: boolean) {
    if (!fails) {
      link.sheet = {};
      for (const l of link.listeners.get('load') ?? []) l();
      return;
    }
    this.captureListener?.({ target: link });
    for (const l of link.listeners.get('error') ?? []) l();
  }
}

function setup() {
  const page = new FakePage();
  const reports: Report[] = [];
  mod().installStylesheetRetry(page.doc, page.win, (r) => reports.push(r));
  return { page, reports };
}

test('ALLOW: one failed load then a good one draws the page and reports nothing', () => {
  const { page, reports } = setup();
  const link = page.link('stylesheet', CSS);
  page.copiesFail = false;
  page.settle(link, true);
  assert.equal(page.added.length, 1, 'one more try');
  assert.equal(page.added[0].href, CSS);
  assert.equal(page.added[0].getAttribute('data-precedence'), null, "React's bookkeeping attribute is not copied");
  assert.ok(page.added[0].sheet, 'the copy loaded');
  assert.deepEqual(reports, []);
});

test('ALLOW: a second failure reports one warning naming the file and the page path', () => {
  const { page, reports } = setup();
  page.copiesFail = true;
  page.settle(page.link('stylesheet', `${CSS}?v=1`), true);
  assert.deepEqual(reports, [{ file: '/_next/static/css/app-1a2b3c.css', page: '/contact' }], 'the file without its query, and the page path');
  const font = page.link('stylesheet', 'https://fonts.googleapis.com/css2?family=Inter');
  page.settle(font, true);
  assert.deepEqual(reports[1], { file: 'fonts.googleapis.com/css2', page: '/contact' }, 'an outside font sheet names its host');
  assert.equal(mod().STYLESHEET_LOAD_WARNING, 'A stylesheet or font failed to load twice');
});

test('ALLOW: a stylesheet that failed before the script ran is tried again at the window load', () => {
  const { page, reports } = setup();
  const failedEarly = page.link('stylesheet', CSS);
  const loaded = page.link('stylesheet', `${ORIGIN}/_next/static/css/other.css`);
  loaded.sheet = {};
  page.head = [failedEarly, loaded];
  page.loadListener?.();
  assert.deepEqual(page.added.map((l) => l.href), [CSS], 'only the one with no sheet');
  assert.deepEqual(reports, []);
});

test('REFUSE: no third attempt, and one report however often the copy fails', () => {
  const { page, reports } = setup();
  page.copiesFail = true;
  const link = page.link('stylesheet', CSS);
  page.settle(link, true);
  page.settle(link, true);
  page.settle(page.added[0], true);
  assert.equal(page.added.length, 1, 'the copy is never copied, and the original is tried once');
  assert.equal(reports.length, 1);
});

test('REFUSE: a failed image, script or other link is not retried or reported', () => {
  const { page, reports } = setup();
  const img = { tagName: 'IMG', rel: '', href: '', getAttribute: () => null };
  page.captureListener?.({ target: img });
  page.settle(page.link('icon', `${ORIGIN}/favicon.ico`), true);
  page.settle(page.link('preload', `${ORIGIN}/hero.jpg`, 'image'), true);
  assert.equal(page.added.length, 0);
  assert.deepEqual(reports, []);
  // Control: a font preload is one of ours.
  page.settle(page.link('preload', `${ORIGIN}/_next/static/media/inter.woff2`, 'font'), true);
  assert.equal(page.added.length, 1);
});

const rejection = (target: unknown) => ({
  event: { exception: { values: [{ mechanism: { type: 'auto.browser.global_handlers.onunhandledrejection' } }] } },
  hint: { originalException: { type: 'error', target } },
});

test('REFUSE: the stackless rejection a stylesheet or font load raises never reaches Sentry', () => {
  const page = new FakePage();
  for (const link of [page.link('stylesheet', CSS), page.link('preload', `${ORIGIN}/a.woff2`, 'font')]) {
    const { event, hint } = rejection(link);
    assert.equal(mod().dropStylesheetLoadRejection(event, hint), null);
  }
  // The browser SDK's own shape: the mechanism in the hint, not yet on the event.
  const bare = { exception: { values: [{}] } };
  const hint = { originalException: { type: 'error', target: page.link('stylesheet', CSS) }, mechanism: { type: 'auto.browser.global_handlers.onunhandledrejection' } };
  assert.equal(mod().dropStylesheetLoadRejection(bare, hint), null);
});

test('ALLOW: an unrelated unhandled rejection, and the warning itself, are reported as today', () => {
  const { dropStylesheetLoadRejection } = mod();
  const page = new FakePage();
  const unrelated = rejection({ tagName: 'IMG', rel: '', href: '', getAttribute: () => null });
  assert.equal(dropStylesheetLoadRejection(unrelated.event, unrelated.hint), unrelated.event);
  const thrown = { exception: { values: [{ mechanism: { type: 'onunhandledrejection' } }] } };
  assert.equal(dropStylesheetLoadRejection(thrown, { originalException: new Error('boom') }), thrown);
  const handled = { exception: { values: [{ mechanism: { type: 'generic' } }] } };
  const sheet = rejection(page.link('stylesheet', CSS));
  assert.equal(dropStylesheetLoadRejection(handled, sheet.hint), handled, 'only an unhandled rejection is dropped');
  const message = { message: 'A stylesheet or font failed to load twice' };
  assert.equal(dropStylesheetLoadRejection(message, {}), message);
});

test('the client init installs both, through the real SDK calls', () => {
  const init = fs.readFileSync(new URL('../../instrumentation-client.ts', import.meta.url), 'utf8');
  assert.match(init, /Sentry\.addEventProcessor\(dropStylesheetLoadRejection\);/);
  assert.match(init, /installStylesheetRetry\(document, window, \(\{ file, page \}\) => \{\s*Sentry\.captureMessage\(STYLESHEET_LOAD_WARNING, \{\s*level: "warning",\s*tags: \{ stylesheet_file: file, page \},/);
});
