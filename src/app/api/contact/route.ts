import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { upstreamErrorForVisitor } from "@/lib/upstreamErrorText";
import { mergeAttributionCustomFields } from "@/lib/leadAttribution";
import { resolveContactRecipient, resolveSiteContact } from "@/lib/contactRecipient";
import {
  CONTACT_RECIPIENT_FAILURE_MESSAGE,
  CONTACT_REJECTED_MESSAGE,
  buildContactRecipientFailureCapture,
  buildContactRejectionCapture,
} from "@/lib/api/errorCapture";
import { createCaptureThrottle } from "@/lib/api/captureThrottle";
import {
  classifyContactForm,
  isBlankText,
  messageToForward,
  missingRequiredContactFields,
  withFormTypeMarker,
  type ContactFormType,
  type RequiredContactField,
} from "@/lib/contactSubmission";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface ContactPayload {
  name: string;
  /**
   * NEVER READ. `buildBrandedEmail()` does not use this field; it exists on
   * the type only because `enriched` (built below) spreads `body` and then
   * overwrites this key with the server-resolved `to`. The actual recipient
   * comes exclusively from `resolveContactRecipient()` (`@/lib/contactRecipient`)
   * — see the F1 comment at its call site. A caller-supplied value here is
   * always overwritten before the request upstream is built and is never
   * consulted for where the email goes.
   */
  contactEmail: string;
  customerEmail: string;
  message: string;
  /**
   * F607 (release C, SW-C3): accepted from an older form and type-checked
   * (`resolveContactRecipient` trims it), but NEVER forwarded. VR_Client_API
   * builds the owner's email from the stored business (its name, logo and
   * colours), so nothing a visitor sends can shape that mail.
   */
  siteName: string;
  /**
   * v0.7.0 (`@hillbombcreations/site-renderer`): any form field that
   * isn't `name` / `email` / `message` is parked here under its
   * configured `key`. Backward-compat: when absent, the email renders
   * exactly as it did pre-v0.7.0.
   */
  customFields?: Record<string, unknown>;
  /**
   * Honeypot (Task 14 item 4b, dashboard-insights-phase-3-capture/plan.md,
   * E-c/F7) — forwarded VERBATIM when the renderer's `ConfigurableForm`
   * sends one (item 4a: same key on both submit modes now). Absent from
   * `ContactSection`'s own hand-written payload today (no honeypot field
   * there). `company_website` matches the renderer's
   * `REVIEW_HONEYPOT_FIELD` constant and VR_Client_API's
   * `sendContactEmailValidator` key — the validator must accept this key
   * BEFORE the renderer bump ships (deploy-order note in the plan).
   */
  company_website?: string;
  /** F607: accepted from an older form and type-checked, never forwarded (see `siteName`). */
  branding?: {
    primary?: string;
    surface?: string;
    textPrimary?: string;
    logoUrl?: string;
  };
}

/**
 * At most one Sentry capture per process per 5 minutes for each kind of
 * refused submission (stage, form type, missing names or upstream status),
 * the same throttle `client.ts` uses for failing reads: a flood of one bad
 * shape costs one event, while a different kind still gets its own. Module
 * scope so it outlives a request.
 */
const CONTACT_REJECTION_CAPTURES = createCaptureThrottle();

/**
 * Tell Sentry a submission was refused, by field NAME and status only (see
 * `buildContactRejectionCapture`). Returns whether a capture was queued, so
 * the caller knows to flush it before the response: this route runs on the
 * edge, and Amplify can freeze the instance the moment the response is sent.
 */
function captureRejection(details: {
  formType: ContactFormType;
  stage: "missing-fields" | "upstream-rejected";
  missingFields?: readonly RequiredContactField[];
  upstreamStatus?: number;
}): boolean {
  const key = [
    details.stage,
    details.formType,
    details.missingFields?.join(",") ?? "",
    details.upstreamStatus ?? "",
  ].join(":");
  const gate = CONTACT_REJECTION_CAPTURES.take(key);
  if (!gate.capture) return false;
  Sentry.captureMessage(
    CONTACT_REJECTED_MESSAGE,
    buildContactRejectionCapture({ ...details, siteId: process.env.SITE_ID, suppressed: gate.suppressed }),
  );
  return true;
}

