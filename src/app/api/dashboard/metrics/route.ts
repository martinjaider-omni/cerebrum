import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { fetchSaasMetrics, clearCache } from '@/lib/stripe-metrics'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ?refresh=1 to force cache invalidation
  if (req.nextUrl.searchParams.get('refresh')) clearCache()

  try {
    const metrics = await fetchSaasMetrics()
    if (!metrics) return NextResponse.json({ configured: false })
    return NextResponse.json({ configured: true, ...metrics })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error fetching metrics' }, { status: 500 })
  }
}
