import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Prisma } from '@prisma/client'

const PAGE_SIZE = 20

export default async function DashboardPage({ searchParams }: { searchParams: { q?: string; status?: string; sort?: string; page?: string } }) {
  const session = await auth()
  if (!session?.user) return null

  const isAdmin = (session.user as { role?: string }).role === 'admin'

  // Parse search params
  const q = searchParams.q?.trim() || ''
  const status = searchParams.status || ''
  const sort = searchParams.sort || 'updatedAt'
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)

  // Build where clause
  const where: Prisma.ProposalWhereInput = {
    ...(isAdmin ? {} : { ownerId: session.user.id }),
    ...(status === 'draft' || status === 'final' ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
            { clientName: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
          ],
        }
      : {}),
  }

  // Build orderBy
  const validSorts: Record<string, Prisma.ProposalOrderByWithRelationInput> = {
    updatedAt: { updatedAt: 'desc' },
    createdAt: { createdAt: 'desc' },
    name: { name: 'desc' },
    clientName: { clientName: 'desc' },
  }
  const orderBy = validSorts[sort] || validSorts.updatedAt

  // Count + paginated query
  const [totalCount, proposals] = await Promise.all([
    db.proposal.count({ where }),
    db.proposal.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { owner: { select: { name: true } } },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Helper to build link hrefs preserving other params
  function buildHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const merged = { q, status, sort, page: String(page), ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== '' && !(k === 'page' && v === '1') && !(k === 'sort' && v === 'updatedAt') && !(k === 'status' && v === 'all')) {
        params.set(k, v)
      }
    }
    const qs = params.toString()
    return qs ? `/?${qs}` : '/'
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propuestas</h1>
          <p className="text-gray-500 mt-1">{totalCount} propuesta{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/proposals/new"
          className="bg-[#3E95B0] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#255664] transition"
        >
          + Nueva propuesta
        </Link>
      </div>

      {/* Filter bar */}
      <form method="GET" action="/" className="flex flex-wrap items-end gap-4 mb-6 bg-white rounded-xl border border-gray-200 p-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="q" className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Nombre o cliente..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3E95B0] focus:border-[#3E95B0]"
          />
        </div>

        {/* Status filter */}
        <div className="min-w-[140px]">
          <label htmlFor="status" className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
          <select
            id="status"
            name="status"
            defaultValue={status || 'all'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3E95B0] focus:border-[#3E95B0]"
          >
            <option value="all">Todos</option>
            <option value="draft">Borrador</option>
            <option value="final">Final</option>
          </select>
        </div>

        {/* Sort */}
        <div className="min-w-[160px]">
          <label htmlFor="sort" className="block text-xs font-medium text-gray-500 mb-1">Ordenar por</label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3E95B0] focus:border-[#3E95B0]"
          >
            <option value="updatedAt">Actualizado</option>
            <option value="createdAt">Creado</option>
            <option value="name">Nombre</option>
            <option value="clientName">Cliente</option>
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="bg-[#3E95B0] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#255664] transition"
        >
          Filtrar
        </button>
      </form>

      {proposals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No hay propuestas todavia</p>
          <p className="text-sm mt-1">
            {q || status ? 'Intenta ajustar los filtros' : 'Crea tu primera propuesta para empezar'}
          </p>
        </div>
      ) : (
        <>
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
                  <Link href={`/proposals/${p.id}/preview`} className="px-3 py-1.5 text-sm bg-[#3E95B0]/10 text-[#255664] border border-[#3E95B0]/30 rounded-lg hover:bg-[#3E95B0]/15 transition">Ver</Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500">
              Pagina {page} de {totalPages} ({totalCount} resultado{totalCount !== 1 ? 's' : ''})
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildHref({ page: String(page - 1) })}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Anterior
                </Link>
              ) : (
                <span className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-300 cursor-not-allowed">
                  Anterior
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={buildHref({ page: String(page + 1) })}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Siguiente
                </Link>
              ) : (
                <span className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-300 cursor-not-allowed">
                  Siguiente
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
