import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminPanel } from '@/components/admin/AdminPanel'

export default async function AdminPage() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'admin') redirect('/')

  const [users, catalogs] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    db.catalog.findMany({ orderBy: { key: 'asc' } }),
  ])

  return (
    <AdminPanel
      initialUsers={users}
      initialCatalogs={catalogs}
      currentUserId={(session!.user as { id?: string }).id ?? ''}
    />
  )
}
