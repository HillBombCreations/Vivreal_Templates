/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { createServerFetchEdge } from "@/lib/server-fetch";
import { noStore } from "@/lib/utils/proxyUtils";
import { edgeLogger } from "@/lib/edge-logger";

type ContactPayload = {
  name: string;
  contactEmail: string;
  customerEmail: string;
  message: string;
  siteName: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export async function POST(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ??
    (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));

  const API_KEY = process.env.API_KEY;
  const API_URL = "https://client.vivreal.io";

  if (!API_KEY) {
    edgeLogger.error("contact(edge): missing API_KEY", { requestId });
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500, headers: noStore({ "x-request-id": requestId }) }
    );
  }

  const serverFetch = createServerFetchEdge({
    req,
    baseURL: API_URL,
    timeoutMs: 15000,
    requestId,
    logger: (msg, meta) => edgeLogger?.info?.(msg, meta),
  });

  let body: ContactPayload;
  try {
    body = (await req.json()) as ContactPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: noStore({ "x-request-id": requestId }) }
    );
  }

  if (
    !isNonEmptyString(body?.name) ||
    !isNonEmptyString(body?.contactEmail) ||
    !isNonEmptyString(body?.message) ||
    !isNonEmptyString(body?.siteName) ||
    !isNonEmptyString(body?.customerEmail)
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400, headers: noStore({ "x-request-id": requestId }) }
    );
  }

  const upstreamPath = "/tenant/sendContactEmail";

  try {
    const res = await serverFetch(upstreamPath, {
      method: "POST",
      headers: {
        Authorization: `${API_KEY}`,
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-forwarded-host":
          req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
        "x-forwarded-proto": req.headers.get("x-forwarded-proto") ?? "https",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      next: { revalidate: 0 },
      body: JSON.stringify({
        name: body.name,
        message: body.message,
        siteName: body.siteName,
        contactEmail: body.contactEmail,
        customerEmail: body.customerEmail
      }),
    });

    const contentType = res.headers.get("content-type") || "application/json";

    if (!contentType.includes("application/json")) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { ...noStore({ "x-request-id": requestId }), "content-type": contentType },
      });
    }

    const upstreamJson = await res.json().catch(() => null);

    const out = NextResponse.json(upstreamJson ?? { ok: res.ok }, {
      status: res.status,
      headers: noStore({ "x-request-id": requestId }),
    });

    if (!res.ok) {
      edgeLogger.warn("contact(edge): upstream non-OK", { requestId, status: res.status });
    } else {
      edgeLogger.info("contact(edge): upstream OK", { requestId, status: res.status });
    }

    return out;
  } catch (err: any) {
    const kind =
      err?.name === "AbortError" ? "Timeout/AbortError" : String(err?.message || err);
    edgeLogger.error("contact(edge): fetch failed", { requestId, err: kind });

    return NextResponse.json(
      { error: "Bad Gateway", detail: kind },
      { status: 502, headers: noStore({ "x-request-id": requestId }) }
    );
  }
}