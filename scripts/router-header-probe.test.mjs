/**
 * scripts/router-header-probe.mjs. Hermetic: two local stub origins, one that
 * behaves like the fixed site and one that reproduces the defect (raw flight
 * under s-maxage for a forged router-header request). The probe must PASS the
 * first and FAIL the second, and the reverse under --expect-defect, so a probe
 * that reports nothing, or everything, cannot pass.
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

function startStub({ fixed }) {
  const seen = { repeatedRsc: false };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    const rscLines = req.rawHeaders.filter((h, i) => i % 2 === 0 && h.toLowerCase() === "rsc").length;
    if (rscLines > 1) seen.repeatedRsc = true;
    const forged =
      ROUTER_HEADERS.some((h) => req.headers[h] !== undefined) &&
      req.headers.rsc !== "1" &&
      req.headers["next-action"] === undefined;
    const refuse = () => {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store, max-age=0" });
      res.end("Bad request\n");
    };
    if (url.pathname === "/api/router-header-refused") return fixed ? refuse() : res.writeHead(404).end();
    if (url.pathname === "/old" || url.pathname === "/old-clean") {
      if (url.pathname === "/old-clean") url.searchParams.delete("_rsc");
      res.writeHead(301, { location: `/new?${url.searchParams.toString()}` });
      return res.end();
    }
    if (forged) {
      if (fixed) return refuse();
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
  const stub = await startStub({ fixed: true });
  try {
    const { failures, lines } = await probe(stub);
    assert.equal(failures, 0, lines.join("\n"));
    assert.ok(lines.length >= 12, `ran ${lines.length} cases`);
    assert.equal(stub.seen.repeatedRsc, true, "the repeated-RSC case sent two rsc lines");
  } finally {
    await stub.close();
  }
});

test("REFUSE: a defective origin fails every refusal case", async () => {
  const stub = await startStub({ fixed: false });
  try {
    const { failures, lines } = await probe(stub);
    const failed = lines.filter((l) => l.startsWith("FAIL"));
    // 8 refusal cases plus the direct route; the plain and navigation cases still pass.
    assert.equal(failures, 9, lines.join("\n"));
    assert.ok(failed.some((l) => l.includes("pair without RSC") && l.includes("text/x-component")));
  } finally {
    await stub.close();
  }
});

test("--expect-defect: PASS on the defective origin, FAIL on the fixed one", async () => {
  const defective = await startStub({ fixed: false });
  const fixed = await startStub({ fixed: true });
  try {
    assert.equal((await probe(defective, { expectDefect: true })).failures, 0);
    assert.equal((await probe(fixed, { expectDefect: true })).failures, 8);
  } finally {
    await defective.close();
    await fixed.close();
  }
});

test("REDIRECT_FROM: REFUSE a Location carrying _rsc, ALLOW one without it", async () => {
  const stub = await startStub({ fixed: true });
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
