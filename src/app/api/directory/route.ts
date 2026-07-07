import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = 30
  const skip = (page - 1) * limit

  const where = q
    ? {
        OR: [
          { inputName: { contains: q, mode: 'insensitive' as const } },
          { domain: { contains: q, mode: 'insensitive' as const } },
          { people: { some: { fullName: { contains: q, mode: 'insensitive' as const } } } },
        ],
      }
    : {}

  const [companies, total] = await Promise.all([
    db.prospectCompany.findMany({
      where,
      include: {
        people: {
          where: { status: 'done' },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.prospectCompany.count({ where }),
  ])

  return NextResponse.json({ data: companies, total, page, limit })
}
