/**
 * scripts/router-header-probe.mjs. Hermetic: local stub origins, one that
 * behaves like the fixed site, one with the 20e86d2 Next-Action gap, and two
 * with no rules (a prerendered route that serves raw flight to the prefetch
 * pair, and a dynamic route that serves the page to everything). The probe
 * must PASS the first and FAIL the others, and the reverse under
 * --expect-defect, so a probe that reports nothing, or everything, cannot pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { runProbes } from "./router-header-probe.mjs";

const ROUTER_HEADERS = [
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-router-state-tree",
  "next-url",
  "next-hmr-refresh",
];
const SERVER_ACTION_HEADERS = new Set(["next-router-state-tree", "next-url"]);

/**
 * mode "fixed":      the shipped rules (Next-Action exempts only the state-tree
 *                    and Next-Url rules).
 * mode "action-gap": the 20e86d2 rules, where Next-Action exempted every rule
 *                    (PR #197 review pass 7, B1).
 * mode "defective":  no rules, a prerendered route: the prefetch pair gets raw
 *                    flight under s-maxage, anything else gets the page.
 * mode "dynamic":    no rules, a dynamic route: the page for everything.
 */
function startStub({ mode }) {
  const hasRules = mode === "fixed" || mode === "action-gap";
  const seen = { repeatedRsc: false };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    const rscLines = req.rawHeaders.filter((h, i) => i % 2 === 0 && h.toLowerCase() === "rsc").length;
    if (rscLines > 1) seen.repeatedRsc = true;
    const hasAction = req.headers["next-action"] !== undefined;
    const forged =
      req.headers.rsc !== "1" &&
      ROUTER_HEADERS.some(
        (h) =>
          req.headers[h] !== undefined &&
          !(hasAction && (mode === "action-gap" || SERVER_ACTION_HEADERS.has(h))),
      );
    const prefetchPair =
      req.headers["next-router-prefetch"] === "1" && req.headers["next-router-segment-prefetch"] !== undefined;
    const refuse = () => {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store, max-age=0" });
      res.end("Bad request\n");
    };
    if (url.pathname === "/api/router-header-refused") return hasRules ? refuse() : res.writeHead(404).end();
    if (url.pathname === "/old" || url.pathname === "/old-clean") {
      if (url.pathname === "/old-clean") url.searchParams.delete("_rsc");
      res.writeHead(301, { location: `/new?${url.searchParams.toString()}` });
      return res.end();
    }
    if (forged && hasRules) return refuse();
    if (req.headers.rsc !== "1" && prefetchPair && mode !== "dynamic") {
      res.writeHead(200, { "content-type": "text/x-component", "cache-control": "s-maxage=300" });
      return res.end("0:flight");
    }
    if (req.headers.rsc === "1") {
      if (!url.searchParams.has("_rsc")) {
        url.searchParams.set("_rsc", "h4sh");
        res.writeHead(307, { location: `${url.pathname}${url.search}` });
        return res.end();
      }
      res.writeHead(200, { "content-type": "text/x-component" });
      return res.end("0:flight");
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "strict-transport-security": "max-age=31536000" });
    res.end("<html></html>");
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ base: `http://127.0.0.1:${port}`, seen, close: () => new Promise((r) => server.close(r)) });
    }),
  );
}

async function probe(stub, opts = {}) {
  const lines = [];
  const failures = await runProbes({ base: stub.base, log: (l) => lines.push(l), ...opts });
  return { failures, lines };
}

test("ALLOW: a fixed origin passes every case, and the repeated RSC goes out as two header lines", async () => {
  const stub = await startStub({ mode: "fixed" });
  try {
    const { failures, lines } = await probe(stub);
    assert.equal(failures, 0, lines.join("\n"));
    assert.ok(lines.length >= 13, `ran ${lines.length} cases`);
    assert.ok(lines.some((l) => l.startsWith("PASS / pair with Next-Action")));
    assert.equal(stub.seen.repeatedRsc, true, "the repeated-RSC case sent two rsc lines");
  } finally {
    await stub.close();
  }
});

test("REFUSE: a defective origin fails every refusal case", async () => {
  const stub = await startStub({ mode: "defective" });
  try {
    const { failures, lines } = await probe(stub);
    const failed = lines.filter((l) => l.startsWith("FAIL"));
    // 9 refusal cases plus the direct route; the plain and navigation cases still pass.
    assert.equal(failures, 10, lines.join("\n"));
    assert.ok(failed.some((l) => l.includes("pair without RSC") && l.includes("text/x-component")));
  } finally {
    await stub.close();
  }
});

test("REFUSE: the 20e86d2 Next-Action gap fails the pair-with-Next-Action case and nothing else", async () => {
  const stub = await startStub({ mode: "action-gap" });
  try {
    const { failures, lines } = await probe(stub);
    const failed = lines.filter((l) => l.startsWith("FAIL"));
    assert.equal(failures, 1, lines.join("\n"));
    assert.match(failed[0], /pair with Next-Action: status 200/);
  } finally {
    await stub.close();
  }
});

test("--expect-defect: only the prefetch pair records the defect; single headers are INFO, not PASS", async () => {
  const defective = await startStub({ mode: "defective" });
  const fixed = await startStub({ mode: "fixed" });
  const dynamic = await startStub({ mode: "dynamic" });
  try {
    const baseline = await probe(defective, { expectDefect: true });
    assert.equal(baseline.failures, 0, baseline.lines.join("\n"));
    assert.equal(baseline.lines.filter((l) => l.includes("defect reproduced")).length, 4);
    for (const header of ROUTER_HEADERS) {
      assert.ok(
        baseline.lines.some((l) => l.startsWith(`INFO / ${header} alone (baseline): not refused`)),
        `${header} alone is INFO`,
      );
      assert.ok(!baseline.lines.some((l) => l.startsWith("PASS") && l.includes(`${header} alone`)));
    }
    // A fixed site: 9 cases already refused, and nothing reproduced.
    assert.equal((await probe(fixed, { expectDefect: true })).failures, 10);
    // A dynamic route reproduces nothing, so the baseline cannot claim it did.
    const none = await probe(dynamic, { expectDefect: true });
    assert.equal(none.failures, 1, none.lines.join("\n"));
    assert.ok(none.lines.some((l) => l.startsWith("FAIL baseline: no prefetch-pair case")));
  } finally {
    await defective.close();
    await fixed.close();
    await dynamic.close();
  }
});

test("REDIRECT_FROM: REFUSE a Location carrying _rsc, ALLOW one without it", async () => {
  const stub = await startStub({ mode: "fixed" });
  try {
    // The stub copies the whole query, _rsc included: the probe must catch it.
    const leaky = await probe(stub, { redirectFrom: "/old" });
    assert.ok(leaky.lines.some((l) => l.startsWith("FAIL authored redirect") && l.includes("_rsc")), leaky.lines.join("\n"));
    const clean = await probe(stub, { redirectFrom: "/old-clean" });
    assert.equal(clean.failures, 0, clean.lines.join("\n"));
    assert.ok(clean.lines.some((l) => l.startsWith("PASS authored redirect /old-clean")));
  } finally {
    await stub.close();
  }
});
