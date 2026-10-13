import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptsHtml, mcpGetAnswer, CONNECT_YOUR_AI_PATH } from './mcpBrowserGet.ts';
import { VIVREAL_MARKETING_SITE_ID } from './domains/publicSearch.ts';

const BROWSER_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const CUSTOMER_SITE_ID = '6aaaaaaaaaaaaaaaaaaaaaaa';

test('ALLOW: a browser on vivreal.io is sent to the connect page with a 307 and a relative Location', () => {
  const answer = mcpGetAnswer(BROWSER_ACCEPT, VIVREAL_MARKETING_SITE_ID);
  assert.equal(answer.status, 307);
  assert.deepEqual(answer.headers, { Location: CONNECT_YOUR_AI_PATH });
  assert.ok(CONNECT_YOUR_AI_PATH.startsWith('/') && !CONNECT_YOUR_AI_PATH.startsWith('//'));
});

test('REFUSE: a customer site answers 405 to a browser, never a redirect to a page it does not have', () => {
  const answer = mcpGetAnswer(BROWSER_ACCEPT, CUSTOMER_SITE_ID);
  assert.equal(answer.status, 405);
  assert.deepEqual(answer.headers, { Allow: 'POST, OPTIONS' });
});

test('REFUSE: a non-browser GET on vivreal.io (an MCP client probing for a stream) keeps the 405', () => {
  for (const accept of ['text/event-stream', 'application/json', '*/*', '', null, undefined]) {
    assert.equal(mcpGetAnswer(accept, VIVREAL_MARKETING_SITE_ID).status, 405, String(accept));
  }
});

test('REFUSE: an unset or padded site id fails closed to 405', () => {
  for (const siteId of [undefined, null, '', '   ', `${VIVREAL_MARKETING_SITE_ID}x`]) {
    assert.equal(mcpGetAnswer(BROWSER_ACCEPT, siteId).status, 405, String(siteId));
  }
});

test('acceptsHtml reads media ranges and honours q=0', () => {
  assert.equal(acceptsHtml('TEXT/HTML'), true);
  assert.equal(acceptsHtml('application/json, text/html;q=0.5'), true);
  assert.equal(acceptsHtml('text/html;q=0'), false);
  assert.equal(acceptsHtml('text/htmlx'), false);
});
