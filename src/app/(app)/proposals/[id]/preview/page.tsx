import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { renderProposalHtml } from '@/lib/proposal-template'
import { LandingPromptButton } from '@/components/proposals/LandingPromptButton'

export default async function PreviewProposalPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const proposal = await db.proposal.findUnique({ where: { id: params.id } })
  if (!proposal) notFound()

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && proposal.ownerId !== session.user.id) notFound()

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
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <a
          href={`/proposals/${params.id}/edit`}
          className="text-sm text-gray-500 hover:text-gray-700 font-medium"
        >
          ← Editar
        </a>
        <div className="flex-1" />
        <span className="text-sm text-gray-400">{proposal.name}</span>
        <LandingPromptButton proposalId={params.id} />
        <a
          href={`/api/proposals/${params.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#3E95B0] hover:bg-[#255664] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          ↓ Descargar PDF
        </a>
      </div>

      {/* Document preview */}
      <div className="py-8 px-4">
        <div className="max-w-[900px] mx-auto shadow-xl rounded-lg overflow-hidden">
          <iframe
            srcDoc={html}
            className="w-full border-0"
            style={{ height: '100vh', minHeight: '900px' }}
            title={`Vista previa — ${proposal.name}`}
          />
        </div>
      </div>
    </div>
  )
}
