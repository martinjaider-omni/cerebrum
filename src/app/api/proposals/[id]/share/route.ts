import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = crypto.randomBytes(32).toString('hex')
  await db.proposal.update({ where: { id: params.id }, data: { shareToken: token } })
  const url = `${process.env.NEXTAUTH_URL}/p/${token}`
  return NextResponse.json({ url, token })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.proposal.update({ where: { id: params.id }, data: { shareToken: null } })
  return NextResponse.json({ ok: true })
}
