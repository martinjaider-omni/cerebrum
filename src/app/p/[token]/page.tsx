import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { renderProposalHtml } from '@/lib/proposal-template'

export default async function PublicProposalPage({ params }: { params: { token: string } }) {
  const proposal = await db.proposal.findUnique({ where: { shareToken: params.token } })
  if (!proposal) notFound()

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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Public top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shadow-sm">
        <span className="text-sm font-semibold text-gray-800">
          {proposal.clientName || proposal.name}
        </span>
        <span className="text-xs text-gray-400">· Propuesta OmniWallet</span>
        <div className="flex-1" />
        <a
          href={`/api/p/${params.token}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          ↓ Descargar PDF
        </a>
      </div>

      {/* Document */}
      <div className="py-8 px-4">
        <div className="max-w-[900px] mx-auto shadow-xl rounded-lg overflow-hidden">
          <iframe
            srcDoc={html}
            className="w-full border-0"
            style={{ height: '100vh', minHeight: '900px' }}
            title={proposal.name}
          />
        </div>
      </div>
    </div>
  )
}
