import { NextResponse, NextRequest } from 'next/server'

const PREVIEW_QUERY_PARAM = 'vivreal_preview'
const PREVIEW_REQUEST_HEADER = 'x-vivreal-preview-token'

export async function middleware(request: NextRequest) {
  // Capture the portal preview-bypass token from the inbound URL and surface
  // it to server components as a request header. server-side fetches in
  // lib/api/client.ts read it via next/headers and relay to VR_Client_API.
  // The portal appends `?vivreal_preview=<token>` to the iframe src and the
  // "Visit Site" link; this is the only point where it crosses from the
  // user's browser into the SSR request context.
  const previewToken = request.nextUrl.searchParams.get(PREVIEW_QUERY_PARAM)
  if (previewToken) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(PREVIEW_REQUEST_HEADER, previewToken)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}
