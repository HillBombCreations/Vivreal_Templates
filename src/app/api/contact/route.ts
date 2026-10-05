import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { mergeAttributionCustomFields } from "@/lib/leadAttribution";
import { resolveContactRecipient, resolveSiteContact } from "@/lib/contactRecipient";
import {
  CONTACT_RECIPIENT_FAILURE_MESSAGE,
  buildContactRecipientFailureCapture,
} from "@/lib/api/errorCapture";
import { resolveTenantBrand, wrapInTenantLayout } from "@hillbombcreations/email-brand";

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
  branding?: {
    primary?: string;
    surface?: string;
    textPrimary?: string;
    logoUrl?: string;
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanizeKey(key: string): string {
  // Convert camelCase / snake_case / kebab-case to "Title Case"
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderCustomFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return String(value);
}

function buildCustomFieldsBlock(
  customFields: Record<string, unknown> | undefined,
  primary: string,
): string {
  if (!customFields) return "";
  const entries = Object.entries(customFields).filter(([, v]) => {
    const rendered = renderCustomFieldValue(v);
    return rendered.length > 0;
  });
  if (entries.length === 0) return "";

  const rows = entries
    .map(([key, value]) => {
      const label = escapeHtml(humanizeKey(key));
      const rendered = escapeHtml(renderCustomFieldValue(value)).replace(/\n/g, "<br>");
      return `
        <tr>
          <td style="padding:0 0 12px 0;">
            <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-family:'Helvetica Neue',Arial,sans-serif;display:block;margin-bottom:4px;">${label}</span>
            <span style="font-size:14px;color:#374151;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.5;">${rendered}</span>
          </td>
        </tr>`;
    })
    .join("");

  // Subtle ${primary}-tinted card, sits between Message and Reply CTA.
  return `
    <tr>
      <td style="padding:16px 36px 0 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${primary}08;border-radius:12px;border:1px solid ${primary}1a;">
          <tr>
            <td style="padding:18px 20px 6px 20px;">
              <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;color:${primary};font-family:'Helvetica Neue',Arial,sans-serif;display:block;margin-bottom:12px;">Additional details</span>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildBrandedEmail(body: ContactPayload): string {
  // The chrome (logo header, card, accent bar, footer) comes from
  // @hillbombcreations/email-brand. It carries the SITE's colours and logo and
  // nothing of Vivreal's, which is what makes this email look like it came from
  // the business the visitor actually contacted. The words and the layout of
  // the message itself stay here, because they are this route's job and
  // nobody else's.
  //
  // resolveTenantBrand also validates: a stored `primary` that is not a hex
  // colour used to flow straight into a `style=` attribute, and a stored logo
  // URL straight into an `src=`. Both now fall back rather than render.
  const brand = resolveTenantBrand({
    name: body.siteName,
    primary: body.branding?.primary,
    surface: body.branding?.surface,
    textPrimary: body.branding?.textPrimary,
    logoUrl: body.branding?.logoUrl,
  });
  const { primary, textPrimary } = brand;
  const siteName = escapeHtml(body.siteName);
  const name = escapeHtml(body.name);
  const email = escapeHtml(body.customerEmail);
  const message = escapeHtml(body.message).replace(/\n/g, "<br>");
  const customFieldsBlock = buildCustomFieldsBlock(body.customFields, primary);

  return wrapInTenantLayout({
    brand,
    bodyHtml: `<!-- Badge -->
                <tr>
                  <td style="padding:32px 36px 0 36px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:${primary}12;border-radius:20px;padding:6px 14px;">
                          <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;color:${primary};font-family:'Helvetica Neue',Arial,sans-serif;">New Message</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td style="padding:20px 36px 0 36px;">
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:${textPrimary};font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.3;">
                      Contact form submission
                    </h1>
                    <p style="margin:8px 0 0 0;font-size:15px;color:#6b7280;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.5;">
                      Someone reached out through your ${siteName} website.
                    </p>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:24px 36px 0 36px;">
                    <hr style="border:none;border-top:1px solid #f0f0f0;margin:0;">
                  </td>
                </tr>

                <!-- Sender info -->
                <tr>
                  <td style="padding:24px 36px 0 36px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="48" valign="top" style="padding-right:16px;">
                          <div style="width:48px;height:48px;border-radius:24px;background-color:${primary};text-align:center;line-height:48px;">
                            <span style="font-size:18px;font-weight:600;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">${name.charAt(0).toUpperCase()}</span>
                          </div>
                        </td>
                        <td valign="center">
                          <span style="font-size:16px;font-weight:600;color:${textPrimary};font-family:'Helvetica Neue',Arial,sans-serif;display:block;line-height:1.3;">${name}</span>
                          <a href="mailto:${email}" style="font-size:14px;color:${primary};text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;display:block;margin-top:2px;">${email}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Message body -->
                <tr>
                  <td style="padding:20px 36px 0 36px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border-radius:12px;border:1px solid #f0f0f0;">
                      <tr>
                        <td style="padding:20px 24px;">
                          <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-family:'Helvetica Neue',Arial,sans-serif;display:block;margin-bottom:10px;">Message</span>
                          <p style="margin:0;font-size:15px;color:#374151;line-height:26px;font-family:'Helvetica Neue',Arial,sans-serif;">${message}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${customFieldsBlock}

                <!-- Reply CTA -->
                <tr>
                  <td style="padding:28px 36px 0 36px;" align="center">
                    <a href="mailto:${email}?subject=Re: ${siteName} Contact Form" style="display:inline-block;background-color:${primary};color:#ffffff;font-size:14px;font-weight:600;font-family:'Helvetica Neue',Arial,sans-serif;text-decoration:none;padding:12px 32px;border-radius:8px;line-height:1;">Reply to ${name.split(" ")[0]}</a>
                  </td>
                </tr>`,
    footerHtml: `This email was sent from the contact form on your<br>${siteName} website, powered by <a href="https://vivreal.io" style="color:${primary};text-decoration:none;">Vivreal</a>.`,
  });
}

export async function POST(request: NextRequest) {
  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, customerEmail, message } = body;

  if (!name?.trim() || !customerEmail?.trim() || !message?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // review-templates-184.md P2-1: `resolveContactRecipient()` runs
  // `body.siteName?.trim()`, which throws a TypeError on a non-string value
  // (optional chaining only guards null/undefined, not the wrong type).
  // Reject it here, before the lookup and before anything can be flushed,
  // so a hostile or malformed body gets an honest 400 instead of surfacing
  // as a 502 "upstream failure" that never happened. `branding` is checked
  // the same way: it only ever feeds template strings below, so a non-object
  // value cannot throw, but letting it past validation here is the same kind
  // of silent acceptance this check exists to close off.
  if (body.siteName !== undefined && typeof body.siteName !== "string") {
    return NextResponse.json({ error: "Invalid siteName" }, { status: 400 });
  }
  if (
    body.branding !== undefined &&
    (typeof body.branding !== "object" || body.branding === null || Array.isArray(body.branding))
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
  // siteName/branding are cosmetic (legacy ContactSection compatibility),
  // not security-relevant, and still prefer the body when present.
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
    const { to, siteName, branding } = resolveContactRecipient(body, site);

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
    const customFields = mergeAttributionCustomFields(
      body.customFields,
      request.headers.get("cookie"),
    );
    const enriched: ContactPayload = { ...body, contactEmail: to, siteName, branding, customFields };

    const apiKey = process.env.API_KEY;
    const clientApiUrl =
      process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";

    const res = await fetch(`${clientApiUrl}/tenant/sendContactEmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey ?? "",
      },
      body: JSON.stringify({
        name,
        message,
        siteName,
        // F2: omitted (never "") when no recipient is configured, so
        // `JSON.stringify` drops the key entirely rather than sending an
        // empty string VR_Client_API's validator would reject the same way
        // it rejects a missing one.
        ...(to ? { contactEmail: to } : {}),
        customerEmail,
        customHtml: buildBrandedEmail(enriched),
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
      return NextResponse.json(
        { error: data.error ?? "Failed to send message" },
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
