import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const batch = await db.prospectingBatch.findUnique({
      where: { id: params.id },
      include: {
        companies: {
          include: { people: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isAdmin = (session.user as { role?: string }).role === 'admin'
    if (!isAdmin && batch.ownerId !== session.user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json(batch)
  } catch (err) {
    console.error('Batch detail query failed:', err)
    return NextResponse.json({ error: 'Database error — run pending migrations' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batch = await db.prospectingBatch.findUnique({ where: { id: params.id } })
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && batch.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.prospectingBatch.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
