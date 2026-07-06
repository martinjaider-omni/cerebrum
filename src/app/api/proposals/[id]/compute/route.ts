import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { compute } from '@/lib/pricing'
import { z } from 'zod'

const schema = z.object({
  ordersOnline: z.number().int().min(0),
  ordersOffline: z.number().int().min(0),
  offlineRegPct: z.number().min(0).max(100),
  activityFactor: z.number().min(0),
  channelOnline: z.boolean(),
  channelStore: z.boolean(),
  techCrm: z.string(),
  features: z.array(z.string()),
  implPace: z.enum(['rapida', 'estandar', 'holgada']),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = compute(parsed.data)
  return NextResponse.json(result)
}
