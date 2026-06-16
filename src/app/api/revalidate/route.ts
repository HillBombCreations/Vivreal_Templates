import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import crypto from "node:crypto";

// MUST be the Node.js runtime, not edge: revalidateTag drives the Next.js Data
// Cache and we use node:crypto timingSafeEqual for constant-time signature
// comparison.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/revalidate — on-change cache invalidation for THIS customer site.
 *
 * Consumes the existing Vivreal webhook system. When content is published/edited
 * in the portal, VR_CMS_API emits a webhook event (content.*, collection.*,
 * integration.*) and VR_Secure_API's webhookDelivery Lambda POSTs it here,
 * HMAC-signed with this site's webhook subscription secret. We verify the
 * signature, derive the affected cache tag(s), and call revalidateTag so the
 * next render re-fetches fresh data instead of waiting for the time-TTL backstop.
 *
 * Signature contract (must match VR_Secure_API/src/webhookDelivery/services/deliver.js):
 *   header  X-Vivreal-Signature: sha256=<hex(HMAC_SHA256(secret, rawBody))>
 *   header  X-Vivreal-Event:     <event type>
 *   body    { id, event, timestamp, data }
 *
 * INERT until REVALIDATE_WEBHOOK_SECRET is provisioned as an Amplify env var
 * (the same secret stored on the webhook subscription). With no secret set, the
 * route fails closed (401) and never invalidates — safe to ship ahead of the
 * backend wiring.
 *
 * Tag scheme (paired with clientFetchCached `tags`):
 *   site:<SITE_ID>          — site chrome (siteDetails / theme / nav / footer)
 *   collection:<refID>      — a specific collection's content
 *   integration:<type>      — a specific integration's objects (e.g. stripe)
 */

const SITE_ID = process.env.SITE_ID || "";

interface WebhookBody {
  id?: string;
  event?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

/** Constant-time compare of two hex signatures of equal expected length. */
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Derive the cache tags to invalidate from a webhook event. Returns the set of
 * tags whose cached entries should be dropped. Always includes the site-chrome
 * tag for site-level events; content/collection events also drop the specific
 * collection tag so a single edit invalidates exactly the affected reads.
 */
function tagsForEvent(event: string, data: Record<string, unknown> | undefined): string[] {
  const tags = new Set<string>();
  const siteTag = SITE_ID ? `site:${SITE_ID}` : null;

  if (event.startsWith("site.")) {
    if (siteTag) tags.add(siteTag);
  }

  if (event.startsWith("collection.") || event.startsWith("content.")) {
    // collectionObj.refID is the collection group id the object belongs to.
    const refID =
      (data?.collectionObj as Record<string, unknown> | undefined)?.refID ??
      data?.refID ??
      data?.collectionId ??
      (data?._id as unknown);
    if (typeof refID === "string" && refID) tags.add(`collection:${refID}`);
    // Collection structure changes can affect nav/labels shown in chrome.
    if (event.startsWith("collection.") && siteTag) tags.add(siteTag);
  }

  if (event.startsWith("integration.")) {
    const type = data?.type;
    if (typeof type === "string" && type) tags.add(`integration:${type}`);
  }

  return [...tags];
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: not yet provisioned. Never invalidate without verification.
    return NextResponse.json({ revalidated: false, error: "Not configured" }, { status: 401 });
  }

  const rawBody = await request.text();

  const header = request.headers.get("x-vivreal-signature") || "";
  const provided = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  if (!safeEqualHex(provided, expected)) {
    return NextResponse.json({ revalidated: false, error: "Invalid signature" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ revalidated: false, error: "Invalid body" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!event) {
    return NextResponse.json({ revalidated: false, error: "Missing event" }, { status: 400 });
  }

  const tags = tagsForEvent(event, body.data);
  for (const tag of tags) {
    // 'max' = stale-while-revalidate: serve stale once while the next render
    // refetches in the background, so an edit never produces a request stall.
    revalidateTag(tag, "max");
  }

  return NextResponse.json({ revalidated: true, event, tags, now: Date.now() });
}
