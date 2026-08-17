import { NextResponse, NextRequest } from 'next/server'
import { computeBotVerdict, BOT_VERDICT_HEADER } from '@/lib/botVerdict'

const PREVIEW_QUERY_PARAM = 'vivreal_preview'
const PREVIEW_REQUEST_HEADER = 'x-vivreal-preview-token'

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)

  // Capture the portal preview-bypass token from the inbound URL and surface
  // it to server components as a request header. server-side fetches in
  // lib/api/client.ts read it via next/headers and relay to VR_Client_API.
  // The portal appends `?vivreal_preview=<token>` to the iframe src and the
  // "Visit Site" link; this is the only point where it crosses from the
  // user's browser into the SSR request context.
  const previewToken = request.nextUrl.searchParams.get(PREVIEW_QUERY_PARAM)
  if (previewToken) {
    requestHeaders.set(PREVIEW_REQUEST_HEADER, previewToken)
  }

  // Task 14 item 2 (dashboard-insights-phase-3-capture/plan.md, D7) --
  // compute the visitor bot verdict ONCE, here at the edge, where the
  // inbound request still carries the real user-agent. lib/api/client.ts
  // relays the VERDICT (never the raw UA) on the product read.
  requestHeaders.set(BOT_VERDICT_HEADER, computeBotVerdict(request.headers.get('user-agent')))

  return NextResponse.next({ request: { headers: requestHeaders } })
}
