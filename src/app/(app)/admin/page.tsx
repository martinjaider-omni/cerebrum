import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminPanel } from '@/components/admin/AdminPanel'

export default async function AdminPage() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'admin') redirect('/')

  const users = await db.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  return (
    <AdminPanel
      initialUsers={users}
      currentUserId={(session!.user as { id?: string }).id ?? ''}
    />
  )
}
