import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ProspectingPanel, type BatchRow } from '@/components/prospecting/ProspectingPanel'

export default async function ProspectingPage() {
  const session = await auth()
  const isAdmin = (session?.user as { role?: string })?.role === 'admin'

  const [batches, settings] = await Promise.all([
    db.prospectingBatch.findMany({
      where: isAdmin ? {} : { ownerId: session?.user?.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { companies: true } } },
      take: 50,
    }),
    db.integrationSettings.findFirst(),
  ])

  const configured = !!(settings?.apolloApiKey)

  return (
    <ProspectingPanel
      initialBatches={batches as unknown as BatchRow[]}
      configured={configured}
      isAdmin={isAdmin}
    />
  )
}
