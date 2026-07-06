import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = (session.user as { role?: string }).role === 'admin'

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
  const skip = (page - 1) * limit
  const where = isAdmin ? {} : { ownerId: session.user.id }

  const [proposals, total] = await Promise.all([
    db.proposal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.proposal.count({ where }),
  ])
  return NextResponse.json({ data: proposals, total, page, limit })
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
