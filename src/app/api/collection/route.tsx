/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { createServerFetchEdge } from "@/lib/server-fetch";
import { noStore } from "@/lib/proxyUtils";
import { edgeLogger } from "@/lib/edge-logger";

export async function GET(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ??
    (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));

  const API_KEY = process.env.API_KEY;
  const PRODUCT_COLLECTION_ID = process.env.PRODUCT_COLLECTION_ID || "";

  const upstreamParams = new URLSearchParams();
  upstreamParams.set("cid", PRODUCT_COLLECTION_ID);

  const serverFetch = createServerFetchEdge({
    req,
    baseURL: "https://client.vivreal.io",
    timeoutMs: 15000,
    requestId,
    logger: (msg, meta) => edgeLogger?.info?.(msg, meta),
  });

  const upstreamPath = `/tenant/collection?${upstreamParams.toString()}`;

  try {
    const res = await serverFetch(upstreamPath, {
      method: "GET",
      headers: {
        Authorization: `${API_KEY}`,
        "x-request-id": requestId,
        "x-forwarded-host": req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
        "x-forwarded-proto": req.headers.get("x-forwarded-proto") ?? "https",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      next: { revalidate: 0 },
    });

    const contentType = res.headers.get("content-type") || "application/json";

    if (!contentType.includes("application/json")) {
      const bodyText = await res.text();
      return new NextResponse(bodyText, {
        status: res.status,
        headers: {
          ...noStore({ "x-request-id": requestId }),
          "content-type": contentType,
        },
      });
    }

    const upstreamJson = (await res.json())[0] as any;

    const filterGroups = upstreamJson?.schema?.filterGroups || [];
    const out = NextResponse.json(filterGroups, {
      status: res.status,
      headers: noStore({ "x-request-id": requestId }),
    });

    if (res.status < 200 || res.status >= 300) {
      edgeLogger.warn("products(edge): upstream non-OK", { requestId, status: res.status, upstreamPath });
    } else {
      edgeLogger.info("products(edge): upstream OK", { requestId, status: res.status, upstreamPath });
    }

    return out;
  } catch (err: any) {
    const kind = err?.name === "AbortError" ? "Timeout/AbortError" : String(err?.message || err);
    edgeLogger.error("products(edge): fetch failed", { requestId, err: kind });

    return NextResponse.json(
      { error: "Bad Gateway", detail: kind },
      { status: 502, headers: noStore({ "x-request-id": requestId }) }
    );
  }
}