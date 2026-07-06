import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const source = await db.proposal.findUnique({ where: { id: params.id } })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && source.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const copy = await db.proposal.create({
    data: {
      name: `${source.name} (copia)`,
      status: 'draft',
      ownerId: session.user.id!,
      clientName: source.clientName,
      clientUrl: source.clientUrl,
      clientSector: source.clientSector,
      clientContact: source.clientContact,
      clientDemoDate: source.clientDemoDate,
      channelOnline: source.channelOnline,
      channelStore: source.channelStore,
      ordersOnline: source.ordersOnline,
      ordersOffline: source.ordersOffline,
      offlineRegPct: source.offlineRegPct,
      activityFactor: source.activityFactor,
      techEcommerce: source.techEcommerce,
      techPos: source.techPos,
      techCrm: source.techCrm,
      features: source.features,
      implPace: source.implPace,
      enterpriseEnabled: source.enterpriseEnabled,
      enterpriseMonthlyFee: source.enterpriseMonthlyFee,
      enterpriseTerm: source.enterpriseTerm,
      enterpriseIncludes: source.enterpriseIncludes,
      brandLogoUrl: source.brandLogoUrl,
      brandPrimary: source.brandPrimary,
      brandSecondary: source.brandSecondary,
      brandPalette: source.brandPalette,
      message: source.message,
    },
  })

  return NextResponse.json(copy, { status: 201 })
}
