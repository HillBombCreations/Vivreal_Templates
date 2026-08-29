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
// The wildcard disallow kept naming only the old path, so generic crawlers
// went from disallowed to allowed on the file without anyone deciding it.
// The prior policy is restored at the new path; the old path stays listed
// because it still exists as a redirect.

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
const TRAINING_CRAWLERS = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot', 'Google-Extended'];

test('wildcard: /llms.txt is disallowed for generic crawlers, next to the retired /.well-known/llms.txt path', () => {
  const wildcard = ruleFor('*');
  const disallow = toList(wildcard.disallow);
  assert.ok(disallow.includes('/llms.txt'), '/llms.txt (the post-#123 path) must be in the wildcard disallow');
  assert.ok(
    disallow.includes('/.well-known/llms.txt'),
    'the retired path is still a live 301 onto the file, so it stays disallowed too',
  );
  assert.deepEqual(toList(wildcard.allow), ['/'], 'public content stays indexable for the wildcard agent');
});

test('wildcard: the disallow list is exactly /private/ plus the agent endpoints (pinned so any change is deliberate)', () => {
  assert.deepEqual(toList(ruleFor('*').disallow), [
    '/private/',
    '/mcp',
    '/.well-known/mcp.json',
    '/.well-known/llms.txt',
    '/llms.txt',
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
