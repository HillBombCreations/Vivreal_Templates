import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEUTRAL_ACTION_LABEL,
  externalActionHref,
  resolveDetailItemSummary,
  splitAtHero,
  withoutUnsafeHeroLink,
  type SummaryInput,
} from './itemSummary.ts';
import type { LinkPage } from './linkedItems.ts';
import { inkOnAccentIfFailsAA } from '../theme/readableAccent.ts';

// V7 F-D1. The generic detail sections the renderer resolves for a page with
// no `detailPage.sections` (DETAIL_SECTION_GENERIC_DEFAULT, renderer 1.88.2).
const GENERIC = ['hero', 'content', 'cta'];
const COLLECTION = '6ad6ec892d800eff033fa56d';
const TAB = String.fromCharCode(9);
const BACKSLASH = String.fromCharCode(92);

/** The walk's page: a standard page, one layout on the collection, Detail pages on with no `fields`. */
function pageWith(displayAs: string, sectionConfig: Record<string, unknown> = {}): LinkPage {
  return {
    slug: 'qa-test-careers-2026-10-20',
    format: 'standard',
    detailPage: { enabled: true, itemCollectionId: COLLECTION },
    blocks: [{ type: { kind: 'layout', dispatchId: displayAs }, config: { bindings: [{ collectionId: COLLECTION, displayAs, sectionConfig }] } }],
  };
}

type Overrides = Partial<SummaryInput> & { raw?: Record<string, unknown>; href?: string; title?: string };