export async function POST(request: NextRequest) {
  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, customerEmail } = body;

  // vivreal-hq research-admin-inbound-2026-10-21.md: the renderer fills
  // `message` from a form's first textarea, which on /migrate is the OPTIONAL
  // notes box, so a migration request (a non-empty `customFields.siteUrl`) may
  // arrive with a blank message and is accepted. A plain contact message still
  // needs one. See `@/lib/contactSubmission`.
  const formType = classifyContactForm(body.customFields);
  const missingFields = missingRequiredContactFields(body, formType);
  if (missingFields.length > 0) {
    // A refused submission is a lost lead, so it reaches Sentry (by field
    // name, never value). A filled honeypot is a bot, not a lead: no capture.
    if (isBlankText(body.company_website) && captureRejection({ formType, stage: "missing-fields", missingFields })) {
      await Sentry.flush(1500);
    }
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }
  // VR_Client_API refuses an empty `message` (`Joi.string().required()`), so a
  // migration request with no notes sends a fixed sentence instead.
  const message = messageToForward(body.message);

  // review-templates-184.md P2-1: `resolveContactRecipient()` runs
  // `body.siteName?.trim()`, which throws a TypeError on a non-string value
  // (optional chaining only guards null/undefined, not the wrong type).
  // Reject it here, before the lookup and before anything can be flushed,
  // so a hostile or malformed body gets an honest 400 instead of surfacing
  // as a 502 "upstream failure" that never happened. `branding` is checked
  // the same way: since F607 it is never forwarded, so a non-object value
  // cannot throw, but letting it past validation here is the same kind of
  // silent acceptance this check exists to close off.
  // review-templates-184.md P3-3: `null` reads as absent here, the same way
  // `resolveContactRecipient()` already treats it (`body.siteName?.trim()`,
  // `body.branding ?? site?.branding`, both nullish-safe). `!= null` lets
  // only `undefined` and `null` skip the type check; `0`, `""`, `false` and
  // every other value is still type-checked, so a `null` reads as absent
  // instead of a 400 that no real sender posts today but that downstream
  // code already tolerates.
  if (body.siteName != null && typeof body.siteName !== "string") {
    return NextResponse.json({ error: "Invalid siteName" }, { status: 400 });
  }
  if (
    body.branding != null &&
    (typeof body.branding !== "object" || Array.isArray(body.branding))
  ) {
    return NextResponse.json({ error: "Invalid branding" }, { status: 400 });
  }

  // F1 (security hotfix, docs/projects/form-test-send/design.md): the
  // recipient is resolved ONLY from this site's own stored contact info,
  // server-side, on every request. `body.contactEmail` used to win outright
  // when present, which let anyone POST a stranger's address here and have
  // this site's own email account mail them, branded as the business.
  // resolveContactRecipient() never reads `body` for `to` — see its header —
  // so that is no longer possible regardless of what the request carries.
  // F607 (release C, SW-C3): the body's siteName and branding are no longer
  // sent upstream at all, and neither is an email of this route's making.
  // VR_Client_API builds the owner's email from the stored business.
  // 2026-10-04 idle-dead-socket fix: `resolveSiteContact` now retries a
  // dead-connection failure on a fresh socket (`fetchWithReconnect`), but a
  // lookup that still fails must not vanish — it means this submission is
  // about to be stored without emailing the owner (F2, below). Alert here
  // rather than inside `contactRecipient.ts`, which stays Sentry-free on
  // purpose (see its header) so it is loadable by the plain-node test runner.
  let recipientLookupFailed = false;
  // review-templates-183.md concern 4 (and concern 6): this route is
  // `runtime = "edge"`, and nothing else flushes a queued Sentry envelope
  // before the response — Amplify can freeze the container the instant it is
  // sent. Declared here (not yet started) so the `finally` below always has
  // something to await, no matter how early the request fails.
  // review-templates-184.md item 1: between the old flush-start point and
  // the old `try`, a throw skipped the await entirely. Everything that can
  // still throw for this request now lives inside the `try` below, and the
  // `finally` awaits the flush on every exit from it: success, a non-2xx
  // upstream reply, or the catch block. The one throw that reached here
  // before, `resolveContactRecipient()`'s `body.siteName?.trim()` on a
  // non-string `siteName`, no longer can: P2-1 rejects that body above with
  // a 400 before this point, so the `try` no longer has a known way in.
  let flushPromise: Promise<unknown> = Promise.resolve();

  try {
    const site = await resolveSiteContact({
      onFailure: (reason) => {
        recipientLookupFailed = true;
        Sentry.captureMessage(
          CONTACT_RECIPIENT_FAILURE_MESSAGE,
          buildContactRecipientFailureCapture({ siteId: process.env.SITE_ID, reason }),
        );
      },
    });
    // Started here, on the failure branch ONLY, so it costs nothing on the
    // happy path. Deliberately NOT awaited yet: it runs CONCURRENTLY with
    // the upstream POST below, so the visitor pays roughly the slower of the
    // two instead of their sum.
    flushPromise = recipientLookupFailed ? Sentry.flush(1500) : Promise.resolve();
    const { to } = resolveContactRecipient(body, site);

    // F2: a submission is never dropped for lack of a configured recipient.
    // Forward it regardless — VR_Client_API already stores every contact
    // submission independently of whether the email leg runs
    // (captureContactMessage) and treats "stored but not emailed" as success.
    // `contactEmail` is OMITTED (not sent as "") below when `to` is empty, so
    // VR_Client_API can tell "no recipient configured" apart from a malformed
    // one. The visitor sees the same success response either way.
    // C4 — fold the visitor's FIRST touch into customFields, read SERVER-SIDE
    // from the `vr_attr` cookie on this same-origin POST. customFields already
    // flows both into the branded lead email (buildCustomFieldsBlock) and into
    // the stored contact document, so one merge attributes /contact and /migrate
    // at once. Never clobbers a submitted field of the same name (a contact form
    // can legitimately carry its own `source` question), and returns the original
    // reference when no cookie is present — byte-identical to today's payload for
    // every fleet site, where `vr_attr` does not exist.
    //
    // Receiving validator verified before shipping: VR_Client_API's
    // sendContactEmailValidator declares `customFields: Joi.object().unknown(true)
    // .max(40)`, so these string keys are accepted with headroom to spare.
    //
    // `formType` (contact or migration) is added on Vivreal's own sites only,
    // so the admin inbound page can label stored rows; customer sites forward
    // exactly what they did before. VR_Client_API stores it as
    // `objectValue.formType` (`strict: false`), no schema change.
    const customFields = withFormTypeMarker(
      mergeAttributionCustomFields(
        body.customFields,
        request.headers.get("cookie"),
        process.env.SITE_ID,
      ),
      formType,
      process.env.SITE_ID,
    );
    const apiKey = process.env.API_KEY;
    const clientApiUrl =
      process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";

    const res = await fetch(`${clientApiUrl}/tenant/sendContactEmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey ?? "",
      },
      // F607 (release C, SW-C3): no `siteName` and no `customHtml`. The owner's
      // email takes the business name, logo and colours from the stored
      // business (VR_Client_API), never from this request; Client accepts and
      // ignores both old keys for one deploy window, so this order is safe
      // only with Client deployed first (the runbook's order).
      body: JSON.stringify({
        name,
        message,
        // F2: omitted (never "") when no recipient is configured, so
        // `JSON.stringify` drops the key entirely rather than sending an
        // empty string VR_Client_API's validator would reject the same way
        // it rejects a missing one.
        ...(to ? { contactEmail: to } : {}),
        customerEmail,
        // Task 14 item 1 (dashboard-insights-phase-3-capture/plan.md, E-a) —
        // both keys are OPTIONAL on the Joi validator (Task 8 step 1), so an
        // old site build (neither key) and a new API stay compatible in
        // both directions. `siteId` removes the multi-site resolution
        // ambiguity (rung 1); `customFields` are structured form fields
        // that today exist only inside the email HTML. `JSON.stringify`
        // drops an `undefined` value, so an absent SITE_ID/customFields
        // simply omits the key rather than sending a null placeholder.
        siteId: process.env.SITE_ID || undefined,
        customFields,
        // Task 14 item 4b — forward the honeypot verbatim when present.
        company_website: body.company_website,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // VR_Client_API answers 2xx whenever it stored the submission, so a
      // non-2xx means nothing was kept. Status only: its error body can quote
      // the value it refused.
      if (captureRejection({ formType, stage: "upstream-rejected", upstreamStatus: res.status })) {
        flushPromise = Sentry.flush(1500);
      }
      return NextResponse.json(
        { error: upstreamErrorForVisitor(data, "Failed to send message") },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // P2-1: `next.config.ts`'s `withSentryConfig` only auto-captures a
    // rejected route handler; returning here instead of rethrowing means
    // nothing records this failure unless it is captured explicitly.
    Sentry.captureException(err);
    // Re-point `flushPromise` at a fresh flush rather than trust the one
    // already in flight: `recipientLookupFailed` can still be false here
    // (the site lookup succeeded and the UPSTREAM post is what threw), in
    // which case `flushPromise` is still the inert `Promise.resolve()`
    // declared above, and awaiting that would not send this event before
    // Amplify can freeze the container.
    flushPromise = Sentry.flush(1500);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 502 }
    );
  } finally {
    await flushPromise;
  }
}
