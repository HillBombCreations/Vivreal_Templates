import { NextResponse, NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const logData = {
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(request.headers.entries()),
  }

    // Log to console (local dev and some hosts like Vercel)
    console.log('[Middleware] Request:', JSON.stringify(logData, null, 2))

    // Optional: send to your own logging endpoint
    //   await fetch('https://your-domain.com/api/log', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(logData),
    //   }).catch((err) => {
    //     // Avoid crashing middleware on logging failure
    //     console.error('Logging to /api/log failed:', err)
    //   })

  return NextResponse.next()
}
