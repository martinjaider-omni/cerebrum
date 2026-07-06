import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) return null

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const proposals = await db.proposal.findMany({
    where: isAdmin ? {} : { ownerId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { owner: { select: { name: true } } },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propuestas</h1>
          <p className="text-gray-500 mt-1">{proposals.length} propuesta{proposals.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/proposals/new"
          className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition"
        >
          + Nueva propuesta
        </Link>
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No hay propuestas todavía</p>
          <p className="text-sm mt-1">Crea tu primera propuesta para empezar</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {proposals.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between hover:shadow-sm transition">
              <div>
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {p.clientName || 'Sin cliente'} · {p.status === 'draft' ? 'Borrador' : 'Final'} · {isAdmin && `${p.owner.name} · `}
                  {new Date(p.updatedAt).toLocaleDateString('es-ES')}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/proposals/${p.id}/edit`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">Editar</Link>
                <Link href={`/proposals/${p.id}/preview`} className="px-3 py-1.5 text-sm bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition">Ver</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
