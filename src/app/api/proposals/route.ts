import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const proposals = await db.proposal.findMany({
    where: isAdmin ? {} : { ownerId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(proposals)
}

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const proposal = await db.proposal.create({
    data: {
      ownerId: session.user.id!,
      name: 'Nueva propuesta',
      features: ['wallet', 'loyalty', 'cdp', 'api', 'push', 'tpv'],
    },
  })
  return NextResponse.json(proposal, { status: 201 })
}
