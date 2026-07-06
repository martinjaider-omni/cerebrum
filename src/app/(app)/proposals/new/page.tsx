import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function NewProposalPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const proposal = await db.proposal.create({
    data: {
      ownerId: session.user.id!,
      name: 'Nueva propuesta',
      features: ['wallet', 'loyalty', 'cdp', 'api', 'push', 'tpv'],
    },
  })
  redirect(`/proposals/${proposal.id}/edit`)
}
