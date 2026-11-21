/**
 * What a reader that runs no scripts sees on a page (F323; vivreal-hq
 * docs/projects/next-release-C/design-home-pages.md 4.3).
 *
 * One measure shared by the unit test, the build check (`isr-build-check.mjs`
 * `checkNoScriptReads`) and the live probe:
 *
 *   node scripts/no-script-read.mjs <url>... [--json <file>]
 *
 * Read only. Prints per URL: status, `x-nextjs-cache`, `cache-control`, first
 * and last byte in ms, the measure and the verdict. `--json` writes the record.
 * Exit 1 when any URL fails the verdict.
 */
import http from "node:http";
import https from "node:https";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** At least this share of the page's text must be visible without scripts (today's homes read 0.000 to 0.042). */
export const NO_SCRIPT_RATIO_MIN = 0.9;
export const PROBE_USER_AGENT = "Mozilla/5.0 (vivreal F323 no-script read)";
const TIMEOUT_MS = 30000;

function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The measure. Remove `<script>`, `<style>` and `<template>` elements; take the
 * part after `<body`; cut at the first React hidden segment `<div hidden id="S:`;
 * strip tags; collapse whitespace.
 */
export function readWithoutScripts(html) {
  const pendingBoxes = (html.match(/<!--\$\?-->/g) ?? []).length;
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<template\b[\s\S]*?<\/template>/gi, "");
  const bodyAt = cleaned.search(/<body[\s>]/i);
  const body = bodyAt === -1 ? cleaned : cleaned.slice(bodyAt);
  const hiddenAt = body.indexOf('<div hidden id="S:');
  const visiblePart = hiddenAt === -1 ? body : body.slice(0, hiddenAt);
  const hiddenPart = hiddenAt === -1 ? "" : body.slice(hiddenAt);
  const visibleText = stripTags(visiblePart);
  const hiddenText = stripTags(hiddenPart);
  return {
    visibleChars: visibleText.length,
    hiddenChars: hiddenText.length,
    h1Visible: /<h1[\s>]/i.test(visiblePart),
    pendingBoxes,
    skeletonVisible: visiblePart.includes("animate-pulse"),
    visibleText,
  };
}

/** The verdict: an `<h1>` visible, the visible ratio at least the floor, and every `mustShow` string visible. */
export function passesWithoutScripts(result, mustShow = []) {
  const reasons = [];
  if (!result.h1Visible) reasons.push("no <h1> in the visible part (the <h1> is hidden or absent)");
  const total = result.visibleChars + result.hiddenChars;
  const ratio = total === 0 ? 0 : result.visibleChars / total;
  if (ratio < NO_SCRIPT_RATIO_MIN) {
    reasons.push(
      `visible ratio ${ratio.toFixed(3)} below ${NO_SCRIPT_RATIO_MIN} (${result.visibleChars} visible, ${result.hiddenChars} hidden)`,
    );
  }
  for (const text of mustShow) {
    if (!result.visibleText.includes(text)) reasons.push(`"${text}" is not in the visible text`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** One read: GET with no scripts run, timing first and last byte. */
export function fetchPage(url) {
  const target = new URL(url);
  const lib = target.protocol === "https:" ? https : http;
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const req = lib.request(
      target,
      { method: "GET", headers: { "user-agent": PROBE_USER_AGENT, "accept-encoding": "identity" } },
      (res) => {
        const chunks = [];
        let firstByteMs = null;
        res.on("data", (c) => {
          if (firstByteMs === null) firstByteMs = Math.round(performance.now() - started);
          chunks.push(c);
        });
        res.on("end", () =>
          resolve({
            url,
            status: res.statusCode ?? 0,
            nextCache: res.headers["x-nextjs-cache"] ?? null,
            cacheControl: res.headers["cache-control"] ?? null,
            firstByteMs,
            lastByteMs: Math.round(performance.now() - started),
            html: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        res.on("error", reject);
      },
    );
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`timeout after ${TIMEOUT_MS} ms`)));
    req.on("error", reject);
    req.end();
  });
}

async function main(argv) {
  const urls = [];
  let jsonFile = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") jsonFile = argv[++i];
    else urls.push(argv[i]);
  }
  if (urls.length === 0) {
    console.error("usage: node scripts/no-script-read.mjs <url>... [--json <file>]");
    return 2;
  }
  const records = [];
  let failed = 0;
  for (const url of urls) {
    const page = await fetchPage(url);
    const { html, ...meta } = page;
    const { visibleText, ...measure } = readWithoutScripts(html);
    const verdict = passesWithoutScripts({ ...measure, visibleText }, []);
    if (!verdict.ok) failed++;
    const record = { ...meta, ...measure, verdict };
    records.push(record);
    console.log(
      [
        url,
        page.status,
        `x-nextjs-cache=${page.nextCache ?? "-"}`,
        `cache-control=${page.cacheControl ?? "-"}`,
        `first=${page.firstByteMs}ms last=${page.lastByteMs}ms`,
        `visible=${measure.visibleChars} hidden=${measure.hiddenChars} h1Visible=${measure.h1Visible}`,
        `pendingBoxes=${measure.pendingBoxes} skeletonVisible=${measure.skeletonVisible}`,
        verdict.ok ? "PASS" : `FAIL (${verdict.reasons.join("; ")})`,
      ].join(" | "),
    );
  }
  if (jsonFile) writeFileSync(jsonFile, JSON.stringify(records, null, 2));
  return failed === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(2);
    },
  );
}
