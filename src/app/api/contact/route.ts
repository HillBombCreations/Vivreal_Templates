import { NextRequest, NextResponse } from "next/server";
import { mergeAttributionCustomFields } from "@/lib/leadAttribution";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface ContactPayload {
  name: string;
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
  const primary = body.branding?.primary || "#1a1a2e";
  const surface = body.branding?.surface || "#f8f9fb";
  const textPrimary = body.branding?.textPrimary || "#1a1a2e";
  const logoUrl = body.branding?.logoUrl || "";
  const siteName = escapeHtml(body.siteName);
  const name = escapeHtml(body.name);
  const email = escapeHtml(body.customerEmail);
  const message = escapeHtml(body.message).replace(/\n/g, "<br>");
  const customFieldsBlock = buildCustomFieldsBlock(body.customFields, primary);

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${siteName}" width="140" height="auto" style="display:block;margin:0 auto;" />`
    : `<span style="font-size:22px;font-weight:700;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:-0.5px;">${siteName}</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${surface};font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${surface};padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding:0 0 32px 0;">
              ${logoBlock}
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

                <!-- Accent bar -->
                <tr>
                  <td style="height:4px;background:${primary};font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Badge -->
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
                </tr>

                <!-- Bottom padding -->
                <tr>
                  <td style="padding:32px 0 0 0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;" align="center">
              <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.5;">
                This email was sent from the contact form on your<br>${siteName} website, powered by <a href="https://vivreal.io" style="color:${primary};text-decoration:none;">Vivreal</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Resolve the site's contact recipient + name + branding from VR_Client_API.
 *
 * The renderer's contact form (ConfigurableForm) posts only
 * `{ name, email, message, customerEmail }` — it never sends the recipient,
 * site name, or branding. So we read them server-side from this site's
 * siteDetails (same source `getSiteData()` uses), keyed by the SITE_ID env.
 * Returns null on any failure so the caller can fall back to body values.
 */
async function resolveSiteContact(): Promise<{
  email: string;
  siteName: string;
  branding: ContactPayload["branding"];
} | null> {
  const apiKey = process.env.API_KEY;
  const siteId = process.env.SITE_ID;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";
  if (!siteId) return null;

  try {
    const res = await fetch(
      `${clientApiUrl}/tenant/siteDetails?siteId=${encodeURIComponent(siteId)}`,
      { headers: { Authorization: apiKey ?? "" }, cache: "no-store" }
    );
    if (!res.ok) return null;

    const json = await res.json();
    // VR_Client_API returns the { success, data } envelope (or the raw object).
    const data = (json?.data ?? json) as {
      name?: string;
      businessInfo?: { name?: string; contactInfo?: { email?: string } };
      siteDetails?: { values?: Record<string, unknown> };
    };
    const values = (data?.siteDetails?.values ?? {}) as Record<string, unknown>;
    const logo = values.logo as { currentFile?: { source?: string } } | undefined;

    return {
      email: data?.businessInfo?.contactInfo?.email ?? "",
      siteName: data?.businessInfo?.name ?? data?.name ?? "",
      branding: {
        primary: values.primary as string | undefined,
        surface: values["surface-alt"] as string | undefined,
        textPrimary: values["text-primary"] as string | undefined,
        logoUrl: logo?.currentFile?.source,
      },
    };
  } catch {
    return null;
  }
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

  // Body values (legacy ContactSection sends them) win; otherwise resolve from
  // siteData — the renderer's form omits recipient / siteName / branding. Only
  // hit the (heavy, API/CDN-metered) siteDetails endpoint when the recipient
  // wasn't supplied, so the legacy path costs no extra upstream call.
  const site = body.contactEmail?.trim() ? null : await resolveSiteContact();

  const to = (body.contactEmail?.trim() || site?.email || "").trim();
  if (!to) {
    return NextResponse.json(
      { error: "No contact email configured" },
      { status: 500 }
    );
  }

  const siteName = body.siteName?.trim() || site?.siteName || "Vivreal Site";
  const branding = body.branding ?? site?.branding;
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

  try {
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
        contactEmail: to,
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
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 502 }
    );
  }
}
