// Workflow-logic tests for .github/workflows/sync-main-to-sites.yml
//
// These run the REAL bash from the workflow's "Sync main into all site branches"
// step (extracted from the YAML at test time) against `git` / `curl` shell-function
// doubles. Nothing here re-implements the sync logic — the doubles only decide
// which branches conflict / fail to push, then we assert on what the real script
// does: conflict isolation, batch-push retry isolation, reason labeling, the
// single batched report payload shape, discovery filtering, and exit codes.
//
// Run: node --test .github/tests/sync-main-to-sites.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = join(HERE, '..', 'workflows', 'sync-main-to-sites.yml');
const YAML = readFileSync(WORKFLOW, 'utf8');

// bash uses forward slashes happily on every platform incl. Git Bash on Windows.
const sh = (p) => p.split('\\').join('/');

// --- Extract the sync step's `run: |` literal block straight from the YAML ------
function extractSyncScript(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const nameIdx = lines.findIndex((l) => /name:\s+Sync main into all site branches\s*$/.test(l));
  assert.notEqual(nameIdx, -1, 'sync step "name:" not found in workflow');

  let runIdx = -1;
  for (let i = nameIdx; i < lines.length; i++) {
    if (/^\s*run:\s*\|\s*$/.test(lines[i])) {
      runIdx = i;
      break;
    }
  }
  assert.notEqual(runIdx, -1, '"run: |" block not found for sync step');

  const runIndent = lines[runIdx].match(/^(\s*)/)[1].length;
  const body = [];
  let contentIndent = null;
  for (let i = runIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      body.push('');
      continue;
    }
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= runIndent) break; // dedented out of the block
    if (contentIndent === null) contentIndent = indent;
    body.push(line.slice(contentIndent));
  }
  while (body.length && body[body.length - 1] === '') body.pop();
  return body.join('\n');
}

const SYNC_SCRIPT = extractSyncScript(YAML);

// `git` / `curl` doubles. No `${...}` here (bash bare-var form) so this stays a
// plain JS template literal; `\n` = literal newline for printf.
const DOUBLES = `
git() {
  sub="$1"; shift || true
  case "$sub" in
    config) return 0 ;;
    branch) printf '%s\n' "$FAKE_BRANCH_R"; return 0 ;;
    checkout)
      br=""
      while [ "$#" -gt 0 ]; do
        if [ "$1" = "-B" ]; then br="$2"; shift 2; continue; fi
        shift
      done
      printf '%s' "$br" > "$FAKE_STATE"
      for x in $FAKE_CHECKOUT_FAIL; do [ "$x" = "$br" ] && return 1; done
      return 0 ;;
    merge)
      if [ "$1" = "--abort" ]; then return 0; fi
      cur="$(cat "$FAKE_STATE" 2>/dev/null || true)"
      for x in $FAKE_CONFLICTS; do [ "$x" = "$cur" ] && return 1; done
      return 0 ;;
    push)
      shift
      for ref in "$@"; do
        for x in $FAKE_PUSH_FAIL; do
          if [ "$x" = "$ref" ]; then printf 'FAIL %s\n' "$*" >> "$FAKE_PUSH_LOG"; return 1; fi
        done
      done
      printf 'OK %s\n' "$*" >> "$FAKE_PUSH_LOG"
      return 0 ;;
    *) return 0 ;;
  esac
}

curl() {
  printf 'CALLED\n' >> "$FAKE_CURL_LOG"
  prev=""
  for a in "$@"; do
    if [ "$prev" = "-d" ]; then printf '%s' "$a" > "$FAKE_CURL_PAYLOAD"; fi
    prev="$a"
  done
  return 0
}
`;

function runSync({
  branches,
  conflicts = [],
  pushFail = [],
  checkoutFail = [],
  batchSize = 50,
  webhook = true,
}) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-test-'));
  const stateFile = sh(join(dir, 'state'));
  const pushLog = sh(join(dir, 'push.log'));
  const curlLog = sh(join(dir, 'curl.log'));
  const payloadFile = sh(join(dir, 'payload.json'));
  const summaryFile = sh(join(dir, 'summary.md'));
  const scriptFile = sh(join(dir, 'run.sh'));

  // `git branch -r` output includes origin/main + origin/HEAD to prove filtering.
  const branchLines = [
    '  origin/HEAD -> origin/main',
    '  origin/main',
    ...branches.map((b) => `  origin/${b}`),
  ].join('\n');

  const preamble = [
    `FAKE_STATE='${stateFile}'`,
    `FAKE_PUSH_LOG='${pushLog}'`,
    `FAKE_CURL_LOG='${curlLog}'`,
    `FAKE_CURL_PAYLOAD='${payloadFile}'`,
    `FAKE_CONFLICTS='${conflicts.join(' ')}'`,
    `FAKE_PUSH_FAIL='${pushFail.join(' ')}'`,
    `FAKE_CHECKOUT_FAIL='${checkoutFail.join(' ')}'`,
    `FAKE_BRANCH_R='${branchLines}'`,
    DOUBLES,
  ].join('\n');

  writeFileSync(scriptFile, `${preamble}\n${SYNC_SCRIPT}\n`);

  const env = {
    ...process.env,
    TEMPLATE_REPO: 'HillBombCreations/Vivreal_Templates',
    PUSH_BATCH_SIZE: String(batchSize),
    GITHUB_STEP_SUMMARY: summaryFile,
  };
  if (webhook) {
    env.TEMPLATE_SYNC_WEBHOOK_URL = 'https://portal.example/api/proxy/webhooks/template-sync';
    env.TEMPLATE_SYNC_WEBHOOK_SECRET = 'test-secret';
  } else {
    delete env.TEMPLATE_SYNC_WEBHOOK_URL;
    delete env.TEMPLATE_SYNC_WEBHOOK_SECRET;
  }

  const res = spawnSync('bash', [scriptFile], { env, encoding: 'utf8' });
  const result = {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    pushLog: existsSync(pushLog) ? readFileSync(pushLog, 'utf8') : '',
    curlCalled: existsSync(curlLog),
    payload: existsSync(payloadFile) ? JSON.parse(readFileSync(payloadFile, 'utf8')) : null,
    summary: existsSync(summaryFile) ? readFileSync(summaryFile, 'utf8') : '',
  };
  rmSync(dir, { recursive: true, force: true });
  return result;
}

