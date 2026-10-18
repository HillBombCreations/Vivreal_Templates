/**
 * V7.277: which runs of promote-stable.yml and demo-catchup.yml share the
 * fleet-build concurrency group.
 *
 * GitHub keeps ONE pending run per group, and a newer run REPLACES the pending
 * one. So the shared group must hold only the runs that must not overlap: a
 * real promote, and a manual `tier: live` or `tier: all` recovery. A scheduled
 * catch-up, a manual `tier: demo` run and any dry run must resolve to some
 * other group, or they can cancel a waiting live recovery or promote.
 *
 * The group is a GitHub expression, so this module evaluates it, the way the
 * runner would, for every kind of run each workflow can start. The evaluator
 * covers the subset these files use: string, boolean and number literals,
 * `github.*` and `inputs.*` reads, `==`, `!=`, `&&`, `||`, `!`, parentheses
 * and `format()`. Anything else throws, so a new construct fails the test
 * loudly instead of being guessed at.
 */

export const SHARED_GROUP = "templates-fleet-build";

/**
 * Every kind of run each workflow can start, with the context GitHub gives it.
 * Hand written so each entry states whether it SHOULD share the group;
 * runKindCoverageIssues fails when the workflows declare a run missing here.
 */
export const RUN_KINDS = {
  promote: [
    { name: "promote live", shared: true, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { scope: "live", dry_run: false } } },
    { name: "promote all", shared: true, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { scope: "all", dry_run: false } } },
    { name: "promote dry run", shared: false, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { scope: "live", dry_run: true } } },
    { name: "promote all dry run", shared: false, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { scope: "all", dry_run: true } } },
  ],
  catchup: [
    { name: "catch-up recovery live", shared: true, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { tier: "live", dry_run: false } } },
    { name: "catch-up recovery all", shared: true, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { tier: "all", dry_run: false } } },
    { name: "catch-up manual demo", shared: false, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { tier: "demo", dry_run: false } } },
    { name: "catch-up live dry run", shared: false, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { tier: "live", dry_run: true } } },
    { name: "catch-up all dry run", shared: false, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { tier: "all", dry_run: true } } },
    { name: "catch-up demo dry run", shared: false, ctx: { github: { event_name: "workflow_dispatch" }, inputs: { tier: "demo", dry_run: true } } },
    // A scheduled run has no inputs at all: every `inputs.*` reads as null.
    { name: "catch-up weekly schedule", shared: false, ctx: { github: { event_name: "schedule" }, inputs: {} } },
  ],
};

/**
 * Every run a workflow document DECLARES it can start, read from its `on:`
 * block rather than from a list, so a tier, scope or trigger added later is
 * enumerated without anyone remembering to.
 *
 * A dispatch expands to the cross product of its inputs: a `choice` gives its
 * options, a `boolean` gives true and false. Any other input type (string,
 * number, environment) has no finite set of values, so it is returned as
 * `unenumerable` for the caller to fail on, never skipped. Every other event
 * starts one kind of run with no inputs, the way a schedule does.
 */
export function declaredRunKinds(doc) {
  const on = doc?.on;
  const events = typeof on === "string" ? { [on] : null }
    : Array.isArray(on) ? Object.fromEntries(on.map((e) => [e, null]))
    : on && typeof on === "object" ? on
    : {};
  const kinds = [];
  const unenumerable = [];
  for (const [event, config] of Object.entries(events)) {
    const inputs = event === "workflow_dispatch" || event === "workflow_call" ? (config?.inputs ?? {}) : {};
    let combos = [{}];
    for (const [name, spec] of Object.entries(inputs)) {
      const values = spec?.type === "choice" ? (spec.options ?? [])
        : spec?.type === "boolean" ? [true, false]
        : null;
      if (!values || values.length === 0) {
        unenumerable.push(`${event} input "${name}" (type ${spec?.type ?? "string"}) has no finite set of values`);
        continue;
      }
      combos = combos.flatMap((c) => values.map((v) => ({ ...c, [name]: v })));
    }
    for (const c of combos) kinds.push({ event_name: event, inputs: c });
  }
  return { kinds, unenumerable };
}

const sameRun = (declared, listed) => {
  if (listed.ctx.github.event_name !== declared.event_name) return false;
  const a = Object.keys(declared.inputs);
  const b = Object.keys(listed.ctx.inputs);
  return a.length === b.length && a.every((k) => listed.ctx.inputs[k] === declared.inputs[k]);
};

/**
 * Every declared run must appear in RUN_KINDS, or its group is never checked
 * and a new run kind falls silently into whichever group the expression's
 * fallback names. A listed run the workflow can no longer start is reported
 * too, since it tests a run that does not exist.
 */
