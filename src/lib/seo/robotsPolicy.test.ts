import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MetadataRoute } from 'next';
import type { SiteData } from '@/types/SiteData';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`
// (see package.json "test"), which needs a resolvable specifier.
import { buildRobotsPolicy } from './robotsPolicy.ts';

// The demo gate and the `Sitemap:` directive are pinned in demoSafety.test.ts
// and originConsistency.test.ts. This file pins the RULES of the live policy:
// which paths the wildcard agent is kept off, and which agent classes are let
// onto them regardless.
//
// #123 moved llms.txt from `/.well-known/llms.txt` (now a 301) to `/llms.txt`.
// v5 (search R4, seo-visibility gap 24) then decided the file itself is
// allowed: it was served with a 200 while the wildcard rule disallowed it.
// The retired path stays disallowed, so the file is read at its one address.

const LIVE_SITE = {
  lifecycleState: 'live' as const,
  domainInformation: { live_url: 'https://classichousephx.vivreal.io' },
} as SiteData;

type RobotsRule = {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

const toList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

function liveRules(): RobotsRule[] {
  const { rules } = buildRobotsPolicy(LIVE_SITE) as MetadataRoute.Robots;
  return Array.isArray(rules) ? rules : [rules];
}

function ruleFor(userAgent: string): RobotsRule {
  const matches = liveRules().filter((rule) => toList(rule.userAgent).includes(userAgent));
  assert.equal(matches.length, 1, `exactly one rule for ${userAgent}`);
  return matches[0];
}

// Per RFC 9309 section 2.2.1 a crawler obeys only the most specific group
// that names it, so these agents never see the wildcard list at all. Their
// own rules must therefore keep `/llms.txt` reachable on their own.
const LIVE_ACTION_AGENTS = ['ChatGPT-User', 'OAI-SearchBot', 'PerplexityBot', 'Claude-User', 'Claude-Web'];
const TRAINING_CRAWLERS = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot', 'Applebot-Extended', 'meta-externalagent'];

// Owner decision 2026-10-22: Google-Extended also gates Gemini app and Vertex
// grounding, so it is allowed like a normal crawler. Having NO group of its
// own is what makes it obey the wildcard rule (RFC 9309 section 2.2.1).
test('ALLOW (owner 2026-10-22): Google-Extended has no rule of its own on a live site, so it obeys the wildcard allow like a normal crawler', () => {
  const named = liveRules().filter((rule) => toList(rule.userAgent).some((ua) => ua.toLowerCase() === 'google-extended'));
  assert.deepEqual(named, [], 'no rule may name Google-Extended, in any casing');
  assert.deepEqual(toList(ruleFor('*').allow), ['/'], 'the wildcard rule it falls through to allows the site');
});

test('REFUSE (owner 2026-10-22): every other rule is unchanged, the full live rule list is pinned exactly', () => {
  assert.deepEqual(liveRules(), [
    {
      userAgent: '*',
      allow: '/',
      disallow: ['/private/', '/mcp', '/.well-known/mcp.json', '/.well-known/llms.txt'],
    },
    { userAgent: 'ChatGPT-User', allow: '/' },
    { userAgent: 'OAI-SearchBot', allow: '/' },
    { userAgent: 'PerplexityBot', allow: '/' },
    { userAgent: 'Claude-User', allow: '/' },
    { userAgent: 'Claude-Web', allow: '/' },
    { userAgent: 'GPTBot', disallow: '/' },
    { userAgent: 'ClaudeBot', disallow: '/' },
    { userAgent: 'anthropic-ai', disallow: '/' },
    { userAgent: 'CCBot', disallow: '/' },
    { userAgent: 'Applebot-Extended', disallow: '/' },
    { userAgent: 'meta-externalagent', disallow: '/' },
  ]);
});

test('ALLOW (discovery 3.4): a demo site lets every crawler in, so each one reads the noindex, and still advertises no sitemap', () => {
  const policy = buildRobotsPolicy({ ...LIVE_SITE, lifecycleState: 'demo' } as SiteData);
  assert.deepEqual(policy, { rules: [{ userAgent: '*', allow: '/' }] });
});

// D2 (owner 2026-10-22): Apple's and Meta's TRAINING agents are blocked, their
// search and link-preview agents are not.
test('REFUSE (D2): Applebot-Extended and meta-externalagent each have their own Disallow: / group on a live site', () => {
  for (const userAgent of ['Applebot-Extended', 'meta-externalagent']) {
    const rule = ruleFor(userAgent);
    assert.deepEqual(toList(rule.disallow), ['/'], `${userAgent} is denied the whole site`);
    assert.deepEqual(toList(rule.allow), [], `${userAgent} is granted nothing`);
  }
});

test('ALLOW (D2): Applebot, Meta-WebIndexer, OAI-SearchBot, PerplexityBot and Google-Extended still reach an allow', () => {
  // A crawler with no group of its own obeys the wildcard (RFC 9309 2.2.1).
  const rules = liveRules();
  for (const userAgent of ['Applebot', 'Meta-WebIndexer', 'facebookexternalhit', 'Meta-ExternalFetcher', 'Google-Extended']) {
    const named = rules.filter((rule) => toList(rule.userAgent).some((ua) => ua.toLowerCase() === userAgent.toLowerCase()));
    assert.deepEqual(named, [], `${userAgent} has no group, so it obeys the wildcard allow`);
  }
  assert.deepEqual(toList(ruleFor('*').allow), ['/']);
  for (const userAgent of ['OAI-SearchBot', 'PerplexityBot']) {
    assert.deepEqual(toList(ruleFor(userAgent).allow), ['/'], `${userAgent} keeps its own allow`);
  }
});

test('ALLOW (v5 R4): /llms.txt is no longer disallowed for generic crawlers, so the file the site serves is not contradicted', () => {
  const wildcard = ruleFor('*');
  const disallow = toList(wildcard.disallow);
  assert.ok(!disallow.includes('/llms.txt'), '/llms.txt must not be in the wildcard disallow');
  assert.deepEqual(toList(wildcard.allow), ['/'], 'public content, /llms.txt included, stays reachable for the wildcard agent');
});

test('REFUSE (v5 R4): the agent tool endpoints and the retired llms path stay disallowed', () => {
  const disallow = toList(ruleFor('*').disallow);
  for (const path of ['/mcp', '/.well-known/mcp.json', '/.well-known/llms.txt']) {
    assert.ok(disallow.includes(path), `${path} stays in the wildcard disallow`);
  }
});

test('wildcard: the disallow list is exactly /private/ plus the agent endpoints (pinned so any change is deliberate)', () => {
  assert.deepEqual(toList(ruleFor('*').disallow), [
    '/private/',
    '/mcp',
    '/.well-known/mcp.json',
    '/.well-known/llms.txt',
  ]);
});

test('live-action agents are unaffected: each has its own allow-everything rule with no disallow, so /llms.txt stays reachable for them', () => {
  for (const userAgent of LIVE_ACTION_AGENTS) {
    const rule = ruleFor(userAgent);
    assert.deepEqual(toList(rule.allow), ['/'], `${userAgent} allows /`);
    assert.deepEqual(toList(rule.disallow), [], `${userAgent} carries no disallow, so nothing keeps it off /llms.txt`);
  }
});

test('training crawlers are unaffected: still disallowed everywhere', () => {
  for (const userAgent of TRAINING_CRAWLERS) {
    const rule = ruleFor(userAgent);
    assert.deepEqual(toList(rule.disallow), ['/'], `${userAgent} is denied the whole site`);
    assert.deepEqual(toList(rule.allow), [], `${userAgent} is granted nothing`);
  }
});

test('only the wildcard rule names llms.txt at all: no agent-specific rule quietly re-blocks or re-opens it', () => {
  for (const rule of liveRules()) {
    if (toList(rule.userAgent).includes('*')) continue;
    const paths = [...toList(rule.allow), ...toList(rule.disallow)];
    assert.ok(
      !paths.some((path) => path.includes('llms.txt')),
      `${JSON.stringify(rule.userAgent)} must not name llms.txt; the decision lives in the wildcard rule`,
    );
  }
});
