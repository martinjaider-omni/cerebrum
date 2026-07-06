import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { processBatch } from '@/lib/prospecting'
import { enqueueBatch } from '@/lib/queue'
import { z } from 'zod'

const batchSchema = z.object({
  companies: z.array(z.string().max(200)).min(1).max(200),
  source: z.enum(['text', 'csv']).default('text'),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
  const skip = (page - 1) * limit
  const where = isAdmin ? {} : { ownerId: session.user.id }

  const [batches, total] = await Promise.all([
    db.prospectingBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { companies: true } } },
      skip,
      take: limit,
    }),
    db.prospectingBatch.count({ where }),
  ])
  return NextResponse.json({ data: batches, total, page, limit })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { companies, source } = parsed.data

  const batch = await db.prospectingBatch.create({
    data: {
      ownerId: session.user.id!,
      source,
      status: 'queued',
      companies: {
        create: companies
          .map((name) => name.trim())
          .filter(Boolean)
          .map((inputName) => ({ inputName })),
      },
    },
  })

  // Use BullMQ if Redis is available, otherwise fire-and-forget
  if (process.env.REDIS_URL) {
    await enqueueBatch(batch.id)
  } else {
    processBatch(batch.id).catch((err) =>
      console.error(`[prospecting] batch ${batch.id} failed:`, err)
    )
  }

  return NextResponse.json(batch, { status: 201 })
}
