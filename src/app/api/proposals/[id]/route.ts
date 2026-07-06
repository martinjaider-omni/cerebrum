import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

async function getProposalOrFail(id: string, userId: string, isAdmin: boolean) {
  const proposal = await db.proposal.findUnique({ where: { id } })
  if (!proposal) return null
  if (!isAdmin && proposal.ownerId !== userId) return null
  return proposal
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const proposal = await getProposalOrFail(params.id, session.user.id!, isAdmin)
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(proposal)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const existing = await getProposalOrFail(params.id, session.user.id!, isAdmin)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const updated = await db.proposal.update({ where: { id: params.id }, data: body })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const existing = await getProposalOrFail(params.id, session.user.id!, isAdmin)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.proposal.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
