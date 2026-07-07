import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { syncBatchToAttio } from '@/lib/prospecting'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batch = await db.prospectingBatch.findUnique({ where: { id: params.id } })
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && batch.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (batch.status !== 'done')
    return NextResponse.json({ error: 'El batch debe estar completado para sincronizar' }, { status: 400 })

  try {
    const result = await syncBatchToAttio(params.id)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error sincronizando con Attio' },
      { status: 500 }
    )
  }
}
