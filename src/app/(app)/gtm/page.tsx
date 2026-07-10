import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { GtmChat } from '@/components/gtm/GtmChat'

export default async function GtmPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return <GtmChat />
}
