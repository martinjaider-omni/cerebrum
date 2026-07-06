import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { processBatch } from '@/lib/prospecting'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const batches = await db.prospectingBatch.findMany({
    where: isAdmin ? {} : { ownerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { companies: true } } },
    take: 50,
  })
  return NextResponse.json(batches)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companies, source } = await req.json() as { companies: string[]; source: 'text' | 'csv' }

  if (!Array.isArray(companies) || companies.length === 0)
    return NextResponse.json({ error: 'companies array required' }, { status: 400 })

  if (companies.length > 200)
    return NextResponse.json({ error: 'Max 200 companies per batch' }, { status: 400 })

  const batch = await db.prospectingBatch.create({
    data: {
      ownerId: session.user.id!,
      source: source ?? 'text',
      status: 'queued',
      companies: {
        create: companies
          .map((name) => name.trim())
          .filter(Boolean)
          .map((inputName) => ({ inputName })),
      },
    },
  })

  // Fire and forget — process in background
  processBatch(batch.id).catch((err) =>
    console.error(`[prospecting] batch ${batch.id} failed:`, err)
  )

  return NextResponse.json(batch, { status: 201 })
}
