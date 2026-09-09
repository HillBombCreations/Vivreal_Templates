import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
// Imported by PATH for the reason `titleBandAdoption.test.ts` documents: the
// package barrel pulls `next/link` through NextSiteRendererProvider, which
// Node's resolver rejects outside a Next build. This layout reaches only
// `react/jsx-runtime`, `lucide-react` and the renderer's own RichText, all of
// which load standalone.
import AsideNoteLayout from '../../node_modules/@hillbombcreations/site-renderer/dist/layouts/AsideNoteLayout.js';
import type {
  ContentItem,
  ContentLayoutProps,
} from '../../node_modules/@hillbombcreations/site-renderer/dist/types/ContentItem.js';

/**
 * Renderer 1.69.0 gave `aside-note` an optional `tone`, so a docs callout can
 * finally say "this deletes your site" in a different voice from "by the way".
 * The claim that made it safe to ship to the whole fleet at once is a claim
 * about the notes that DON'T set one:
 *
 *   every note on every live site today is untoned, and an untoned note must
 *   render exactly the bytes it rendered before.
 *
 * Nothing in this repository could check that claim, which is the gap this file
 * closes. Templates is the consumer that actually ships these bytes to a
 * visitor, so this is the layer where "the fleet did not move" is worth pinning.
 *
 * The literals below are not transcribed from the new component. They were
 * rendered out of the PUBLISHED 1.68.0 package, the exact build every customer
 * site was serving before the bump, and compared byte for byte. That is what
 * makes them a record of the old behaviour rather than a restatement of the new
 * one.
 *
 * Two things keep this from being vacuous, and both matter:
 *   - a TONED control must differ, or an equality test against a component that
 *     had quietly lost tone support entirely would still pass;
 *   - the neutral bucket is asserted across every shape real data takes, since
 *     "absent" is only one of the ways a CMS row arrives without a severity.
 */

/** One note, exactly as a collection row reaches the layout. */
function note(raw: Record<string, unknown>): ContentItem[] {
  return [
    {
      id: 'note-booking',
      title: 'Works beside your booking tool',
      source: 'collection',
      raw,
      ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    } as ContentItem,
  ];
}

const BODY = { title: 'Works beside your booking tool', body: '<p>We work beside it, not against it.</p>' };

/**
 * The layout's required props. `slug` is on `ContentLayoutProps` for the layouts
 * that build detail links; this one reads neither it nor any other section-level
 * value, which is the point of the severity living on the ROW, so it is supplied
 * only to satisfy the contract and cannot influence a single byte below.
 */
function layoutProps(items: ContentItem[]): ContentLayoutProps {
  return { items, slug: 'notes' };
}

/** The `<aside>` the visitor gets, isolated from the layout's `<style>` block. */
function asideOf(items: ContentItem[]): string {
  const html = renderToStaticMarkup(AsideNoteLayout(layoutProps(items)));
  const match = /<aside\b[\s\S]*<\/aside>/.exec(html);
  // Vacuity guard: a layout that rendered nothing would otherwise let every
  // equality below compare two empty strings.
  assert.ok(match, 'AsideNoteLayout rendered no <aside>; the rest of this test would be vacuous');
  return match[0];
}

/**
 * What published 1.68.0 painted for an untoned note with an HTML body. One
 * class, no `data-tone`, no flag row.
 */
const UNTONED_HTML_BODY =
  '<aside class="vr-note">' +
  '<h3 class="vr-note-title">Works beside your booking tool</h3>' +
  '<div class="vr-rich vr-note-body"><p>We work beside it, not against it.</p></div>' +
  '</aside>';

/** The same note authored as plain text rather than CMS HTML. */
const UNTONED_PLAIN_TEXT =
  '<aside class="vr-note">' +
  '<h3 class="vr-note-title">Works beside your booking tool</h3>' +
  '<p class="vr-note-body">We work beside it, not against it.</p>' +
  '</aside>';

test('an untoned note is byte-identical to what published 1.68.0 rendered', () => {
  assert.equal(asideOf(note(BODY)), UNTONED_HTML_BODY);
});

test('an untoned note authored as plain text is byte-identical too', () => {
  assert.equal(
    asideOf(note({ title: BODY.title, description: 'We work beside it, not against it.' })),
    UNTONED_PLAIN_TEXT,
  );
});

