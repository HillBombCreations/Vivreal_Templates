import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  resolveContactRecipient,
  resolveSiteContact,
  type SiteContact,
} from "./contactRecipient.ts";

/**
 * F1/F2 closure (`docs/projects/form-test-send/design.md` in `vivreal-hq`).
 * ALLOW/REFUSE pairs plus the control the finding itself describes.
 */

type FetchCall = { url: string; init: RequestInit };

let calls: FetchCall[] = [];
const realFetch = globalThis.fetch;
const realEnv = { ...process.env };

function stubFetch(reply: { status?: number; json: unknown } | Error) {
  calls = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.json), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  process.env.API_KEY = "test-key";
  process.env.SITE_ID = "site-123";
  process.env.NEXT_PUBLIC_CLIENT_API = "https://client.vivreal.io";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env.API_KEY = realEnv.API_KEY;
  process.env.SITE_ID = realEnv.SITE_ID;
  process.env.NEXT_PUBLIC_CLIENT_API = realEnv.NEXT_PUBLIC_CLIENT_API;
});

const siteDetailsEnvelope = (email: string, name = "The Bakery") => ({
  success: true,
  data: {
    name,
    businessInfo: { name, contactInfo: { email } },
    siteDetails: { values: {} },
  },
  error: null,
});

// ---------------------------------------------------------------------------
// resolveContactRecipient — pure, the seam the F1 finding is really about.
// ---------------------------------------------------------------------------

test("REFUSE: the resolved recipient has exactly one source, the site", () => {
  const site: SiteContact = { email: "owner@bakery.com", siteName: "The Bakery" };
  const result = resolveContactRecipient({}, site);
  assert.equal(result.to, "owner@bakery.com");
});

test("REFUSE: a body carrying a recipient-shaped field still resolves to the site's own address", () => {
  // The exact shape F1 describes: a request naming a stranger's address.
  // `resolveContactRecipient`'s own parameter type has no `contactEmail`
  // field — a caller passing a wider object (as the real route.ts does,
  // since `body` is the whole parsed JSON) still cannot make it read one.
  const site: SiteContact = { email: "owner@bakery.com", siteName: "The Bakery" };
  const attackerBody: { siteName?: string; branding?: SiteContact["branding"]; contactEmail: string } = {
    contactEmail: "attacker@evil.com",
  };
  const result = resolveContactRecipient(attackerBody, site);
  assert.equal(result.to, "owner@bakery.com", "the attacker's address must never win");
  assert.notEqual(result.to, "attacker@evil.com");
});

test("ALLOW (control): a normal submission with no recipient opinion in the body still reaches the owner", () => {
  const site: SiteContact = { email: "owner@bakery.com", siteName: "The Bakery" };
  const result = resolveContactRecipient({}, site);
  assert.equal(result.to, "owner@bakery.com");
});

test("F2: no site email configured resolves to an empty recipient, never a throw or a drop", () => {
  const site: SiteContact = { email: "", siteName: "The Bakery" };
  const result = resolveContactRecipient({}, site);
  assert.equal(result.to, "", "empty, not absent — the caller forwards regardless (F2)");
});

test("F2: a site lookup failure (null) degrades the same way as an unset email", () => {
  const result = resolveContactRecipient({}, null);
  assert.equal(result.to, "");
  assert.equal(result.siteName, "Vivreal Site");
});

test("siteName/branding are cosmetic: the body's values win when present (not security-relevant)", () => {
  const site: SiteContact = {
    email: "owner@bakery.com",
    siteName: "The Bakery",
    branding: { primary: "#111111" },
  };
  const result = resolveContactRecipient(
    { siteName: "Custom Name", branding: { primary: "#abcdef" } },
    site,
  );
  assert.equal(result.siteName, "Custom Name");
  assert.deepEqual(result.branding, { primary: "#abcdef" });
  // But the recipient is unaffected by any of this — same control as above.
  assert.equal(result.to, "owner@bakery.com");
});

test("siteName/branding fall back to the resolved site when the body has none", () => {
  const site: SiteContact = {
    email: "owner@bakery.com",
    siteName: "The Bakery",
    branding: { primary: "#111111" },
  };
  const result = resolveContactRecipient({}, site);
  assert.equal(result.siteName, "The Bakery");
  assert.deepEqual(result.branding, { primary: "#111111" });
});

// ---------------------------------------------------------------------------
// resolveSiteContact — the network half, fetch stubbed.
// ---------------------------------------------------------------------------

test("resolveSiteContact reads the recipient from VR_Client_API, keyed by SITE_ID only", async () => {
  stubFetch({ json: siteDetailsEnvelope("owner@bakery.com") });
  const result = await resolveSiteContact();

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/tenant\/siteDetails\?siteId=site-123$/);
  assert.equal(result?.email, "owner@bakery.com");
  assert.equal(result?.siteName, "The Bakery");
});

test("a request body cannot influence which siteId is looked up — there is no parameter for it", () => {
  // Structural: resolveSiteContact takes no arguments at all.
  assert.equal(resolveSiteContact.length, 0);
});

test("no SITE_ID configured resolves to null without a network call", async () => {
  delete process.env.SITE_ID;
  stubFetch({ json: siteDetailsEnvelope("owner@bakery.com") });
  const result = await resolveSiteContact();
  assert.equal(result, null);
  assert.equal(calls.length, 0, "must not call out with an undefined siteId");
});

test("an upstream non-2xx resolves to null, not a thrown error", async () => {
  stubFetch({ status: 500, json: { success: false } });
  assert.equal(await resolveSiteContact(), null);
});

test("a network failure resolves to null, not a thrown error", async () => {
  stubFetch(new TypeError("Failed to fetch"));
  assert.equal(await resolveSiteContact(), null);
});

test("a site with no contactInfo.email configured resolves email to empty, not undefined or a throw", async () => {
  stubFetch({
    json: {
      success: true,
      data: { name: "The Bakery", businessInfo: { name: "The Bakery" }, siteDetails: { values: {} } },
      error: null,
    },
  });
  const result = await resolveSiteContact();
  assert.equal(result?.email, "");
});
