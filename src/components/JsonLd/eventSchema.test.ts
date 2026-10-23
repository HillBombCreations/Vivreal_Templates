import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShowEventJsonLd, parseShowTime, showStartDate, type ShowEventInput } from './eventSchema.ts';

// Discovery batch 3.1 (design-discovery-batch-2026-10-22.md section 6, rows
// "Event date" and "Event place"). Every ALLOW has its REFUSE.

const CHICAGO = 'America/Chicago';
const ORG = 'https://comedycollectivechi.com/#organization';

function show(overrides: Partial<ShowEventInput> = {}): ShowEventInput {
  return {
    title: 'Friday Night Standup',
    url: 'https://comedycollectivechi.com/shows/abc123',
    date: '2026-07-24T05:00:00.000Z',
    time: '7:00 pm',
    location: 'Uptown Taproom: 1265 W Wilson Ave',
    timezone: CHICAGO,
    organizationId: ORG,
    ...overrides,
  };
}

function schemaOf(input: ShowEventInput): Record<string, unknown> {
  const result = buildShowEventJsonLd(input);
  assert.ok(result.schema, `expected an Event node, got skipped=${String(result.skipped)}`);
  return result.schema;
}

// ---------------------------------------------------------------------------
// Event date
// ---------------------------------------------------------------------------

test('ALLOW: 2026-07-24T05:00:00.000Z + "7:00 pm" in America/Chicago is 2026-07-24T19:00:00-05:00', () => {
  assert.equal(schemaOf(show()).startDate, '2026-07-24T19:00:00-05:00');
});

test('ALLOW: a November show carries the standard-time offset -06:00 (DST)', () => {
  assert.equal(
    schemaOf(show({ date: '2026-11-13T06:00:00.000Z', time: '8pm' })).startDate,
    '2026-11-13T20:00:00-06:00',
  );
});

test('ALLOW: every way owners type a time parses', () => {
  assert.equal(parseShowTime('7:00 pm'), 19 * 60);
  assert.equal(parseShowTime('7pm'), 19 * 60);
  assert.equal(parseShowTime('7:30PM'), 19 * 60 + 30);
  assert.equal(parseShowTime('7 p.m.'), 19 * 60);
  assert.equal(parseShowTime('19:00'), 19 * 60);
  assert.equal(parseShowTime('12:15 am'), 15);
  assert.equal(parseShowTime('12 pm'), 12 * 60);
});

test('REFUSE: an unparseable time gives the date alone, never a concatenation', () => {
  for (const time of ['Doors at seven', '25:00', '13pm', '7:75 pm', '']) {
    assert.equal(schemaOf(show({ time })).startDate, '2026-07-24', JSON.stringify(time));
  }
  assert.equal(schemaOf(show({ time: undefined })).startDate, '2026-07-24');
});

test('REFUSE: no usable time zone gives the date alone (an hour is never guessed)', () => {
  assert.equal(schemaOf(show({ timezone: undefined })).startDate, '2026-07-24');
  assert.equal(schemaOf(show({ timezone: 'Not/AZone' })).startDate, '2026-07-24');
});

test('REFUSE: no date (or an unreadable one) gives no Event node', () => {
  for (const date of [undefined, '', 'next Friday']) {
    const result = buildShowEventJsonLd(show({ date }));
    assert.equal(result.schema, null, JSON.stringify(date));
    assert.equal(result.skipped, 'no_date');
  }
});

test('REFUSE: every emitted startDate parses as ISO 8601 (property test over a show list)', () => {
  // The shapes the fleet stores: ISO timestamps at local midnight, bare dates,
  // and the times owners actually type, across both DST halves and zones.
  const dates = ['2026-07-24T05:00:00.000Z', '2026-11-13T06:00:00.000Z', '2026-03-08', '2026-12-31T23:30:00.000Z'];
  const times = ['7:00 pm', '7pm', '7:30PM', '19:00', '2am', 'TBA', undefined];
  const zones = [CHICAGO, 'America/New_York', 'Europe/London', 'Asia/Kolkata', undefined];
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
  let checked = 0;
  for (const date of dates) {
    for (const time of times) {
      for (const timezone of zones) {
        const startDate = showStartDate(date, time, timezone);
        assert.ok(startDate, `${date} ${String(time)} ${String(timezone)} produced no date`);
        assert.ok(isoDateOnly.test(startDate) || isoDateTime.test(startDate), startDate);
        assert.ok(Number.isFinite(Date.parse(startDate)), `${startDate} does not parse`);
        assert.ok(!startDate.includes('ZT'), `${startDate} is the old concatenation`);
        checked += 1;
      }
    }
  }
  assert.equal(checked, dates.length * times.length * zones.length, 'sanity: the property ran over every case');
});

