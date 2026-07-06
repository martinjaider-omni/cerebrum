import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteFile, getFileUrl } from '@/lib/storage'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asset = await db.asset.findUnique({
    where: { id: params.id },
    include: { proposal: { select: { ownerId: true } } },
  })
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && asset.proposal.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ ...asset, url: getFileUrl(asset.storageKey) })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asset = await db.asset.findUnique({
    where: { id: params.id },
    include: { proposal: { select: { ownerId: true } } },
  })
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && asset.proposal.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await deleteFile(asset.storageKey)
  await db.asset.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
