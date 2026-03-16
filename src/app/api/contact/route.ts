import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface ContactPayload {
  name: string;
  contactEmail: string;
  customerEmail: string;
  message: string;
  siteName: string;
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

function buildBrandedEmail(body: ContactPayload): string {
  const primary = body.branding?.primary || "#1a1a2e";
  const surface = body.branding?.surface || "#f8f9fb";
  const textPrimary = body.branding?.textPrimary || "#1a1a2e";
  const logoUrl = body.branding?.logoUrl || "";
  const siteName = escapeHtml(body.siteName);
  const name = escapeHtml(body.name);
  const email = escapeHtml(body.customerEmail);
  const message = escapeHtml(body.message).replace(/\n/g, "<br>");

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

export async function POST(request: NextRequest) {
  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, customerEmail, message, siteName } = body;

  if (!name?.trim() || !customerEmail?.trim() || !message?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const to = body.contactEmail || "";
  if (!to) {
    return NextResponse.json(
      { error: "No contact email configured" },
      { status: 500 }
    );
  }

  const apiKey = process.env.API_KEY;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? "https://dev-client.vivreal.io";

  try {
    const res = await fetch(`${clientApiUrl}/tenant/sendContactEmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey ?? "",
      },
      body: JSON.stringify({
        name,
        to,
        message,
        siteName: siteName || "Vivreal Site",
        customHtml: buildBrandedEmail(body),
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
