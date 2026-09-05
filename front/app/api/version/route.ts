import { NextResponse } from 'next/server'
import { BUILD_ID } from '@/app/lib/build-id'

// The one route that must never be cached: it exists to report what the server
// is serving right now. A cached answer would hide the very deploy we look for.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
