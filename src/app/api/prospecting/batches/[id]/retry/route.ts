import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { processBatch } from '@/lib/prospecting'
import { enqueueBatch } from '@/lib/queue'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batch = await db.prospectingBatch.findUnique({ where: { id: params.id } })
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && batch.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (batch.status !== 'error' && batch.status !== 'done')
    return NextResponse.json({ error: 'Solo se pueden reintentar batches con estado error o done' }, { status: 400 })

  // Reset failed/pending companies to pending so they get reprocessed
  await db.prospectCompany.updateMany({
    where: { batchId: params.id, status: { in: ['error', 'pending'] } },
    data: { status: 'pending', error: null },
  })

  // Reset batch status
  await db.prospectingBatch.update({
    where: { id: params.id },
    data: {
      status: 'queued',
      counts: { companies: 0, people: 0, phones: 0, errors: 0 },
    },
  })

  // Launch processing
  if (process.env.REDIS_URL) {
    await enqueueBatch(params.id)
  } else {
    processBatch(params.id).catch((err) =>
      console.error(`[prospecting] retry batch ${params.id} failed:`, err)
    )
  }

  return NextResponse.json({ ok: true, status: 'queued' })
}
