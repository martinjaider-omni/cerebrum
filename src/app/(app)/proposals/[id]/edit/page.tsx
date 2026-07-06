import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { ProposalEditor } from '@/components/proposals/ProposalEditor'

export default async function EditProposalPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  if (params.id === 'new') {
    const proposal = await db.proposal.create({
      data: {
        ownerId: session.user.id!,
        name: 'Nueva propuesta',
        features: ['wallet', 'loyalty', 'cdp', 'api', 'push', 'tpv'],
      },
    })
    redirect(`/proposals/${proposal.id}/edit`)
  }

  const proposal = await db.proposal.findUnique({ where: { id: params.id } })
  if (!proposal) notFound()

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && proposal.ownerId !== session.user.id) notFound()

  return <ProposalEditor initial={proposal} />
}
