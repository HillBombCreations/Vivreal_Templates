/**
 * A minimal browser-environment harness for `node --test`.
 *
 * WHY THIS EXISTS. Vivreal_Templates runs its unit suite as
 * `node --experimental-strip-types --test "src/(glob)/*.test.ts"`. Node's type
 * stripping does not transform JSX, so `.tsx` files cannot be imported by a
 * test at all, and the repo carries neither jsdom nor Playwright. The
 * instrumentation cluster (attribution, consent, vendor tags) is nevertheless
 * DOM behaviour, so every DOM-touching module in it is written React-free and
 * exercised here against a hand-built `window` / `document` / `localStorage`.
 *
 * It implements only what those modules touch, and it implements it FAITHFULLY
 * rather than permissively — in particular the cookie jar parses `Max-Age=0`
 * as a delete, because several tests assert that nothing was written.
 *
 * This is not a substitute for a browser. The browser-level proof of the same
 * behaviour is GATE 3 items 15-17 (fresh session / restore / withdrawal), run
 * on the deployed staging host through CloudFront.
 */

export interface FakeElement {
  tagName: string;
  id: string;
  type: string;
  async: boolean;
  src: string;
  innerHTML: string;
  textContent: string;
  parentNode: FakeNode | null;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

export interface FakeNode {
  childNodes: FakeElement[];
  appendChild(el: FakeElement): FakeElement;
  insertBefore(el: FakeElement, ref: FakeElement | null): FakeElement;
}

export interface DomHarness {
  /** Every element appended anywhere in the document, in insertion order. */
  scripts(): FakeElement[];
  /** Decoded `document.cookie` value for `name`, or null. */
  cookie(name: string): string | null;
  setUrl(pathAndQuery: string): void;
  setHostname(hostname: string): void;
  setProtocol(protocol: string): void;
  setReferrer(value: string): void;
  setGpc(value: boolean | undefined): void;
  storage: Map<string, string>;
  /** Every `gtag(...)` call recorded in order. */
  gtagCalls(): unknown[][];
  reloads(): number;
  restore(): void;
}

type Globals = typeof globalThis & {
  window?: unknown;
  document?: unknown;
  navigator?: unknown;
  localStorage?: unknown;
};

function makeElement(tagName: string): FakeElement {
  const attrs = new Map<string, string>();
  return {
    tagName: tagName.toUpperCase(),
    id: '',
    type: '',
    async: false,
    src: '',
    innerHTML: '',
    textContent: '',
    parentNode: null,
    setAttribute(name: string, value: string) {
      attrs.set(name, String(value));
    },
    getAttribute(name: string) {
      return attrs.has(name) ? (attrs.get(name) as string) : null;
    },
  };
}

/**
 * Install a fake DOM on `globalThis`. Call `restore()` in an `after` hook.
 *
 * @param opts.hostname the page host — the input every apex gate reads.
 */
export function installDom(opts?: {
  hostname?: string;
  protocol?: string;
  path?: string;
}): DomHarness {
  const g = globalThis as Globals;
  // `globalThis.navigator` is an accessor (getter-only) on Node 22, so a plain
  // assignment throws. Save the real descriptors and swap them out properly.
  const GLOBAL_KEYS = ['window', 'document', 'navigator', 'localStorage'] as const;
  const saved = new Map<string, PropertyDescriptor | undefined>(
    GLOBAL_KEYS.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  const define = (key: string, value: unknown) =>
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });

  const jar = new Map<string, string>();
  const appended: FakeElement[] = [];
  const storage = new Map<string, string>();
  const gtagCalls: unknown[][] = [];
  let reloadCount = 0;
  let referrer = '';
  let gpc: boolean | undefined;

  const location = {
    hostname: opts?.hostname ?? 'vivreal.io',
    protocol: opts?.protocol ?? 'https:',
    pathname: '/',
    search: '',
    reload() {
      reloadCount += 1;
    },
  };

  function applyUrl(pathAndQuery: string) {
    const q = pathAndQuery.indexOf('?');
    location.pathname = q === -1 ? pathAndQuery : pathAndQuery.slice(0, q);
    location.search = q === -1 ? '' : pathAndQuery.slice(q);
  }

  if (opts?.path) applyUrl(opts.path);

  function makeContainer(): FakeNode {
    const node: FakeNode = {
      childNodes: [],
      appendChild(el) {
        el.parentNode = node;
        node.childNodes.push(el);
        appended.push(el);
        return el;
      },
      insertBefore(el, ref) {
        el.parentNode = node;
        const idx = ref ? node.childNodes.indexOf(ref) : -1;
        if (idx === -1) node.childNodes.push(el);
        else node.childNodes.splice(idx, 0, el);
        appended.push(el);
        return el;
      },
    };
    return node;
  }

  const head = makeContainer();
  const body = makeContainer();
  // The Clarity snippet inserts itself before the document's first <script>,
  // so the harness always has one for `getElementsByTagName('script')[0]`.
  const anchorScript = makeElement('script');
  body.appendChild(anchorScript);
  appended.length = 0; // the anchor is scaffolding, not a tag under test

  const document = {
    get cookie(): string {
      return Array.from(jar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    },
    set cookie(raw: string) {
      const parts = raw.split(';').map((s) => s.trim());
      const pair = parts[0] ?? '';
      const attrs = parts.slice(1);
      const eq = pair.indexOf('=');
      if (eq === -1) return;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const maxAge = attrs.map((a) => /^Max-Age=(-?\d+)$/i.exec(a)).find(Boolean);
      if (maxAge && Number(maxAge[1]) <= 0) {
        jar.delete(name);
        return;
      }
      jar.set(name, value);
    },
    get referrer(): string {
      return referrer;
    },
    head,
    body,
    documentElement: {
      style: { setProperty() {} },
      setAttribute() {},
      removeAttribute() {},
    },
    createElement: (tag: string) => makeElement(tag),
    getElementById: (id: string) => appended.find((el) => el.id === id) ?? null,
    getElementsByTagName: (tag: string) =>
      [anchorScript, ...appended].filter((el) => el.tagName === tag.toUpperCase()),
    querySelector: (sel: string) => {
      const m = /^#(.+)$/.exec(sel);
      return m ? (appended.find((el) => el.id === m[1]) ?? null) : null;
    },
  };

  const localStorage = {
    getItem: (k: string) => (storage.has(k) ? (storage.get(k) as string) : null),
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
    clear: () => storage.clear(),
  };

  const navigator = {
    get globalPrivacyControl() {
      return gpc;
    },
    sendBeacon: () => true,
  };

  const windowObj = {
    location,
    localStorage,
    navigator,
    document,
    gtag: (...args: unknown[]) => void gtagCalls.push(args),
    dataLayer: [] as unknown[],
  };

  define('window', windowObj);
  define('document', document);
  define('navigator', navigator);
  define('localStorage', localStorage);

  return {
    scripts: () => appended.slice(),
    cookie: (name: string) => {
      const raw = jar.get(name);
      return raw === undefined ? null : decodeURIComponent(raw);
    },
    setUrl: applyUrl,
    setHostname: (hostname: string) => {
      location.hostname = hostname;
    },
    setProtocol: (protocol: string) => {
      location.protocol = protocol;
    },
    setReferrer: (value: string) => {
      referrer = value;
    },
    setGpc: (value: boolean | undefined) => {
      gpc = value;
    },
    storage,
    gtagCalls: () => gtagCalls.slice(),
    reloads: () => reloadCount,
    restore() {
      for (const key of GLOBAL_KEYS) {
        const descriptor = saved.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete g[key];
      }
    },
  };
}
