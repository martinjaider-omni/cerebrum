import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin) redirect('/')

  return <IntegrationsSettings />
}