test('the wrapper around the notes is unchanged', () => {
  const html = renderToStaticMarkup(AsideNoteLayout(layoutProps(note(BODY))));
  assert.ok(html.startsWith('<div class="vr-notes" data-aside-note="">'), `wrapper changed: ${html.slice(0, 80)}`);
});

/* ── the neutral bucket is as wide as the data is ─────────────────────────── */

/**
 * "Untoned" is not one shape. A row reaches this layout without a severity by
 * being absent, null, blank, the wrong type, or explicitly informational, and
 * `info` belongs here because the neutral panel already IS the informational
 * treatment. An unrecognised value lands here too, which is the fail-safe
 * direction: bad data can never invent an alarm.
 */
const NEUTRAL_TONES: unknown[] = [
  undefined,
  null,
  '',
  '   ',
  'info',
  'INFO',
  ' info ',
  42,
  {},
  [],
  true,
  'chartreuse',
];

for (const tone of NEUTRAL_TONES) {
  test(`neutral bucket: tone ${JSON.stringify(tone) ?? 'undefined'} renders the untoned bytes`, () => {
    assert.equal(asideOf(note({ ...BODY, tone })), UNTONED_HTML_BODY);
  });
}

test('a neutral note carries no tone class, no data-tone and no flag row', () => {
  const aside = asideOf(note(BODY));
  assert.equal(/class="vr-note"/.test(aside), true, 'the class string must stay exactly "vr-note"');
  assert.ok(!aside.includes('data-tone'), 'a neutral note must not emit data-tone');
  for (const cls of ['vr-note-tip', 'vr-note-warning', 'vr-note-danger', 'vr-note-flag']) {
    assert.ok(!aside.includes(cls), `a neutral note must never receive ${cls}`);
  }
  // Every appended stylesheet rule is scoped to one of those classes, so an
  // element that receives none of them cannot be reached by any of them. That
  // is the whole of the fleet-safety argument, and this is the half of it that
  // lives in the markup.
  assert.ok(!aside.includes('<svg'), 'a neutral note must not gain a glyph');
});

/* ── the control that proves the comparison discriminates ─────────────────── */

/**
 * Without these the block above would pass just as happily against a component
 * that had no tone support at all, which is precisely the state this test is
 * supposed to be able to tell apart from the shipped one.
 */
const TONED: string[] = ['tip', 'warning', 'danger', 'WARNING', ' warning '];

for (const tone of TONED) {
  test(`toned control: ${JSON.stringify(tone)} must NOT render the untoned bytes`, () => {
    const aside = asideOf(note({ ...BODY, tone }));
    assert.notEqual(
      aside,
      UNTONED_HTML_BODY,
      `tone ${JSON.stringify(tone)} rendered the neutral markup, so the untoned assertions prove nothing`,
    );
    assert.ok(aside.includes('data-tone="'), 'a toned note announces its severity in the markup');
  });
}

test('a toned note is a superset: same title and body, plus the severity', () => {
  // The severity is additive rather than a different rendering of the same note,
  // which is what makes "untoned is unchanged" a coherent claim in the first
  // place. The glyph is elided because a lucide path is the icon library's to
  // change, not this contract's.
  const aside = asideOf(note({ ...BODY, tone: 'warning' })).replace(/<svg[\s\S]*?<\/svg>/, '');
  assert.equal(
    aside,
    '<aside class="vr-note vr-note-warning" data-tone="warning">' +
      '<p class="vr-note-flag">Warning</p>' +
      '<h3 class="vr-note-title">Works beside your booking tool</h3>' +
      '<div class="vr-rich vr-note-body"><p>We work beside it, not against it.</p></div>' +
      '</aside>',
  );
});

test('the severity is read off the ROW, never off a section', () => {
  // One band routinely mixes severities, so two notes under one heading must be
  // able to disagree. If this ever moved to section config, this is the test
  // that would notice.
  const items = [...note({ ...BODY, tone: 'danger' }), ...note(BODY)];
  items[1] = { ...items[1], id: 'note-second' };
  const html = renderToStaticMarkup(AsideNoteLayout(layoutProps(items)));
  const asides = [...html.matchAll(/<aside\b[\s\S]*?<\/aside>/g)].map((m) => m[0]);
  assert.equal(asides.length, 2, 'expected two notes; the rest of this assertion would be vacuous');
  assert.ok(asides[0].includes('data-tone="danger"'), 'the first note keeps its severity');
  assert.ok(!asides[1].includes('data-tone'), 'the second note stays neutral beside it');
});
