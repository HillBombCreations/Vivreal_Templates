/**
 * marketing-measurement T2: `cta_click` with an intent on Vivreal's own sites.
 *
 * The header "Start Free" button points at `/app/login`, so the destination
 * alone would count a sign-up intent as a log-in. `ctaIntent` reads the text.
 * The listener is attached only on Vivreal's own sites: on a customer site
 * `window.gtag` is the CUSTOMER's GA4 property.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCta, ctaIntent, ctaLocation, installCtaClickTracking } from './ctaTracking.ts';

const APEX = 'https://vivreal.io';
const HELP = 'https://help.vivreal.io';

// ── classifyCta ──

test('ALLOW classifyCta: register and login links into the app', () => {
  assert.equal(classifyCta('/app/register', APEX), 'register');
  assert.equal(classifyCta('https://vivreal.io/app/register?x=1', APEX), 'register');
  assert.equal(classifyCta('/app/login', APEX), 'login');
  assert.equal(classifyCta('https://vivreal.io/app/register', HELP), 'register');
  assert.equal(classifyCta('https://vivreal.io/app/login', HELP), 'login');
});

test('REFUSE classifyCta: anything that is not the app register or login page', () => {
  for (const href of [
    '/pricing',
    '/app/dash',
    '/app/registered',
    'https://evil.example/app/register',
    'https://vivreal.io.evil.example/app/register',
    'mailto:a@b.c',
    '#top',
    '',
    'http://[::1',
  ]) {
    assert.equal(classifyCta(href, APEX), null, href);
  }
});

// ── ctaIntent ──

test('ALLOW ctaIntent: sign-up wording is a sign-up whatever the destination', () => {
  assert.equal(ctaIntent('login', 'Start Free'), 'signup');
  assert.equal(ctaIntent('login', '  start free  '), 'signup');
  assert.equal(ctaIntent('register', 'Get Started Free'), 'signup');
  assert.equal(ctaIntent('register', 'Log in'), 'signup', 'register is always a sign-up');
  assert.equal(ctaIntent('login', 'Create an account'), 'signup');
});

test('REFUSE ctaIntent: log-in wording, and near misses, stay a log-in', () => {
  assert.equal(ctaIntent('login', 'Log in'), 'login');
  assert.equal(ctaIntent('login', 'Sign in'), 'login');
  assert.equal(ctaIntent('login', 'Start Freely'), 'login', 'the match is anchored');
  assert.equal(ctaIntent('login', 'Why start free?'), 'login', 'the match is anchored');
  assert.equal(ctaIntent('login', ''), 'login');
});

// ── ctaLocation ──

function fakeElement(ancestors: string[]): Element {
  return {
    closest: (selector: string) => (ancestors.includes(selector) ? ({} as Element) : null),
  } as unknown as Element; // only `closest` is read
}

test('ctaLocation reads the nearest header or footer, else body', () => {
  assert.equal(ctaLocation(fakeElement(['header'])), 'header');
  assert.equal(ctaLocation(fakeElement(['footer'])), 'footer');
  assert.equal(ctaLocation(fakeElement([])), 'body');
});

// ── installCtaClickTracking ──

interface FakeWin {
  win: Window;
  listeners: Array<{ type: string; capture: unknown; handler: (e: unknown) => void }>;
  gtagCalls: unknown[][];
  setGtag(present: boolean): void;
}

function fakeWindow(): FakeWin {
  const listeners: FakeWin['listeners'] = [];
  const gtagCalls: unknown[][] = [];
  const obj: Record<string, unknown> = {
    location: { origin: APEX },
    document: {
      addEventListener(type: string, handler: (e: unknown) => void, capture: unknown) {
        listeners.push({ type, capture, handler });
      },
      removeEventListener(type: string, handler: (e: unknown) => void) {
        const i = listeners.findIndex((l) => l.type === type && l.handler === handler);
        if (i !== -1) listeners.splice(i, 1);
      },
    },
    gtag: (...args: unknown[]) => void gtagCalls.push(args),
  };
  return {
    win: obj as unknown as Window, // a hand-built window holding only what the module reads
    listeners,
    gtagCalls,
    setGtag(present) {
      obj.gtag = present ? (...args: unknown[]) => void gtagCalls.push(args) : undefined;
    },
  };
}

function clickOn(href: string, text: string, ancestors: string[] = []): unknown {
  const anchor = {
    getAttribute: (name: string) => (name === 'href' ? href : null),
    textContent: text,
    closest: (selector: string) => (ancestors.includes(selector) ? {} : null),
  };
  return {
    target: {
      closest: (selector: string) => (selector === 'a[href]' ? anchor : null),
    },
  };
}

test('REFUSE install: a customer site gets no listener at all', () => {
  const f = fakeWindow();
  const uninstall = installCtaClickTracking(false, f.win);
  assert.equal(f.listeners.length, 0);
  uninstall();
});

test('ALLOW install: own site, one capture-phase click listener, one gtag call with the five params', () => {
  const f = fakeWindow();
  const uninstall = installCtaClickTracking(true, f.win);
  try {
    assert.equal(f.listeners.length, 1);
    assert.equal(f.listeners[0]?.type, 'click');
    assert.equal(f.listeners[0]?.capture, true, 'capture phase, so a stopPropagation below cannot hide it');
    f.listeners[0]?.handler(clickOn('/app/login', '  Start Free ', ['header']));
    assert.deepEqual(f.gtagCalls, [
      [
        'event',
        'cta_click',
        {
          cta_destination: 'login',
          cta_intent: 'signup',
          cta_location: 'header',
          cta_text: 'Start Free',
          transport_type: 'beacon',
        },
      ],
    ]);
  } finally {
    uninstall();
  }
});

test('REFUSE click: a non-CTA link sends nothing', () => {
  const f = fakeWindow();
  const uninstall = installCtaClickTracking(true, f.win);
  try {
    f.listeners[0]?.handler(clickOn('/pricing', 'Pricing'));
    f.listeners[0]?.handler({ target: null });
    assert.deepEqual(f.gtagCalls, []);
  } finally {
    uninstall();
  }
});

test('cta_text is cut to 100 characters', () => {
  const f = fakeWindow();
  const uninstall = installCtaClickTracking(true, f.win);
  try {
    f.listeners[0]?.handler(clickOn('/app/register', 'x'.repeat(150)));
    const params = f.gtagCalls[0]?.[2] as { cta_text: string };
    assert.equal(params.cta_text.length, 100);
  } finally {
    uninstall();
  }
});

test('no gtag (visitor has not accepted): nothing sent, no throw', () => {
  const f = fakeWindow();
  f.setGtag(false);
  const uninstall = installCtaClickTracking(true, f.win);
  try {
    assert.doesNotThrow(() => f.listeners[0]?.handler(clickOn('/app/register', 'Sign up')));
    assert.deepEqual(f.gtagCalls, []);
  } finally {
    uninstall();
  }
});

test('a second install is a no-op; uninstall removes the listener', () => {
  const f = fakeWindow();
  const first = installCtaClickTracking(true, f.win);
  const second = installCtaClickTracking(true, f.win);
  assert.equal(f.listeners.length, 1, 'one listener, not two');
  second();
  assert.equal(f.listeners.length, 1, "the no-op install's uninstall removes nothing");
  first();
  assert.equal(f.listeners.length, 0);
});
