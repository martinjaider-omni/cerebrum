'use client'

import { useState, useEffect, useCallback } from 'react'

interface Person {
  id: string
  fullName: string
  title: string
  seniority: string
  linkedinUrl: string | null
  emails: string[]
  personalPhone: string | null
  companyPhone: string | null
  phoneStatus: string
}

interface Company {
  id: string
  inputName: string
  domain: string
  phone: string | null
  status: string
  people: Person[]
}

interface DirectoryResponse {
  data: Company[]
  total: number
  page: number
  limit: number
}

export function DirectoryPanel() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    params.set('page', String(page))
    const res = await fetch(`/api/directory?${params}`)
    const json: DirectoryResponse = await res.json()
    setCompanies(json.data)
    setTotal(json.total)
    setTotalPages(Math.max(1, Math.ceil(json.total / json.limit)))
    setLoading(false)
  }, [search, page])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Directorio</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} empresa{total !== 1 ? 's' : ''} prospectada{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          placeholder="Buscar empresa, dominio o persona..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button type="submit" className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition">
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg"
          >
            Limpiar
          </button>
        )}
      </form>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No hay empresas</p>
          <p className="text-sm mt-1">{search ? 'Intenta otra búsqueda' : 'Lanza una prospección para empezar'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((co) => {
            const isExpanded = expandedId === co.id
            return (
              <div key={co.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Company row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : co.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                    {co.inputName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{co.inputName}</span>
                      {co.domain && co.domain !== 'x.com' && (
                        <span className="text-xs text-gray-400">{co.domain}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {co.phone && (
                        <span className="text-xs text-teal-600">📞 {co.phone}</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {co.people.length} contacto{co.people.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm shrink-0">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* People expanded */}
                {isExpanded && co.people.length > 0 && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                          <th className="text-left px-5 py-2 font-medium">Nombre</th>
                          <th className="text-left px-5 py-2 font-medium">Cargo</th>
                          <th className="text-left px-5 py-2 font-medium">Email</th>
                          <th className="text-left px-5 py-2 font-medium">Teléfono</th>
                          <th className="text-left px-5 py-2 font-medium">LinkedIn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {co.people.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <span className="font-medium text-gray-900">{p.fullName}</span>
                              {p.seniority && (
                                <span className="ml-2 text-xs text-gray-400">{p.seniority}</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-gray-600">{p.title || '—'}</td>
                            <td className="px-5 py-3">
                              {p.emails.length > 0 ? (
                                <a href={`mailto:${p.emails[0]}`} className="text-teal-600 hover:underline">
                                  {p.emails[0]}
                                </a>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {p.personalPhone ? (
                                <a href={`tel:${p.personalPhone}`} className="text-teal-600 hover:underline">
                                  {p.personalPhone}
                                </a>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {p.linkedinUrl ? (
                                <a
                                  href={p.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  Ver perfil
                                </a>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && co.people.length === 0 && (
                  <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-400 text-center">
                    No se encontraron contactos para esta empresa
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
