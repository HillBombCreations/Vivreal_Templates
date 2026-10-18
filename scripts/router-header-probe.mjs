/**
 * Probe a running Templates site for the router-header refusal
 * (vivreal-hq docs/projects/next-release-v7/
 * design-templates-router-header-strip-2026-10-18.md, sections 7 and 8).
 *
 *   BASE=https://<site> node scripts/router-header-probe.mjs
 *   BASE=https://<site> node scripts/router-header-probe.mjs --expect-defect
 *
 * Optional env:
 *   PATHS          comma list of document paths to probe (default "/")
 *   REDIRECT_FROM  an authored redirect's `from`, to check `_rsc` never rides
 *                  the 301 Location
 *   PREVIEW_TOKEN  a well-formed preview token, to check the preview 307
 *
 * Every probe gets a fresh random query, so a probe against an unfixed origin
 * can poison only a URL nobody requests. `node:http(s)`, not fetch, because
 * fetch cannot send a repeated header. One PASS/FAIL line per case; exit 1 on
 * any FAIL.
 *
 * `--expect-defect` is the pre-promote baseline: refusal cases PASS when the
 * site still answers the forged shape (the defect is reproduced and printed),
 * and the cases that need the new route are skipped.
 */
import http from "node:http";
import https from "node:https";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const ROUTER_HEADERS = [
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-router-state-tree",
  "next-url",
  "next-hmr-refresh",
];
const PAIR = { "next-router-prefetch": "1", "next-router-segment-prefetch": "/_tree" };
const SINGLE_VALUE = {
  "next-router-prefetch": "1",
  "next-router-segment-prefetch": "/_tree",
  "next-router-state-tree": "%5B%22%22%5D",
  "next-url": "/",
  "next-hmr-refresh": "1",
};
const UA = "vivreal-router-header-probe/1";
const TIMEOUT_MS = 15000;

function rand() {
  return randomBytes(6).toString("hex");
}