function summarize(overrides: Overrides) {
  const { raw = {}, href, title, ...rest } = overrides;
  return resolveDetailItemSummary({
    page: pageWith('positions'),
    pages: [],
    collectionId: COLLECTION,
    item: { raw, href, title },
    format: 'standard',
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
  const action = summarize({ raw: ROLE, href: ROLE.link, title: ROLE.title })?.action;
  assert.equal(action?.href, ROLE.link);
  assert.equal(action?.label, 'Apply');
  assert.equal(action?.external, true);
});

test('ALLOW (F-D1 review C5c): the button is named for the role it applies to, and says it opens a new tab', () => {
  const action = summarize({ raw: ROLE, title: ROLE.title })?.action;
  assert.equal(action?.ariaLabel, 'Apply: QA TEST Baker role 2026-10-20 (opens in a new tab)');
  const mail = summarize({ raw: { ...ROLE, link: 'mailto:jobs@example.com' }, title: 'Baker' })?.action;
  assert.equal(mail?.ariaLabel, 'Apply: Baker', 'mailto opens in place, so no new-tab words');
});

test('ALLOW (F-D1): the role page shows the location and the type and pay line the card drew', () => {
  assert.deepEqual(summarize({ raw: ROLE, href: ROLE.link })?.facts, ['Knoxville', 'Full Time · Hourly ($18 to $20)']);
});

test('ALLOW: a product tile with only an orderUrl gets an Order button', () => {
  const action = summarize({ page: pageWith('product-tiles'), raw: { title: 'Tour shirt', orderUrl: 'https://shop.example.com/shirt' } })?.action;
  assert.equal(action?.href, 'https://shop.example.com/shirt');
  assert.equal(action?.label, 'Order');
});

test('ALLOW: a float shelf\'s own section label names the order button, as the tile did', () => {
  const summary = summarize({
    page: pageWith('product-tiles', { tileStyle: 'float', linkLabel: 'Buy tickets' }),
    raw: { title: 'Show', link: 'https://tickets.example.com' },
  });
  assert.equal(summary?.action?.label, 'Buy tickets');
});

test('ALLOW: the item\'s own linkLabel wins over the layout wording', () => {
  assert.equal(summarize({ raw: { ...ROLE, linkLabel: 'Apply on Indeed' } })?.action?.label, 'Apply on Indeed');
});

test('ALLOW: an item\'s ctaLabel names a link the hero does not draw (url, not link)', () => {
  const action = summarize({ page: pageWith('cards'), raw: { title: 'Partner', url: 'https://partner.example.com', ctaLabel: 'Meet them' } })?.action;
  assert.equal(action?.label, 'Meet them');
  assert.equal(action?.href, 'https://partner.example.com');
});

test('ALLOW: a layout that names no action gets the neutral label', () => {
  assert.equal(summarize({ page: pageWith('cards'), raw: { title: 'Partner', link: 'https://partner.example.com' } })?.action?.label, NEUTRAL_ACTION_LABEL);
});

test('ALLOW: mailto and tel are kept and open in place', () => {
  for (const link of ['mailto:jobs@example.com', 'tel:+15555550100']) {
    const action = summarize({ raw: { ...ROLE, link } })?.action;
    assert.equal(action?.href, link, link);
    assert.equal(action?.external, false, link);
  }
});

test('ALLOW (F-D1 review C5a): an http(s) link written with a stray control character opens in a new tab like any other', () => {
  const link = `ht${TAB}tps://example.com/apply`;
  const action = summarize({ raw: { ...ROLE, link } })?.action;
  assert.equal(action?.href, link, 'the browser navigates it as https, so it is kept');
  assert.equal(action?.external, true);
});

test('ALLOW: the link field order matches the layouts (link, then url, then href, then orderUrl)', () => {
  const action = summarize({ raw: { url: 'https://b.example.com', orderUrl: 'https://c.example.com', link: 'https://a.example.com' } })?.action;
  assert.equal(action?.href, 'https://a.example.com');
  const skipPlaceholder = summarize({ raw: { link: '#', url: 'https://b.example.com' } })?.action;
  assert.equal(skipPlaceholder?.href, 'https://b.example.com');
});

// fields.show is ADDITIVE, as the renderer reads it (review C2). This replaces
// the first pass's "an explicit show without link draws no button".
test('ALLOW (F-D1 review C2): an explicit fields.show adds, it never removes the action or a card fact', () => {
  const summary = summarize({ raw: ROLE, fields: { show: ['description', 'location'] } });
  assert.equal(summary?.action?.label, 'Apply');
  assert.deepEqual(summary?.facts, ['Knoxville', 'Full Time · Hourly ($18 to $20)']);
  const empty = summarize({ raw: ROLE, fields: { show: [] } });
  assert.equal(empty?.action?.label, 'Apply');
});

test('ALLOW (F-D1 review C2): fields.show adds a known fact the card did not draw', () => {
  const summary = summarize({ page: pageWith('cards'), raw: { title: 'Studio', location: 'Denver' }, fields: { show: ['location', 'duration'] } });
  assert.deepEqual(summary?.facts, ['Denver'], 'location added; an unknown key adds nothing');
});

test('ALLOW (F-D1 review C4): a positions board on another page keeps its wording and facts on the page that serves the role', () => {
  // The serving page draws the collection with no worded layout of its own.
  const careers: LinkPage = { slug: 'careers', format: 'standard', detailPage: { enabled: true, itemCollectionId: COLLECTION }, blocks: [] };
  const home: LinkPage = {
    slug: 'home',
    format: 'home',
    blocks: [{ type: { kind: 'layout', dispatchId: 'positions' }, config: { bindings: [{ collectionId: COLLECTION, displayAs: 'positions' }] } }],
  };
  const summary = summarize({ page: careers, pages: [careers, home], raw: ROLE });
  assert.equal(summary?.action?.label, 'Apply');
  assert.deepEqual(summary?.facts, ['Knoxville', 'Full Time · Hourly ($18 to $20)']);
});

test('ALLOW (F-D1 review C3): a product page draws the button even when the item has a ctaLabel (the product hero never reads raw.link)', () => {
  const summary = summarize({ page: pageWith('product-tiles'), format: 'products', raw: { title: 'Cake', link: 'https://order.example.com', ctaLabel: 'Order now' } });
  assert.equal(summary?.action?.label, 'Order now');
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

test('REFUSE: fields.hide removes the button and the hidden fact (the renderer\'s opt-out)', () => {
  for (const key of ['link', 'url', 'orderUrl']) {
    const summary = summarize({ raw: ROLE, fields: { hide: [key, 'pay'] } });
    assert.equal(summary?.action, undefined, key);
    assert.deepEqual(summary?.facts, ['Knoxville', 'Full Time'], key);
  }
});

test('REFUSE (F-D1 review C4): a card that opts out of detail links is not the source', () => {
  const careers: LinkPage = {
    slug: 'careers',
    format: 'standard',
    detailPage: { enabled: true, itemCollectionId: COLLECTION },
    blocks: [{ type: { kind: 'layout' }, config: { bindings: [{ collectionId: COLLECTION, displayAs: 'positions', sectionConfig: { detailEligible: false } }] } }],
  };
  assert.equal(summarize({ page: careers, raw: ROLE })?.action?.label, NEUTRAL_ACTION_LABEL);
});

test('REFUSE: a javascript:, data: or vbscript: link is never drawn, however it is disguised', () => {
  const hostile = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    `java${TAB}script:alert(1)`,
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
  for (const link of ['/careers/apply', '//evil.example.com/apply', `/${BACKSLASH}evil.example.com`, `/${TAB}/evil.example.com`, 'example.com/apply', '../apply', '#']) {
    assert.equal(summarize({ raw: { ...ROLE, link } })?.action, undefined, JSON.stringify(link));
  }
});

test('REFUSE (census): a help article whose link is its own address gets no button', () => {
  // The live shape: Vivreal Help's articles on an alpha-index, Detail pages on by default.
  const summary = summarize({ page: pageWith('alpha-index'), raw: { title: 'Connect Facebook', link: '/connections/facebook' }, href: '/connections/facebook' });
  assert.equal(summary, undefined);
});

test('REFUSE: no second button when the generic hero already draws link + ctaLabel', () => {
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

// ---------------------------------------------------------------- ink (review C5b)

test('ink: the hero\'s white stays on an accent it passes AA on', () => {
  assert.equal(inkOnAccentIfFailsAA('#1a1a2e', undefined), undefined);
  assert.equal(inkOnAccentIfFailsAA('#b33', '#ffffff'), undefined);
});

test('ink: a light accent that fails AA with white ink gets ink that passes', () => {
  assert.equal(inkOnAccentIfFailsAA('#ffe066', undefined), '#111111');
  assert.equal(inkOnAccentIfFailsAA('#ffe066', '#fafafa'), '#111111');
});

test('ink: nothing measurable, nothing changed', () => {
  assert.equal(inkOnAccentIfFailsAA('var(--primary)', undefined), undefined);
  assert.equal(inkOnAccentIfFailsAA(undefined, undefined), undefined);
  assert.equal(inkOnAccentIfFailsAA('#ffe066', 'var(--x)'), undefined);
});

// ---------------------------------------------------------------- split

test('splitAtHero: the summary sits right after the hero, and the hero-inline sections leave the second half', () => {
  assert.deepEqual(splitAtHero(['hero', 'meta', 'content', 'cta']), { before: ['hero'], after: ['content', 'cta'] });
  assert.deepEqual(splitAtHero(['content', 'cta']), { before: [], after: ['content', 'cta'] });
  assert.deepEqual(splitAtHero(['hero']), { before: ['hero'], after: [] });
});
