import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { fetchSaasMetrics } from '@/lib/stripe-metrics'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const metrics = await fetchSaasMetrics()
    if (!metrics) return NextResponse.json({ configured: false })
    return NextResponse.json({ configured: true, ...metrics })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error fetching metrics' }, { status: 500 })
  }
}
