#!/usr/bin/env node
/**
 * _lockcensus.js — compare a regenerated package-lock.json against the one it
 * replaced, entry by entry.
 *
 * Amplify IS the CI for Templates and runs `npm ci`, so a lockfile that
 * installs on this machine but has silently PRUNED sharp's `@emnapi/*` or the
 * linux-platform optional transitives bricks every fleet build at install time.
 * That has happened before (Templates #83 took out all eight apps), and the
 * failure is invisible in a diff of 700+ lines unless it is counted.
 *
 * The rule is not "the counts must not shrink" — a legitimate bump can move a
 * subtree. The rule is that every difference has to be NAMED and explained
 * before the lockfile is committed.
 *
 *   node _lockcensus.js <before.json> [after.json]
 */
const fs = require('fs');

const beforePath = process.argv[2];
const afterPath = process.argv[3] || 'package-lock.json';
if (!beforePath) {
  console.error('usage: node _lockcensus.js <before.json> [after.json]');
  process.exit(2);
}

const load = (p) => {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  return d.packages || {};
};
const before = load(beforePath);
const after = load(afterPath);

const beforeKeys = new Set(Object.keys(before));
const afterKeys = new Set(Object.keys(after));
const added = [...afterKeys].filter((k) => !beforeKeys.has(k));
const removed = [...beforeKeys].filter((k) => !afterKeys.has(k));

/** Entries whose loss silently breaks the Linux build. */
const GROUPS = {
  '@emnapi/': (k) => k.includes('@emnapi/'),
  '@img/sharp': (k) => k.includes('@img/sharp'),
  'linux (any)': (k) => k.includes('linux'),
  'optional deps': (k) => Boolean((after[k] || before[k] || {}).optional),
};

console.log(`  entries   before ${beforeKeys.size}   after ${afterKeys.size}`);
console.log(`  added ${added.length}   removed ${removed.length}\n`);

for (const [label, match] of Object.entries(GROUPS)) {
  const b = [...beforeKeys].filter(match).length;
  const a = [...afterKeys].filter(match).length;
  const flag = a < b ? '  <-- SHRANK, do not commit without explaining why' : '';
  console.log(`  ${label.padEnd(16)} ${String(b).padStart(4)} -> ${String(a).padStart(4)}${flag}`);
}

const renderer = 'node_modules/@hillbombcreations/site-renderer';
console.log(
  `\n  renderer         ${(before[renderer] || {}).version} -> ${(after[renderer] || {}).version}`,
);

if (removed.length) {
  console.log(`\n  REMOVED (${removed.length}):`);
  for (const k of removed.slice(0, 40)) console.log(`     - ${k}  @${(before[k] || {}).version || '?'}`);
  if (removed.length > 40) console.log(`     ... and ${removed.length - 40} more`);
}
if (added.length) {
  console.log(`\n  ADDED (${added.length}):`);
  for (const k of added.slice(0, 40)) console.log(`     + ${k}  @${(after[k] || {}).version || '?'}`);
  if (added.length > 40) console.log(`     ... and ${added.length - 40} more`);
}

// A shrink in any Linux-critical group is the exact shape of the #83 outage.
const critical = ['@emnapi/', '@img/sharp', 'linux (any)'].filter((label) => {
  const match = GROUPS[label];
  return [...afterKeys].filter(match).length < [...beforeKeys].filter(match).length;
});
console.log(`\n  VERDICT: ${critical.length ? `SHRANK in ${critical.join(', ')} — investigate before committing` : 'no Linux-critical group shrank'}`);
process.exit(critical.length ? 1 : 0);
