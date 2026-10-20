import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEUTRAL_ACTION_LABEL,
  resolveDetailItemSummary,
  externalActionHref,
  splitAtHero,
  withoutUnsafeHeroLink,
  type SummaryInput,
} from './itemSummary.ts';

// V7 F-D1. The generic detail sections the renderer resolves for a page with
// no `detailPage.sections` (DETAIL_SECTION_GENERIC_DEFAULT, renderer 1.88.2).
const GENERIC = ['hero', 'content', 'cta'];
const COLLECTION = '6ad6ec892d800eff033fa56d';

/** The walk's page: a standard page, a positions board, Detail pages on with no `fields`. */
function pageWith(displayAs: string, sectionConfig: Record<string, unknown> = {}) {
  return { blocks: [{ type: { kind: 'layout', dispatchId: displayAs }, config: { bindings: [{ collectionId: COLLECTION, displayAs, sectionConfig }] } }] };
}

function summarize(overrides: Partial<SummaryInput> & { raw?: Record<string, unknown>; href?: string }) {
  const { raw = {}, href, ...rest } = overrides;
  return resolveDetailItemSummary({
    page: pageWith('positions'),
    collectionId: COLLECTION,
    item: { raw, href },
    fields: undefined,
    sections: GENERIC,
    ...rest,
  });
}

const ROLE = {
  title: 'QA TEST Baker role 2026-10-20',
  location: 'Knoxville',
  type: 'Full Time',
  pay: 'Hourly ($18 to $20)',
  link: 'https://example.com/qa-test-apply-2026-10-20',
};

// ---------------------------------------------------------------- ALLOW

test('ALLOW (F-D1): a role with an apply link gets an Apply button to that URL, opening safely in a new tab', () => {
  const summary = summarize({ raw: ROLE, href: ROLE.link });
  assert.deepEqual(summary?.action, { href: ROLE.link, label: 'Apply', external: true });
});

test('ALLOW (F-D1): the role page shows the location and the type and pay line the card drew', () => {
  const summary = summarize({ raw: ROLE, href: ROLE.link });
  assert.deepEqual(summary?.facts, ['Knoxville', 'Full Time · Hourly ($18 to $20)']);
});

test('ALLOW: a product tile with only an orderUrl gets an Order button', () => {
  const summary = summarize({ page: pageWith('product-tiles'), raw: { title: 'Tour shirt', orderUrl: 'https://shop.example.com/shirt' } });
  assert.deepEqual(summary?.action, { href: 'https://shop.example.com/shirt', label: 'Order', external: true });
});

test('ALLOW: a float shelf\'s own section label names the order button, as the tile did', () => {
  const summary = summarize({
    page: pageWith('product-tiles', { tileStyle: 'float', linkLabel: 'Buy tickets' }),
    raw: { title: 'Show', link: 'https://tickets.example.com' },
  });
  assert.equal(summary?.action?.label, 'Buy tickets');
});

test('ALLOW: the item\'s own linkLabel wins over the layout wording', () => {
  const summary = summarize({ raw: { ...ROLE, linkLabel: 'Apply on Indeed' } });
  assert.equal(summary?.action?.label, 'Apply on Indeed');
});

test('ALLOW: an item\'s ctaLabel names a link the hero does not draw (url, not link)', () => {
  const summary = summarize({ page: pageWith('cards'), raw: { title: 'Partner', url: 'https://partner.example.com', ctaLabel: 'Meet them' } });
  assert.equal(summary?.action?.label, 'Meet them');
  assert.equal(summary?.action?.href, 'https://partner.example.com');
});

test('ALLOW: a layout that names no action gets the neutral label', () => {
  const summary = summarize({ page: pageWith('cards'), raw: { title: 'Partner', link: 'https://partner.example.com' } });
  assert.equal(summary?.action?.label, NEUTRAL_ACTION_LABEL);
});

test('ALLOW: mailto and tel are kept and open in place', () => {
  for (const link of ['mailto:jobs@example.com', 'tel:+15555550100']) {
    const action = summarize({ raw: { ...ROLE, link } })?.action;
    assert.equal(action?.href, link, link);
    assert.equal(action?.external, false, link);
  }
});

test('ALLOW: an explicit fields.show that lists link and location keeps both', () => {
  const summary = summarize({ raw: ROLE, fields: { show: ['location', 'link'] } });
  assert.equal(summary?.action?.label, 'Apply');
  assert.deepEqual(summary?.facts, ['Knoxville']);
});

