// A test file that `network-test-guard.test.mjs` runs ON ITS OWN, in a child
// `node --import ./scripts/aws-test-guard.mjs --test <this file>`, the way a
// targeted run is made. Its name does not end in `.test.mjs`, so `npm test`
// never collects it.
//
// Its only off-machine target is 203.0.113.10, an address in TEST-NET-3
// (RFC 5737) that is never routed, given as an IP literal, so there is no DNS
// lookup either. The parent runs it only when the guard is installed.
import { test } from "node:test";
import https from "node:https";

test("swallows an off-machine request, as a best-effort caller does", async () => {
  await new Promise((resolve) => {
    const req = https.get({ host: "203.0.113.10", port: 443, path: "/", timeout: 2000 }, () => resolve("answered"));
    req.on("timeout", () => req.destroy(new Error("timed out")));
    // Swallowed on purpose: the guard's record is what must still fail this file.
    req.on("error", () => resolve("refused"));
  });
});
