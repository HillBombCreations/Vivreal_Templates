/**
 * Recipient resolution for `POST /api/contact` (the `security-hotfix F1`
 * closure, `docs/projects/form-test-send/design.md` in `vivreal-hq`).
 *
 * Pure (`resolveContactRecipient`) or network-only-via-`fetchWithReconnect`
 * (`resolveSiteContact`) on purpose: `route.ts` imports `next/server`, which
 * the plain-Node test runner cannot load, so this is the half with the
 * behaviour worth pinning — same split as `src/lib/delivery/quoteRequest.ts`.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE. The recipient a contact-form email
 * goes to must come ONLY from this site's own server-resolved contact info.
 * Before this file existed, `route.ts` let the request body's `contactEmail`
 * win outright, so anyone could POST to any customer site's `/api/contact`
 * naming a stranger's address and have Vivreal's own email account send that
 * stranger a message branded as the business, up to the per-site rate limit.
 * `resolveContactRecipient` never reads `body` for a recipient — not even as
 * a fallback — so that stays true regardless of what route.ts is handed.
 *
 * WHY `fetchWithReconnect` (idle-dead-socket-research-2026-10-04.md)
 * ---------------------------------------------------------------------
 * This read bypassed the shared reconnect helper until 2026-10-04, so the
 * post-thaw window that `./api/fetchWithReconnect.ts` exists for hit this
 * exact fetch with no retry: the owner's recipient lookup failed, `route.ts`
 * omitted `contactEmail`, and VR_Client_API stored the submission without
 * emailing anyone — while the visitor still saw success (F2 is working as
 * designed; the recipient was simply never looked up a second time). This
 * module stays Sentry-free (see the split above), so a lookup that still
 * fails after retries reports through `onFailure` instead of vanishing: the
 * caller (`route.ts`, which already imports `next/server` and can import
 * Sentry) is what actually records it.
 */
import { DEFAULT_BACKOFF_MS, fetchWithReconnect } from './api/fetchWithReconnect.ts';

/** Why `resolveSiteContact` gave up without a recipient. Passed to
 * `onFailure` so a caller that CAN alert (route.ts) knows whether there was
 * anything to alert about — a site with no `SITE_ID` is a build-time
 * condition, not a lost lead, and must not page anyone. */
export type ContactLookupFailureReason = 'network' | 'http-error';

export interface SiteContact {
  email: string;
  siteName: string;
  branding?: {
    primary?: string;
    surface?: string;
    textPrimary?: string;
    logoUrl?: string;
  };
}

export interface ResolveSiteContactOptions {
  /**
   * Called when the VR_Client_API read fails (after `fetchWithReconnect`'s
   * retries are exhausted, or a non-2xx response). NOT called when `SITE_ID`
   * is simply unset — that is a build-time condition, every request to this
   * site would "fail" the same way, and it is not a lost lead. This module
   * stays Sentry-free (see the file header), so a caller that can import
   * Sentry (`route.ts`) is what turns this into an alert.
   */
  readonly onFailure?: (reason: ContactLookupFailureReason, detail: unknown) => void;
}

/**
 * Resolve the site's contact recipient + name + branding from VR_Client_API,
 * keyed by this build's `SITE_ID` env var — never by anything a caller sends.
 * Returns `null` on any failure (no `SITE_ID`, network error, non-2xx) so the
 * caller degrades to "no recipient configured" rather than guessing one.
 */
export async function resolveSiteContact(
  options: ResolveSiteContactOptions = {},
): Promise<SiteContact | null> {
  const apiKey = process.env.API_KEY;
  const siteId = process.env.SITE_ID;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";
  if (!siteId) return null;

  try {
    const res = await fetchWithReconnect(
      `${clientApiUrl}/tenant/siteDetails?siteId=${encodeURIComponent(siteId)}`,
      { headers: { Authorization: apiKey ?? "" }, cache: "no-store" },
      { label: "contactRecipient", backoffMs: DEFAULT_BACKOFF_MS },
    );
    if (!res.ok) {
      options.onFailure?.("http-error", res.status);
      return null;
    }

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
  } catch (err) {
    options.onFailure?.("network", err);
    return null;
  }
}

export interface ContactRecipient {
  /**
   * "" when the site has no contact email configured. NEVER the visitor's
   * address, and never anything read off the request body — see the file
   * header. A caller must treat an empty `to` as "store, don't send"
   * (F2), never as a reason to drop the submission.
   */
  to: string;
  siteName: string;
  branding: SiteContact["branding"];
}

/**
 * Resolve the one true recipient plus the cosmetic (non-security) fields a
 * legacy caller (`ContactSection`) may still supply.
 *
 * `siteName` / `branding` are NOT security-relevant — they only change how
 * the email looks in the OWNER's own inbox, never where it goes — so those
 * two still prefer whatever the body supplied, falling back to the
 * server-resolved site. `to` has exactly one source: `site`.
 */
export function resolveContactRecipient(
  body: { siteName?: string; branding?: SiteContact["branding"] },
  site: SiteContact | null
): ContactRecipient {
  return {
    to: (site?.email ?? "").trim(),
    siteName: body.siteName?.trim() || site?.siteName || "Vivreal Site",
    branding: body.branding ?? site?.branding,
  };
}
