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
  const BUCKET_NAME = process.env.BUCKET_NAME;
  const params = new URLSearchParams(req.nextUrl.search);

  const allow = new Set([
    "type",
    "groupBy[key]",
    "groupBy[value]",
  ]);

  for (const [k] of [...params]) if (!allow.has(k)) params.delete(k);

  const type = params.get("type") || "stripe";

  const groupByKey = params.get("groupBy[key]") || "filter-type";
  const groupByValue = params.get("groupBy[value]") || params.get("filterType") || params.get("filter") || "";

  const upstreamParams = new URLSearchParams();
  upstreamParams.set("type", type);

  if (groupByValue) {
    upstreamParams.set("groupBy[key]", groupByKey);
    upstreamParams.set("groupBy[value]", groupByValue);
  }

  const serverFetch = createServerFetchEdge({
    req,
    baseURL: "https://client.vivreal.io",
    timeoutMs: 15000,
    requestId,
    logger: (msg, meta) => edgeLogger?.info?.(msg, meta),
  });

  const upstreamPath = `/tenant/integrationObjects?${upstreamParams.toString()}`;

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

    const upstreamJson = await res.json();
    const toImageUrl = (key?: string) => {
      if (!key || typeof key !== "string") return "";
      return `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
    };

    const flattened = (Array.isArray(upstreamJson) ? upstreamJson : []).map((item: any) => {
      const objectValue = item?.objectValue ?? {};
      const productImage = objectValue?.productImage;
      let imageUrl: any = "";

      if (productImage && typeof productImage === "object" && !Array.isArray(productImage)) {
        const keys = Object.keys(productImage);

        if (typeof (productImage as any).key === "string") {
          imageUrl = toImageUrl((productImage as any).key);
        } else {
          const mapped: Record<string, string> = {};
          for (const v of keys) {
            const k = productImage?.[v]?.key;
            mapped[v] = toImageUrl(k);
          }
          imageUrl = mapped;
        }
      }

      return {
        usingVariant: item?.usingVariant,
        ...objectValue,
        imageUrl,
      };
    });

    const out = NextResponse.json(flattened, {
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