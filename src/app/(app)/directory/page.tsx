import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DirectoryPanel } from '@/components/directory/DirectoryPanel'

export default async function DirectoryPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return <DirectoryPanel />
}