// ---------------------------------------------------------------------------
// Event place
// ---------------------------------------------------------------------------

test('ALLOW: "Uptown Taproom: 1265 W Wilson Ave" gives a Place with a PostalAddress street, no borrowed city', () => {
  assert.deepEqual(schemaOf(show()).location, {
    '@type': 'Place',
    name: 'Uptown Taproom',
    address: { '@type': 'PostalAddress', streetAddress: '1265 W Wilson Ave' },
  });
});

test('ALLOW: the show\'s own address field wins, named by its venue text', () => {
  assert.deepEqual(schemaOf(show({ location: 'The Annoyance', address: '851 W Belmont Ave' })).location, {
    '@type': 'Place',
    name: 'The Annoyance',
    address: { '@type': 'PostalAddress', streetAddress: '851 W Belmont Ave' },
  });
});

test('ALLOW: no location text on a business with a street address uses the business address', () => {
  const location = schemaOf(
    show({
      location: undefined,
      business: { name: 'Hop Haus', address: { street1: '10 Main St', city: 'Knoxville', state: 'TN', zip: '37902' } },
    }),
  ).location as Record<string, unknown>;
  assert.equal(location.name, 'Hop Haus');
  assert.deepEqual(location.address, {
    '@type': 'PostalAddress',
    streetAddress: '10 Main St',
    addressLocality: 'Knoxville',
    addressRegion: 'TN',
    postalCode: '37902',
  });
});

test('ALLOW: an online show is a VirtualLocation at its ticket link, attendance online', () => {
  const schema = schemaOf(show({ location: 'Online (Zoom)', ticketsUrl: 'https://tix.example.com/e/1' }));
  assert.deepEqual(schema.location, { '@type': 'VirtualLocation', url: 'https://tix.example.com/e/1' });
  assert.equal(schema.eventAttendanceMode, 'https://schema.org/OnlineEventAttendanceMode');
});

test('REFUSE: "Uptown Taproom" alone on a non-local site gives no Event node and the no_address skip', () => {
  const result = buildShowEventJsonLd(show({ location: 'Uptown Taproom' }));
  assert.equal(result.schema, null);
  assert.equal(result.skipped, 'no_address');
});

test('REFUSE: venue text alone is still skipped on a LOCAL site (its address is not the venue\'s)', () => {
  const result = buildShowEventJsonLd(
    show({ location: 'Uptown Taproom', business: { name: 'Hop Haus', address: { street1: '10 Main St' } } }),
  );
  assert.equal(result.skipped, 'no_address');
});

test('REFUSE: a colon followed by words is not a street ("Chicago: Uptown")', () => {
  assert.equal(buildShowEventJsonLd(show({ location: 'Chicago: Uptown Taproom' })).skipped, 'no_address');
});

// ---------------------------------------------------------------------------
// The rest of the node
// ---------------------------------------------------------------------------

test('ALLOW: status, offline attendance, organizer by @id and the ticket offer', () => {
  const schema = schemaOf(show({ ticketsUrl: 'https://tix.example.com/e/1' }));
  assert.equal(schema['@type'], 'Event');
  assert.equal(schema.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(schema.eventAttendanceMode, 'https://schema.org/OfflineEventAttendanceMode');
  assert.deepEqual(schema.organizer, { '@id': ORG });
  assert.deepEqual(schema.offers, { '@type': 'Offer', url: 'https://tix.example.com/e/1' });
});

test('REFUSE: no site origin means no organizer reference, and a non-web ticket link is no offer', () => {
  const schema = schemaOf(show({ organizationId: undefined, ticketsUrl: 'javascript:alert(1)' }));
  assert.equal(schema.organizer, undefined);
  assert.equal(schema.offers, undefined);
});

test('SOURCE PIN: the show route logs jsonld.event.skipped with the reason when no Event is emitted', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../../app/[slug]/[itemId]/page.tsx', import.meta.url), 'utf8');
  const start = page.indexOf('buildShowEventJsonLd({');
  assert.ok(start > 0, 'sanity: the show arm was not found, this pin read nothing');
  const arm = page.slice(start, page.indexOf('return (', start));
  assert.ok(arm.includes('"jsonld.event.skipped"'), 'the skip is logged');
  assert.ok(arm.includes('reason: showEvent.skipped'), 'with its reason');
  assert.ok(!page.includes('`${show.date}T${show.time}`'), 'the old concatenation is gone');
});
