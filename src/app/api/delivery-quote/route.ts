import { NextRequest, NextResponse } from 'next/server';
import { prepareDeliveryQuoteRequest } from '@/lib/delivery/quoteRequest';

/**
 * POST /api/delivery-quote — "do you deliver to my ZIP, roughly what does it
 * cost, and how much notice do you need."
 *
 * A THIN proxy. The ZIP centroid table, the distance maths and the calendar
 * arithmetic all live in VR_Client_API, and nothing about them is in this
 * bundle:
 *
 *  - ~33,000 US ZIP centroids in every customer site's JavaScript is roughly a
 *    quarter of a megabyte on every page of every site in the fleet, for a
 *    feature most of them do not use. It also means a ZIP data update is a
 *    fleet-wide rebuild instead of one Lambda deploy.
 *  - The renderer has no network access by design; dynamic behaviour reaches it
 *    through an injected adapter, and this route is what backs that adapter.
 *  - Rate limiting already exists upstream and is the reason the compute goes
 *    there rather than here. See below.
 *
 * RATE LIMITING, stated precisely. VR_Client_API applies a DynamoDB-backed
 * limiter (60 requests / 60s, fail-open) to its `/sites/:siteId/*` routes, plus
 * the per-group monthly API cap `handleTenantRoutes` already meters. That is
 * why the upstream path is under `/sites/:siteId/` and not `/tenant/`: the
 * `/tenant/` routes carry no limiter, and this endpoint is public and
 * unauthenticated. Building a token bucket here instead would have been a
 * second, weaker limiter next to a real one.
 *
 * What that limiter actually scopes today is worth being honest about: it keys
 * on API Gateway's `requestContext.identity.sourceIp`, which for every request
 * arriving through this proxy is the site's Amplify egress IP. So it is a
 * generous per-SITE ceiling, not a per-visitor one, exactly as VR_Client_API's
 * own schedule-feed limiter documents. The visitor IP is forwarded anyway so
 * the upstream can narrow the scope later without a change on this side.
 *
 * RUNTIME: `edge`, chosen rather than inherited. Routes in this repo declare
 * their runtime per route and both values are in use: `revalidate` and
 * `preview/enable` are `nodejs` because they need Node APIs. This one reads a
 * body, tests a string against a regex and forwards, which is nothing
 * Node-only, and it is the fourth route in this repo whose entire job is
 * forwarding to VR_Client_API. The other three (`checkout`, `contact`,
 * `validate-coupon`) plus `/mcp` are all `edge`, and a public unauthenticated
 * endpoint benefits from the smaller cold start.
 *
 * NO CORS, also deliberate. The delivery block runs on the customer's own site
 * and calls this same-origin. `/mcp` allows any origin because browser-side
 * agent clients genuinely call it cross-origin; nothing here does, and an open
 * CORS policy on an unauthenticated endpoint is surface for no gain.
 */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * The upstream contract, fixed with the sibling repos:
 *   POST {CLIENT_API}/sites/{siteId}/delivery-quote
 *   body  { zip, zones?, originZip?, deliveryDays?, ... }
 *   reply { ...resolved dates... }
 *
 * Under `/sites/:siteId/` rather than `/tenant/` because that is where the
 * rate limiter is mounted.
 */
const UPSTREAM_PATH = 'delivery-quote';

/**
 * The visitor's IP, read the way every public edge route in this ecosystem
 * reads it. `CloudFront-Viewer-Address` carries `ip:port` and CloudFront
 * strips `x-real-ip`, so that header is never consulted.
 */
function visitorIp(request: NextRequest): string {
  const viewer = request.headers.get('cloudfront-viewer-address');
  if (viewer) {
    // IPv6 arrives bracketed (`[2001:db8::1]:443`); take everything before the
    // final colon and unwrap.
    const lastColon = viewer.lastIndexOf(':');
    const address = lastColon > 0 ? viewer.slice(0, lastColon) : viewer;
    return address.replace(/^\[|\]$/g, '');
  }
  return request.headers.get('x-forwarded-for') ?? '';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.API_KEY;
  const siteId = process.env.SITE_ID;
  const clientApiUrl = process.env.NEXT_PUBLIC_CLIENT_API ?? 'https://client.vivreal.io';

  if (!apiKey || !siteId) {
    return NextResponse.json(
      { error: 'Delivery checking is not set up for this site' },
      { status: 503 },
    );
  }

  const prepared = prepareDeliveryQuoteRequest(await request.text());
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  }

  const forwardedFor = visitorIp(request);

  let upstream: Response;
  try {
    upstream = await fetch(
      `${clientApiUrl}/sites/${encodeURIComponent(siteId)}/${UPSTREAM_PATH}`,
      {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        },
        body: JSON.stringify(prepared.body),
        cache: 'no-store',
      },
    );
  } catch {
    // Deliberately no upstream detail in the response. This endpoint is public
    // and unauthenticated, and an error string from a Lambda is not something
    // to hand an anonymous caller. The renderer owns what a visitor reads; a
    // failed lookup is our problem, never a rejection of them.
    return NextResponse.json({ error: 'Could not check delivery right now' }, { status: 502 });
  }

  // The response is relayed as TEXT, unparsed and untrimmed. The quote carries
  // resolved calendar dates rather than a day count, and re-serialising a body
  // is how a field quietly changes shape on the way through.
  const text = await upstream.text();
  const cacheControl = upstream.headers.get('cache-control');
  const retryAfter = upstream.headers.get('retry-after');

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      // Passed through rather than invented: the endpoint that computed the
      // answer is the one that knows how long it stays true.
      ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
      // So the block can back off on a 429 instead of hammering.
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    },
  });
}
