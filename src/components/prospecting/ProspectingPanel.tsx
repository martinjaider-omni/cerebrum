'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BatchCounts { companies: number; people: number; phones: number; errors: number }

export interface BatchRow {
  id: string
  source: string
  status: string
  counts: BatchCounts
  createdAt: string
  _count: { companies: number }
}

interface Person {
  id: string
  fullName: string
  title: string
  seniority: string
  emails: string[]
  personalPhone: string | null
  phoneStatus: string
  status: string
}

interface Company {
  id: string
  inputName: string
  domain: string
  status: string
  error: string | null
  people: Person[]
}

interface BatchDetail extends BatchRow {
  companies: Company[]
}

interface Props {
  initialBatches: BatchRow[]
  configured: boolean
  isAdmin: boolean
}

// ── Settings sub-panel (admin only) ───────────────────────────────────────────

interface TestStatus {
  apollo: { ok: boolean; error?: string; detail?: string }
  attio: { ok: boolean; error?: string; detail?: string } | null
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    apolloApiKey: '',
    attioAccessToken: '',
    attioListId: '',
    icpTitles: '',
    maxPeoplePerCompany: 3,
    revealPhones: false,
    revealEmails: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestStatus | null>(null)

  useEffect(() => {
    fetch('/api/settings/integrations')
      .then((r) => r.json())
      .then((d) => {
        setForm({
          apolloApiKey: d.apolloApiKey ?? '',
          attioAccessToken: d.attioAccessToken ?? '',
          attioListId: d.attioListId ?? '',
          icpTitles: (d.icpTitles ?? []).join('\n'),
          maxPeoplePerCompany: d.maxPeoplePerCompany ?? 3,
          revealPhones: d.revealPhones ?? false,
          revealEmails: d.revealEmails ?? true,
        })
        setLoading(false)
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setTestResult(null)
    await fetch('/api/settings/integrations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        icpTitles: form.icpTitles.split('\n').map((s) => s.trim()).filter(Boolean),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/integrations/test', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setTestResult(json)
    } catch {
      setTestResult({
        apollo: { ok: false, error: 'No se pudo ejecutar el test' },
        attio: null,
      })
    } finally {
      setTesting(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando configuración…</div>

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Configuración de integraciones</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕ Cerrar</button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Apollo API Key</label>
            <input className={inputCls} type="password" value={form.apolloApiKey} onChange={(e) => setForm({ ...form, apolloApiKey: e.target.value })} placeholder="sk_apollo_…" autoComplete="off" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Attio Access Token</label>
            <input className={inputCls} type="password" value={form.attioAccessToken} onChange={(e) => setForm({ ...form, attioAccessToken: e.target.value })} placeholder="attio_…" autoComplete="off" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Attio List ID <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input className={inputCls} value={form.attioListId} onChange={(e) => setForm({ ...form, attioListId: e.target.value })} placeholder="ID de la lista en Attio" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Max personas por empresa</label>
            <input className={inputCls} type="number" min={1} max={10} value={form.maxPeoplePerCompany} onChange={(e) => setForm({ ...form, maxPeoplePerCompany: parseInt(e.target.value) || 3 })} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Títulos ICP <span className="text-gray-400 font-normal">(uno por línea, vacío = todos)</span></label>
          <textarea
            className={`${inputCls} h-24 resize-none font-mono`}
            value={form.icpTitles}
            onChange={(e) => setForm({ ...form, icpTitles: e.target.value })}
            placeholder="Director of Marketing&#10;CMO&#10;Head of Growth"
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={form.revealEmails} onChange={(e) => setForm({ ...form, revealEmails: e.target.checked })} />
            Revelar emails (usa créditos Apollo)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={form.revealPhones} onChange={(e) => setForm({ ...form, revealPhones: e.target.checked })} />
            Revelar teléfonos personales
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar configuración'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || saving}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? 'Verificando…' : '🔌 Verificar conexiones'}
          </button>
        </div>
      </form>

      {/* Test results */}
      {testResult && (
        <div className="space-y-2 pt-2">
          <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${testResult.apollo.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <span className="text-lg">{testResult.apollo.ok ? '✅' : '❌'}</span>
            <div>
              <p className={`font-semibold ${testResult.apollo.ok ? 'text-green-800' : 'text-red-800'}`}>
                Apollo {testResult.apollo.ok ? 'conectado' : 'error'}
              </p>
              <p className={`text-xs ${testResult.apollo.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.apollo.ok ? testResult.apollo.detail : testResult.apollo.error}
              </p>
            </div>
          </div>

          {testResult.attio && (
            <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${testResult.attio.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <span className="text-lg">{testResult.attio.ok ? '✅' : '❌'}</span>
              <div>
                <p className={`font-semibold ${testResult.attio.ok ? 'text-green-800' : 'text-red-800'}`}>
                  Attio {testResult.attio.ok ? 'conectado' : 'error'}
                </p>
                <p className={`text-xs ${testResult.attio.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.attio.ok ? testResult.attio.detail : testResult.attio.error}
                </p>
              </div>
            </div>
          )}

          {!form.attioAccessToken && !testResult.attio && (
            <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm bg-gray-50 border border-gray-200">
              <span className="text-lg">⏭</span>
              <div>
                <p className="font-semibold text-gray-600">Attio no configurado</p>
                <p className="text-xs text-gray-500">Opcional — agrega un token para sincronizar contactos</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Batch detail view ──────────────────────────────────────────────────────────

function BatchDetailPanel({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/prospecting/batches/${batchId}`)
      .then((r) => r.json())
      .then((d) => { setBatch(d); setLoading(false) })
  }, [batchId])

  async function handleRetry() {
    setRetrying(true)
    try {
      const res = await fetch(`/api/prospecting/batches/${batchId}/retry`, { method: 'POST' })
      if (res.ok) {
        setLoading(true)
        load()
      }
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    load()
    // Poll while processing
    const interval = setInterval(() => {
      if (batch?.status === 'processing' || batch?.status === 'queued') load()
    }, 3000)
    return () => clearInterval(interval)
  }, [load, batch?.status])

  const statusColors: Record<string, string> = {
    done: 'text-green-700 bg-green-100',
    error: 'text-red-700 bg-red-100',
    not_found: 'text-yellow-700 bg-yellow-100',
    enriching: 'text-blue-700 bg-blue-100',
    pending: 'text-gray-500 bg-gray-100',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-800">Detalle del batch</h2>
          {batch && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[batch.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {batch.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {batch && (batch.status === 'error' || batch.status === 'done') && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
            >
              {retrying ? 'Reintentando…' : '🔄 Reintentar fallidos'}
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕ Cerrar</button>
        </div>
      </div>

      {loading && <div className="p-6 text-sm text-gray-400">Cargando…</div>}

      {batch && !loading && (
        <>
          <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
            {[
              { label: 'Empresas', value: (batch.counts as BatchCounts).companies },
              { label: 'Personas', value: (batch.counts as BatchCounts).people },
              { label: 'Teléfonos', value: (batch.counts as BatchCounts).phones },
              { label: 'Errores', value: (batch.counts as BatchCounts).errors },
            ].map((s) => (
              <div key={s.label} className="px-5 py-3 text-center">
                <div className="text-xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="overflow-auto max-h-[60vh]">
            {batch.companies.map((co) => (
              <div key={co.id} className="border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${statusColors[co.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {co.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-800">{co.inputName}</span>
                    {co.domain && <span className="ml-2 text-xs text-gray-400">{co.domain}</span>}
                    {co.error && <span className="ml-2 text-xs text-red-500">{co.error}</span>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{co.people.length} persona{co.people.length !== 1 ? 's' : ''}</span>
                </div>

                {co.people.length > 0 && (
                  <div className="ml-8 mr-4 mb-3 space-y-1">
                    {co.people.map((p) => (
                      <div key={p.id} className="flex items-start gap-3 text-xs py-1.5 px-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-800">{p.fullName}</span>
                          {p.title && <span className="text-gray-500 ml-1">· {p.title}</span>}
                          {p.seniority && <span className="text-gray-400 ml-1">({p.seniority})</span>}
                        </div>
                        <div className="shrink-0 space-y-0.5 text-right">
                          {p.emails[0] && (
                            <div className="text-teal-600">{p.emails[0]}</div>
                          )}
                          {p.personalPhone && (
                            <div className="text-gray-600">📞 {p.personalPhone}</div>
                          )}
                          {p.phoneStatus === 'none' && (
                            <div className="text-gray-400">Sin teléfono</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function ProspectingPanel({ initialBatches, configured, isAdmin }: Props) {
  const [batches, setBatches] = useState<BatchRow[]>(initialBatches)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [companyInput, setCompanyInput] = useState('')
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  async function handleLaunch() {
    const companies = companyInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    if (companies.length === 0) return
    setLaunching(true)
    setLaunchError(null)
    try {
      const res = await fetch('/api/prospecting/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies, source: 'text' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error lanzando batch')
      setBatches((prev) => [{ ...json, _count: { companies: companies.length } }, ...prev])
      setCompanyInput('')
      setSelectedBatchId(json.id)
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLaunching(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este batch?')) return
    await fetch(`/api/prospecting/batches/${id}`, { method: 'DELETE' })
    setBatches((prev) => prev.filter((b) => b.id !== id))
    if (selectedBatchId === id) setSelectedBatchId(null)
  }

  const statusIcon: Record<string, string> = {
    queued: '⏳',
    processing: '⚙️',
    done: '✅',
    error: '❌',
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospección</h1>
          <p className="text-sm text-gray-500 mt-0.5">Enriquecimiento de empresas via Apollo + Attio</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowSettings((v) => !v); setSelectedBatchId(null) }}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
          >
            ⚙️ Configuración
          </button>
        )}
      </div>

      {showSettings && isAdmin && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {!configured && !showSettings && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Apollo API Key no configurada.</strong>{' '}
          {isAdmin
            ? 'Configura la integración pulsando "Configuración".'
            : 'Pide al administrador que configure la integración con Apollo.'}
        </div>
      )}

      {/* New batch input */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">Nuevo batch de empresas</h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Escribe los nombres de las empresas, uno por línea (máx. 200)</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none font-mono"
            style={{ height: '140px' }}
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
            placeholder={'Empresa A S.L.\nEmpresa B\nGrupo C'}
            disabled={!configured}
          />
        </div>
        {launchError && (
          <p className="text-sm text-red-600">{launchError}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLaunch}
            disabled={launching || !configured || !companyInput.trim()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {launching ? 'Lanzando…' : '🚀 Lanzar prospección'}
          </button>
          <span className="text-xs text-gray-400">
            {companyInput.split('\n').filter((s) => s.trim()).length} empresa{companyInput.split('\n').filter((s) => s.trim()).length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Detail panel */}
      {selectedBatchId && (
        <BatchDetailPanel batchId={selectedBatchId} onClose={() => setSelectedBatchId(null)} />
      )}

      {/* Batch history */}
      {batches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-sm text-gray-800">Historial de batches</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-2.5">Estado</th>
                <th className="text-left px-5 py-2.5">Empresas</th>
                <th className="text-left px-5 py-2.5">Resultados</th>
                <th className="text-left px-5 py-2.5">Fecha</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const counts = b.counts as BatchCounts
                return (
                  <tr
                    key={b.id}
                    className={`border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${selectedBatchId === b.id ? 'bg-teal-50' : ''}`}
                    onClick={() => setSelectedBatchId(b.id === selectedBatchId ? null : b.id)}
                  >
                    <td className="px-5 py-3">
                      <span className="text-base" title={b.status}>{statusIcon[b.status] ?? '•'}</span>
                      <span className="ml-2 text-xs text-gray-500">{b.status}</span>
                    </td>
                    <td className="px-5 py-3 font-medium">{b._count.companies}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {counts.companies > 0 && <span>{counts.companies} ✓ · {counts.people} personas{counts.phones > 0 ? ` · ${counts.phones} 📞` : ''}{counts.errors > 0 ? ` · ${counts.errors} ✗` : ''}</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(b.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(b.id) }}
                        className="text-xs text-red-400 hover:text-red-600"
                        aria-label="Eliminar batch"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {batches.length === 0 && !showSettings && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm">No hay batches todavía. Lanza tu primera prospección.</p>
        </div>
      )}
    </div>
  )
}