function withProbeQuery(path, extra = "") {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}probe=${rand()}${extra}`;
}

/** One request, no redirect following. Header values may be arrays (sent as repeated lines). */
export function request(base, path, headers = {}, method = "GET") {
  const url = new URL(path, base);
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(url, { method, headers: { "user-agent": UA, ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      );
      res.on("error", reject);
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`timeout after ${TIMEOUT_MS} ms`)));
    req.on("error", reject);
    req.end();
  });
}

function summary(res) {
  return [
    res.status,
    res.headers["content-type"] ?? "-",
    `cc=${res.headers["cache-control"] ?? "-"}`,
    `x-cache=${res.headers["x-cache"] ?? "-"}`,
  ].join(" ");
}

/** Returns a failure reason, or null when `res` is the no-store refusal. */
export function refusalProblem(res) {
  const cc = res.headers["cache-control"] ?? "";
  const ct = res.headers["content-type"] ?? "";
  if (res.status !== 400) return `status ${res.status}, want 400`;
  if (!cc.includes("no-store") || !cc.includes("private")) return `cache-control "${cc}"`;
  if (cc.includes("s-maxage")) return `cache-control "${cc}" has s-maxage`;
  if (!ct.startsWith("text/plain")) return `content-type "${ct}"`;
  if (/hit/i.test(String(res.headers["x-cache"] ?? ""))) return `x-cache "${res.headers["x-cache"]}"`;
  return null;
}

/** Returns a failure reason, or null when `res` is an ordinary HTML document. */
export function documentProblem(res) {
  const ct = res.headers["content-type"] ?? "";
  if (res.status !== 200) return `status ${res.status}, want 200`;
  if (!ct.startsWith("text/html")) return `content-type "${ct}", want text/html`;
  return null;
}

function rscFlightProblem(res) {
  const ct = res.headers["content-type"] ?? "";
  if (res.status !== 200) return `status ${res.status}, want 200`;
  if (!ct.startsWith("text/x-component")) return `content-type "${ct}", want text/x-component`;
  return null;
}

function locationProblem(location) {
  if (!location) return "no Location";
  if (location.includes("_rsc")) return `Location carries _rsc: ${location}`;
  if (/localhost|127\.0\.0\.1/.test(location)) return `Location carries a compute host: ${location}`;
  return null;
}

/**
 * Run every case. `log(line)` receives one line per case. Resolves to the
 * number of FAILs.
 */
export async function runProbes({ base, paths = ["/"], expectDefect = false, redirectFrom, previewToken, log }) {
  let failures = 0;
  const record = (name, problem, detail) => {
    if (problem) failures += 1;
    log(`${problem ? "FAIL" : "PASS"} ${name}${problem ? `: ${problem}` : ""}${detail ? ` [${detail}]` : ""}`);
  };
  const tryCase = async (name, fn) => {
    try {
      await fn();
    } catch (err) {
      record(name, `request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const refusalCases = [
    ["pair without RSC", { ...PAIR }],
    ["pair with RSC: 0", { ...PAIR, rsc: "0" }],
    ["pair with repeated RSC", { ...PAIR, rsc: ["1", "1"] }],
    ...ROUTER_HEADERS.map((h) => [`${h} alone`, { [h]: SINGLE_VALUE[h] }]),
  ];

  for (const path of paths) {
    for (const [label, headers] of refusalCases) {
      const name = `${path} ${label}`;
      await tryCase(name, async () => {
        const url = withProbeQuery(path);
        const res = await request(base, url, headers);
        if (expectDefect) {
          record(`${name} (baseline)`, res.status === 400 ? "already refused, no defect to record" : null, summary(res));
          return;
        }
        record(name, refusalProblem(res), summary(res));
        if (label === "pair without RSC") {
          // D2: the URL the refusal answered must still be the plain page, twice.
          for (const n of [1, 2]) {
            const plain = await request(base, url, { accept: "text/html" });
            record(`${name}, then plain GET #${n}`, documentProblem(plain), summary(plain));
          }
        }
      });
    }

    await tryCase(`${path} plain GET`, async () => {
      const res = await request(base, withProbeQuery(path), { accept: "text/html" });
      const hsts = res.headers["strict-transport-security"];
      record(`${path} plain GET`, documentProblem(res) ?? (hsts ? null : "no HSTS"), summary(res));
    });

    // D5 / L5: a real navigation is never refused. Next answers a missing
    // _rsc with a 307 to ?_rsc=<hash>; follow it with the same headers.
    await tryCase(`${path} RSC: 1 navigation`, async () => {
      const headers = { ...PAIR, rsc: "1" };
      let res = await request(base, withProbeQuery(path), headers);
      if (res.status === 307 || res.status === 308) {
        res = await request(base, String(res.headers.location ?? ""), headers);
      }
      record(`${path} RSC: 1 navigation`, rscFlightProblem(res), summary(res));
    });
  }

  if (!expectDefect) {
    await tryCase("refusal route requested directly", async () => {
      const res = await request(base, withProbeQuery("/api/router-header-refused"));
      record("refusal route requested directly", refusalProblem(res), summary(res));
    });
  }

  if (redirectFrom) {
    await tryCase(`authored redirect ${redirectFrom}`, async () => {
      const res = await request(base, `${redirectFrom}?_rsc=abc&k=1`, { rsc: "1" });
      const location = String(res.headers.location ?? "");
      const problem =
        res.status !== 301
          ? `status ${res.status}, want 301`
          : (locationProblem(location) ?? (location.includes("k=1") ? null : `Location lost k=1: ${location}`));
      record(`authored redirect ${redirectFrom}`, problem, `${res.status} ${location}`);
    });
  }

  if (previewToken) {
    await tryCase("preview 307", async () => {
      const res = await request(
        base,
        `/?vivreal_preview=${encodeURIComponent(previewToken)}&_rsc=abc&k=1`,
        { rsc: "1" },
      );
      const location = String(res.headers.location ?? "");
      const problem = res.status !== 307 ? `status ${res.status}, want 307` : locationProblem(location);
      // Log the path only: the Location carries the preview token.
      record("preview 307", problem, `${res.status} ${location.split("?")[0]}`);
    });
  }

  return failures;
}

async function main() {
  const base = process.env.BASE;
  if (!base) {
    console.error("BASE is required, for example BASE=http://localhost:3000");
    process.exit(2);
  }
  const paths = (process.env.PATHS ?? "/").split(",").map((p) => p.trim()).filter(Boolean);
  const failures = await runProbes({
    base,
    paths,
    expectDefect: process.argv.includes("--expect-defect"),
    redirectFrom: process.env.REDIRECT_FROM,
    previewToken: process.env.PREVIEW_TOKEN,
    log: (line) => console.log(line),
  });
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAIL`);
  process.exit(failures === 0 ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