export function runKindCoverageIssues(promoteDoc, catchupDoc, runKinds = RUN_KINDS) {
  const issues = [];
  for (const [key, doc] of Object.entries({ promote: promoteDoc, catchup: catchupDoc })) {
    const { kinds, unenumerable } = declaredRunKinds(doc);
    if (kinds.length === 0) issues.push(`${key}: declares no triggers`);
    for (const u of unenumerable) issues.push(`${key}: ${u}`);
    const listed = runKinds[key] ?? [];
    for (const d of kinds) {
      if (!listed.some((l) => sameRun(d, l))) {
        issues.push(`${key}: ${d.event_name} ${JSON.stringify(d.inputs)} is declared but not in RUN_KINDS`);
      }
    }
    for (const l of listed) {
      if (!kinds.some((d) => sameRun(d, l))) issues.push(`${key}: RUN_KINDS "${l.name}" is not a run the workflow declares`);
    }
  }
  return issues;
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    const two = src.slice(i, i + 2);
    if (["&&", "||", "==", "!="].includes(two)) { tokens.push({ t: "op", v: two }); i += 2; continue; }
    if ("()!,.".includes(ch)) { tokens.push({ t: "op", v: ch }); i += 1; continue; }
    if (ch === "'") {
      let j = i + 1;
      let out = "";
      for (;;) {
        if (j >= src.length) throw new Error(`unterminated string in ${src}`);
        if (src[j] === "'" && src[j + 1] === "'") { out += "'"; j += 2; continue; }
        if (src[j] === "'") break;
        out += src[j];
        j += 1;
      }
      tokens.push({ t: "str", v: out });
      i = j + 1;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i));
    if (word) { tokens.push({ t: "id", v: word[0] }); i += word[0].length; continue; }
    const num = /^\d+/.exec(src.slice(i));
    if (num) { tokens.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    throw new Error(`unsupported character "${ch}" in ${src}`);
  }
  return tokens;
}

const truthy = (v) => !(v === false || v === null || v === undefined || v === "" || v === 0);

function looseEqual(a, b) {
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  return (a ?? null) === (b ?? null);
}

/** Evaluate one GitHub expression body (the text inside `${{ }}`). */
export function evaluateExpression(src, ctx) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (v) => {
    const tok = tokens[pos];
    if (!tok || (v !== undefined && tok.v !== v)) throw new Error(`expected ${v ?? "a value"} at token ${pos} in ${src}`);
    pos += 1;
    return tok;
  };

  function primary() {
    const tok = take();
    if (tok.t === "op" && tok.v === "(") { const v = or(); take(")"); return v; }
    if (tok.t === "op" && tok.v === "!") return !truthy(primary());
    if (tok.t === "str" || tok.t === "num") return tok.v;
    if (tok.t !== "id") throw new Error(`unexpected ${tok.v} in ${src}`);
    if (tok.v === "true") return true;
    if (tok.v === "false") return false;
    if (tok.v === "null") return null;
    if (tok.v === "format") {
      take("(");
      const args = [or()];
      while (peek()?.v === ",") { take(","); args.push(or()); }
      take(")");
      const [template, ...rest] = args;
      return String(template).replace(/\{(\d+)\}/g, (_, n) => String(rest[Number(n)] ?? ""));
    }
    if (tok.v !== "github" && tok.v !== "inputs") throw new Error(`unsupported context ${tok.v} in ${src}`);
    let value = ctx[tok.v] ?? {};
    while (peek()?.v === ".") {
      take(".");
      const key = take().v;
      value = value == null ? null : (value[key] ?? null);
    }
    return value;
  }
  function eq() {
    let left = primary();
    while (peek()?.v === "==" || peek()?.v === "!=") {
      const op = take().v;
      const right = primary();
      left = op === "==" ? looseEqual(left, right) : !looseEqual(left, right);
    }
    return left;
  }
  function and() {
    let left = eq();
    while (peek()?.v === "&&") { take("&&"); const right = eq(); left = truthy(left) ? right : left; }
    return left;
  }
  function or() {
    let left = and();
    while (peek()?.v === "||") { take("||"); const right = and(); left = truthy(left) ? left : right; }
    return left;
  }

  const value = or();
  if (pos !== tokens.length) throw new Error(`trailing tokens in ${src}`);
  return value;
}

/** A `concurrency.group` value (literal or `${{ }}` expression) resolved for one run. */
export function resolveGroup(group, ctx) {
  const m = /^\$\{\{([\s\S]*)\}\}$/.exec(String(group).trim());
  return m ? String(evaluateExpression(m[1], ctx)) : String(group);
}

/** GitHub accepts `concurrency: <group>` or `{ group, cancel-in-progress }`. */
function readConcurrency(doc) {
  const c = doc?.concurrency;
  if (typeof c === "string") return { group: c, cancel: false };
  if (c && typeof c === "object" && typeof c.group === "string") {
    return { group: c.group, cancel: c["cancel-in-progress"] === true };
  }
  return null;
}

export function fleetBuildConcurrencyIssues(promoteDoc, catchupDoc, ctx = { github: { run_id: "1" } }) {
  const issues = [];
  const docs = { promote: promoteDoc, catchup: catchupDoc };
  for (const [key, doc] of Object.entries(docs)) {
    const c = readConcurrency(doc);
    if (!c) {
      issues.push(`${key}: no concurrency group`);
      continue;
    }
    if (c.cancel) issues.push(`${key}: cancel-in-progress must be false, a cancelled fleet build stops mid fan-out`);
    for (const kind of RUN_KINDS[key]) {
      const run = {
        github: { run_id: ctx.github.run_id, ...kind.ctx.github },
        inputs: kind.ctx.inputs,
      };
      const group = resolveGroup(c.group, run);
      if (kind.shared && group !== SHARED_GROUP) issues.push(`${kind.name} resolves to "${group}", not the shared "${SHARED_GROUP}"`);
      if (!kind.shared && group === SHARED_GROUP) issues.push(`${kind.name} joins the shared group and can replace a pending live run`);
    }
  }
  return issues;
}