test('happy path: every branch merged and pushed in one batch, no report sent', () => {
  const r = runSync({ branches: ['a', 'b', 'c'] });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.pushLog, /OK a b c/); // single batched push of all three refs
  assert.equal(r.curlCalled, false, 'no failures → no webhook report');
  assert.equal(r.payload, null);
  assert.match(r.summary, /\| a \| synced \|/);
  assert.match(r.summary, /\| b \| synced \|/);
  assert.match(r.summary, /\| c \| synced \|/);
});

test('discovery excludes origin/main and origin/HEAD', () => {
  const r = runSync({ branches: ['alpha', 'beta'] });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.pushLog, /OK alpha beta/);
  assert.doesNotMatch(r.pushLog, /\bmain\b/);
  assert.doesNotMatch(r.pushLog, /HEAD/);
});

test('merge conflict is isolated, aborted, and reported; other branches still sync', () => {
  const r = runSync({ branches: ['a', 'b', 'c', 'd'], conflicts: ['b'] });
  assert.equal(r.status, 1, 'a failure must fail the run');
  assert.match(r.pushLog, /OK a c d/); // b dropped from the pushed set
  assert.deepEqual(r.payload.conflicts, ['b']);
  assert.deepEqual(r.payload.synced, ['a', 'c', 'd']);
  assert.deepEqual(r.payload.reasons, { b: 'merge_conflict' });
  assert.equal(r.payload.template, 'HillBombCreations/Vivreal_Templates');
  assert.equal(r.curlCalled, true);
  assert.match(r.stdout, /Merge conflict syncing main → b/);
});

test('batch push failure retries refs individually and isolates the bad one', () => {
  const r = runSync({ branches: ['a', 'b', 'c'], pushFail: ['b'] });
  assert.equal(r.status, 1);
  // batch [a b c] fails, then each ref retried on its own
  assert.match(r.pushLog, /FAIL a b c/);
  assert.match(r.pushLog, /OK a/);
  assert.match(r.pushLog, /OK c/);
  assert.deepEqual(r.payload.synced, ['a', 'c']);
  assert.deepEqual(r.payload.conflicts, ['b']);
  assert.deepEqual(r.payload.reasons, { b: 'push_failure' });
});

test('pushes are chunked into PUSH_BATCH_SIZE groups', () => {
  const r = runSync({ branches: ['a', 'b', 'c', 'd', 'e'], batchSize: 2 });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.pushLog, /OK a b/);
  assert.match(r.pushLog, /OK c d/);
  assert.match(r.pushLog, /OK e/);
  assert.equal(r.curlCalled, false);
});

test('per-branch checkout failure is labeled infra_failure; loop continues', () => {
  const r = runSync({ branches: ['a', 'b', 'c'], checkoutFail: ['b'] });
  assert.equal(r.status, 1);
  assert.deepEqual(r.payload.reasons, { b: 'infra_failure' });
  assert.deepEqual(r.payload.conflicts, ['b']);
  assert.deepEqual(r.payload.synced, ['a', 'c']);
});

test('mixed conflict + push failure: both reasons carried in one report', () => {
  const r = runSync({ branches: ['a', 'b', 'c', 'd'], conflicts: ['b'], pushFail: ['d'] });
  assert.equal(r.status, 1);
  // conflicts array = all failed branches (merge conflicts first, then push failures)
  assert.deepEqual(r.payload.conflicts, ['b', 'd']);
  assert.deepEqual(r.payload.synced, ['a', 'c']);
  assert.deepEqual(r.payload.reasons, { b: 'merge_conflict', d: 'push_failure' });
});

test('missing webhook secrets: warn, skip the POST, still exit nonzero', () => {
  const r = runSync({ branches: ['a', 'b'], conflicts: ['b'], webhook: false });
  assert.equal(r.status, 1);
  assert.equal(r.curlCalled, false);
  assert.equal(r.payload, null);
  assert.match(r.stdout, /not configured/);
});