test('ALLOW: the link field order matches the layouts (link, then url, then href, then orderUrl)', () => {
  const action = summarize({ raw: { url: 'https://b.example.com', orderUrl: 'https://c.example.com', link: 'https://a.example.com' } })?.action;
  assert.equal(action?.href, 'https://a.example.com');
  const skipPlaceholder = summarize({ raw: { link: '#', url: 'https://b.example.com' } })?.action;
  assert.equal(skipPlaceholder?.href, 'https://b.example.com');
});

// ---------------------------------------------------------------- REFUSE

test('REFUSE (F-D1): an item with no link gets no button', () => {
  const summary = summarize({ raw: { title: 'Baker', location: 'Knoxville' } });
  assert.equal(summary?.action, undefined);
  assert.deepEqual(summary?.facts, ['Knoxville']);
});

test('REFUSE: an item with nothing to show leaves the page as it was (undefined)', () => {
  assert.equal(summarize({ page: pageWith('cards'), raw: { title: 'Plain' } }), undefined);
});

test('REFUSE: an explicit fields.show without link draws no button, and only the facts it names', () => {
  const summary = summarize({ raw: ROLE, href: ROLE.link, fields: { show: ['description', 'location'] } });
  assert.equal(summary?.action, undefined);
  assert.deepEqual(summary?.facts, ['Knoxville']);
});

test('REFUSE: an explicit empty fields.show draws nothing', () => {
  assert.equal(summarize({ raw: ROLE, href: ROLE.link, fields: { show: [] } }), undefined);
});

test('REFUSE: fields.hide removes the button and the hidden fact', () => {
  const summary = summarize({ raw: ROLE, fields: { hide: ['link', 'pay'] } });
  assert.equal(summary?.action, undefined);
  assert.deepEqual(summary?.facts, ['Knoxville', 'Full Time']);
});

test('REFUSE: a javascript:, data: or vbscript: link is never drawn, however it is disguised', () => {
  const hostile = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    `java${String.fromCharCode(9)}script:alert(1)`,
    `${String.fromCharCode(0)}javascript:alert(1)`,
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
  ];
  for (const link of hostile) {
    assert.equal(externalActionHref(link), undefined, JSON.stringify(link));
    assert.equal(summarize({ raw: { ...ROLE, link } })?.action, undefined, JSON.stringify(link));
  }
});

test('REFUSE: no relative value becomes the action, same-site or not', () => {
  for (const link of ['/careers/apply', '//evil.example.com/apply', `/${String.fromCharCode(92)}evil.example.com`,`/${String.fromCharCode(9)}/evil.example.com`, 'example.com/apply', '../apply', '#']) {
    assert.equal(summarize({ raw: { ...ROLE, link } })?.action, undefined, JSON.stringify(link));
  }
});

test('REFUSE (census): a help article whose link is its own address gets no button', () => {
  // The live shape: Vivreal Help's articles on an alpha-index, Detail pages on by default.
  const summary = summarize({ page: pageWith('alpha-index'), raw: { title: 'Connect Facebook', link: '/connections/facebook' }, href: '/connections/facebook' });
  assert.equal(summary, undefined);
});

test('REFUSE: no second button when the renderer hero already draws link + ctaLabel', () => {
  const summary = summarize({ raw: { ...ROLE, ctaLabel: 'Apply now' } });
  assert.equal(summary?.action, undefined);
  assert.deepEqual(summary?.facts, ['Knoxville', 'Full Time · Hourly ($18 to $20)']);
});

test('REFUSE: an unsafe raw.link is removed from the item the hero draws, and a safe one is left alone', () => {
  const hostile = { id: 'x', raw: { link: 'javascript:alert(1)', ctaLabel: 'Go' } };
  assert.equal(withoutUnsafeHeroLink(hostile).raw?.link, undefined);
  assert.equal(hostile.raw.link, 'javascript:alert(1)', 'the original item is not mutated');
  const safe = { id: 'y', raw: { link: 'https://example.com', ctaLabel: 'Go' } };
  assert.equal(withoutUnsafeHeroLink(safe), safe);
  const internal = { id: 'z', raw: { link: '/book', ctaLabel: 'Book' } };
  assert.equal(withoutUnsafeHeroLink(internal), internal, 'a relative hero link is a legitimate internal link');
});

// ---------------------------------------------------------------- split

test('splitAtHero: the summary sits right after the hero, and the hero-inline sections leave the second half', () => {
  assert.deepEqual(splitAtHero(['hero', 'meta', 'content', 'cta']), { before: ['hero'], after: ['content', 'cta'] });
  assert.deepEqual(splitAtHero(['content', 'cta']), { before: [], after: ['content', 'cta'] });
  assert.deepEqual(splitAtHero(['hero']), { before: ['hero'], after: [] });
});
