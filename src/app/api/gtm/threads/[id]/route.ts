import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thread = await db.gtmThread.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!thread || thread.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(thread)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thread = await db.gtmThread.findUnique({ where: { id: params.id } })
  if (!thread || thread.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.gtmThread.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
