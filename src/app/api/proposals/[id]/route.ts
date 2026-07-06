import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(200),
  status: z.enum(['draft', 'final']),
  clientName: z.string().max(200),
  clientUrl: z.string().max(500),
  clientSector: z.string().max(200),
  clientContact: z.string().max(200),
  clientDemoDate: z.coerce.date().nullable(),
  channelOnline: z.boolean(),
  channelStore: z.boolean(),
  ordersOnline: z.number().int().min(0),
  ordersOffline: z.number().int().min(0),
  offlineRegPct: z.number().int().min(0).max(100),
  activityFactor: z.number().min(0).max(10),
  techEcommerce: z.string().max(200),
  techPos: z.string().max(200),
  techCrm: z.string().max(200),
  features: z.array(z.string().max(50)),
  implPace: z.enum(['rapida', 'estandar', 'holgada']),
  enterpriseEnabled: z.boolean(),
  enterpriseMonthlyFee: z.number().int().min(0).nullable(),
  enterpriseTerm: z.string().max(50),
  enterpriseIncludes: z.array(z.string().max(100)),
  brandLogoUrl: z.string().max(500).nullable(),
  brandPrimary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  brandSecondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  brandPalette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)),
  message: z.string().max(5000),
  overrides: z.record(z.unknown()),
  computed: z.record(z.unknown()),
}).partial()

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
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const updated = await db.proposal.update({ where: { id: params.id }, data: parsed.data })
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
