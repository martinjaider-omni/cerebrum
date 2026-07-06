import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import crypto from 'crypto'

async function authorizeProposal(proposalId: string) {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized', status: 401 } as const
  const proposal = await db.proposal.findUnique({ where: { id: proposalId } })
  if (!proposal) return { error: 'Not found', status: 404 } as const
  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && proposal.ownerId !== session.user.id)
    return { error: 'Forbidden', status: 403 } as const
  return { proposal, session } as const
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await authorizeProposal(params.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const token = crypto.randomBytes(32).toString('hex')
  await db.proposal.update({ where: { id: params.id }, data: { shareToken: token } })
  const url = `${process.env.NEXTAUTH_URL}/p/${token}`
  return NextResponse.json({ url, token })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await authorizeProposal(params.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  await db.proposal.update({ where: { id: params.id }, data: { shareToken: null } })
  return NextResponse.json({ ok: true })
}
