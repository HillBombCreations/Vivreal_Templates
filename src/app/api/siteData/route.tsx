/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from 'next/server';
import { createServerFetchEdge } from '@/lib/server-fetch';
import { noStore } from '@/lib/utils/proxyUtils'
import { edgeLogger } from '@/lib/edge-logger';
import {
  CMSSiteData,
  SiteData
} from "@/types/SiteData";

export async function GET(req: NextRequest) {
  const requestId =
    req.headers.get('x-request-id') ??
    (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));

  const API_KEY = process.env.API_KEY;
  const SITE_ID = process.env.SITE_ID!;
  const BUCKET_NAME = process.env.BUCKET_NAME;

  const params = new URLSearchParams(req.nextUrl.search);
  const allow = new Set(['page', 'limit', 'search', 'sort', 'sort[field]', 'sort[direction]']);
  for (const [k] of [...params]) if (!allow.has(k)) params.delete(k);


  const serverFetch = createServerFetchEdge({
    req,
    baseURL: "https://client.vivreal.io",
    timeoutMs: 15000,
    requestId,
    logger: (msg, meta) => edgeLogger?.info?.(msg, meta),
  });

  const upstreamPath = `/tenant/baseSite?siteId=${encodeURIComponent(SITE_ID)}`;
  
  try {
    const res = await serverFetch(upstreamPath, {
      method: 'GET',
      headers: {
        Authorization: `${API_KEY}`,
        'x-request-id': requestId,
        'x-forwarded-host': req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '',
        'x-forwarded-proto': req.headers.get('x-forwarded-proto') ?? 'https',
        'Cache-Control': 'no-store',
      },
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    const contentType = res.headers.get('content-type') || 'application/json';
    if (!contentType.includes("application/json")) {
      const bodyText = await res.text();
      const out = new NextResponse(bodyText, {
        status: res.status,
        headers: { ...noStore({ "x-request-id": requestId }), "content-type": contentType },
      });
      return out;
    }

    const upstreamJson = (await res.json()) as CMSSiteData;

    const siteObj = {
      businessInfo: upstreamJson.businessInfo,
      name: upstreamJson.name,
      domainName: upstreamJson.domainName,
      siteDetails: upstreamJson.siteDetails.values,
      socialLinks: upstreamJson.socialLinks
    } as SiteData;
    
    const imageKey = siteObj?.siteDetails?.logo?.key;

    if (typeof imageKey === "string" && imageKey.length > 0) siteObj.siteDetails.logo.imageUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${imageKey}`;
    const out = NextResponse.json(siteObj, {
      status: res.status,
      headers: noStore({ "x-request-id": requestId }),
    });

    if (res.status < 200 || res.status >= 300) {
      edgeLogger.warn('collectionGroups(edge): upstream non-OK', { requestId, status: res.status });
    } else {
      edgeLogger.info('collectionGroups(edge): upstream OK', { requestId, status: res.status });
    }

    return out;
  } catch (err: any) {
    const kind = String(err?.message || err);
    edgeLogger.error('collectionGroups(edge): fetch failed', { requestId, err: kind });

    return NextResponse.json(
      { error: 'Bad Gateway', detail: kind },
      { status: 502, headers: noStore({ 'x-request-id': requestId }) }
    );
  }
}