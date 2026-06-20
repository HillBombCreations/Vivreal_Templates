/**
 * /feeds/schedule.ics — public iCalendar (RFC 5545) subscribe feed proxy.
 *
 * Forwards GET to VR_Client_API's `/sites/:siteId/feeds/schedule.ics` using
 * this site's per-site API_KEY from Amplify env vars. The renderer's Schedule
 * page "Subscribe" button points a `webcal://<domain>/feeds/schedule.ics` URL
 * at this same-origin route, which injects the API key server-side.
 *
 * Caching: unlike the llms.txt proxy (no-store), a schedule feed is polled
 * forever by third-party calendar infra. We serve it through Next's Data Cache
 * with `next: { revalidate: 3600 }` (paired with the upstream's
 * Cache-Control: max-age=3600 and its trackApiUsage bypass) so repeated polls
 * are served from cache and don't hammer VR_Client_API + Mongo. The route
 * segment is therefore NOT `force-dynamic` (that would disable the data cache).
 *
 * Auth header is the raw API_KEY (no "Bearer" prefix).
 */
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const revalidate = 3600;

const EMPTY_VCALENDAR = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Vivreal//Schedule Feed//EN',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'END:VCALENDAR',
  '',
].join('\r\n');

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.API_KEY;
  const siteId = process.env.SITE_ID;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? 'https://client.vivreal.io';

  // Unconfigured site: return a valid EMPTY calendar (200) rather than an
  // error so a subscribed calendar client doesn't choke on a 5xx.
  if (!apiKey || !siteId) {
    return new NextResponse(EMPTY_VCALENDAR, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  }

  try {
    const upstream = await fetch(
      `${clientApiUrl}/sites/${encodeURIComponent(siteId)}/feeds/schedule.ics`,
      {
        method: 'GET',
        headers: {
          Authorization: apiKey,
          Accept: 'text/calendar',
        },
        next: { revalidate: 3600 },
      }
    );

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ??
          'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':
          upstream.headers.get('cache-control') ??
          'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch {
    // On an upstream failure, still hand back a valid empty calendar so a
    // subscribed client degrades gracefully instead of erroring.
    return new NextResponse(EMPTY_VCALENDAR, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  }
}
