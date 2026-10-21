import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIGRATION_NO_NOTES_MESSAGE,
  classifyContactForm,
  messageToForward,
  missingRequiredContactFields,
  withFormTypeMarker,
} from './contactSubmission.ts';
import { VIVREAL_HELP_SITE_ID, VIVREAL_MARKETING_SITE_ID } from './vivrealApex.ts';
import { buildContactRejectionCapture } from './api/errorCapture.ts';

test('classifyContactForm: a non-empty string siteUrl is a migration', () => {
  assert.equal(classifyContactForm({ siteUrl: 'https://example.com' }), 'migration');
});

test('classifyContactForm: anything else is a contact', () => {
  for (const customFields of [
    undefined,
    null,
    'siteUrl',
    ['https://example.com'],
    {},
    { siteUrl: '' },
    { siteUrl: '   ' },
    { siteUrl: 42 },
    { subject: 'Hello' },
  ]) {
    assert.equal(classifyContactForm(customFields), 'contact', JSON.stringify(customFields));
  }
});

test('ALLOW: a migration may leave message blank', () => {
  assert.deepEqual(missingRequiredContactFields({ name: 'A', customerEmail: 'a@b.co', message: '' }, 'migration'), []);
  assert.deepEqual(missingRequiredContactFields({ name: 'A', customerEmail: 'a@b.co' }, 'migration'), []);
});

test('REFUSE: a contact may not, and name and email are required for both', () => {
  assert.deepEqual(missingRequiredContactFields({ name: 'A', customerEmail: 'a@b.co', message: ' ' }, 'contact'), ['message']);
  assert.deepEqual(missingRequiredContactFields({ message: 'hi' }, 'contact'), ['name', 'customerEmail']);
  assert.deepEqual(missingRequiredContactFields({ name: 7, customerEmail: '', message: '' }, 'migration'), ['name', 'customerEmail']);
});

test('messageToForward keeps a real message and fills a blank one', () => {
  assert.equal(messageToForward('Notes here'), 'Notes here');
  assert.equal(messageToForward(''), MIGRATION_NO_NOTES_MESSAGE);
  assert.equal(messageToForward('  '), MIGRATION_NO_NOTES_MESSAGE);
  assert.equal(messageToForward(undefined), MIGRATION_NO_NOTES_MESSAGE);
});

test('ALLOW: Vivreal\'s own sites, marketing and help, get the marker', () => {
  assert.deepEqual(withFormTypeMarker({ siteUrl: 'x' }, 'migration', VIVREAL_MARKETING_SITE_ID), { siteUrl: 'x', formType: 'migration' });
  assert.deepEqual(withFormTypeMarker(undefined, 'contact', VIVREAL_HELP_SITE_ID), { formType: 'contact' });
});

test('REFUSE: a customer site, an unset SITE_ID and a padded or near-miss id get the payload back unchanged', () => {
  const customFields = { subject: 'Hi' };
  for (const siteId of ['customer-site-1', undefined, '', `${VIVREAL_MARKETING_SITE_ID}x`, VIVREAL_MARKETING_SITE_ID.toUpperCase()]) {
    assert.equal(withFormTypeMarker(customFields, 'contact', siteId), customFields, String(siteId));
  }
  assert.equal(withFormTypeMarker(undefined, 'contact', 'customer-site-1'), undefined);
});

test('the server value wins over a submitted formType', () => {
  assert.deepEqual(
    withFormTypeMarker({ formType: 'migration' }, 'contact', VIVREAL_MARKETING_SITE_ID),
    { formType: 'contact' },
  );
});

test('at VR_Client_API\'s 40-key cap the marker is skipped rather than overflow it; at 39 it is added', () => {
  const at40 = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, 'v']));
  assert.equal(withFormTypeMarker(at40, 'contact', VIVREAL_MARKETING_SITE_ID), at40);
  const at39 = Object.fromEntries(Array.from({ length: 39 }, (_, i) => [`k${i}`, 'v']));
  assert.equal(Object.keys(withFormTypeMarker(at39, 'contact', VIVREAL_MARKETING_SITE_ID) ?? {}).length, 40);
});

test('a non-object customFields is passed through, never spread', () => {
  const notAnObject = ['a'] as unknown as Record<string, unknown>; // the wire can carry any JSON here
  assert.equal(withFormTypeMarker(notAnObject, 'contact', VIVREAL_MARKETING_SITE_ID), notAnObject);
});

test('the rejection capture carries a held-back count as an extra, never as a tag', () => {
  const capture = buildContactRejectionCapture({
    siteId: undefined,
    formType: 'contact',
    stage: 'missing-fields',
    missingFields: ['name', 'message'],
    suppressed: 3,
  });
  assert.deepEqual(capture, {
    level: 'error',
    fingerprint: ['templates.contact.rejected'],
    tags: { siteId: 'unknown', stage: 'missing-fields', formType: 'contact', missing: 'name,message' },
    extra: { suppressedSinceLastCapture: 3 },
  });
});
