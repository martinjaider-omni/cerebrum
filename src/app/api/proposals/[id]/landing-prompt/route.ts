import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateLandingPrompt } from '@/lib/landing-prompt'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const proposal = await db.proposal.findUnique({ where: { id: params.id } })
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && proposal.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const prompt = generateLandingPrompt({
    clientName: proposal.clientName,
    clientUrl: proposal.clientUrl,
    clientSector: proposal.clientSector,
    clientContact: proposal.clientContact,
    channelOnline: proposal.channelOnline,
    channelStore: proposal.channelStore,
    ordersOnline: proposal.ordersOnline,
    ordersOffline: proposal.ordersOffline,
    offlineRegPct: proposal.offlineRegPct,
    activityFactor: proposal.activityFactor,
    techEcommerce: proposal.techEcommerce,
    techPos: proposal.techPos,
    techCrm: proposal.techCrm,
    features: proposal.features as string[],
    implPace: proposal.implPace as 'rapida' | 'estandar' | 'holgada',
    dualPlanEnabled: (proposal as Record<string, unknown>).dualPlanEnabled as boolean ?? false,
    dualPlanFeatures: (proposal as Record<string, unknown>).dualPlanFeatures as string[] ?? [],
    brandPrimary: proposal.brandPrimary,
    brandSecondary: proposal.brandSecondary,
    brandLogoUrl: proposal.brandLogoUrl,
    message: proposal.message,
    enterpriseEnabled: proposal.enterpriseEnabled,
    enterpriseMonthlyFee: proposal.enterpriseMonthlyFee,
  })

  return NextResponse.json({ prompt })
}
