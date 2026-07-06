import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { renderProposalHtml } from '@/lib/proposal-template'
import chromiumPkg from '@sparticuz/chromium'
import { chromium } from 'playwright-core'

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const proposal = await db.proposal.findUnique({ where: { shareToken: params.token } })
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const html = renderProposalHtml(
    {
      id: proposal.id,
      name: proposal.name,
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
      enterpriseEnabled: proposal.enterpriseEnabled,
      enterpriseMonthlyFee: proposal.enterpriseMonthlyFee,
      enterpriseTerm: proposal.enterpriseTerm,
      enterpriseIncludes: proposal.enterpriseIncludes as string[],
      brandLogoUrl: proposal.brandLogoUrl,
      brandPrimary: proposal.brandPrimary,
      brandSecondary: proposal.brandSecondary,
      brandPalette: proposal.brandPalette as string[],
      message: proposal.message,
    },
    baseUrl
  )

  const executablePath = await chromiumPkg.executablePath()
  const browser = await chromium.launch({
    executablePath,
    args: [...chromiumPkg.args, '--no-sandbox'],
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    const filename = `propuesta-${proposal.clientName || proposal.id}.pdf`
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } finally {
    await browser.close()
  }
}
