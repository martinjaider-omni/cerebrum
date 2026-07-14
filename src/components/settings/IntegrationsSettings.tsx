'use client'

import { useState, useEffect } from 'react'

interface ServiceResult { ok: boolean; error?: string; detail?: string }

interface TestStatus {
  apollo: ServiceResult
  attio: ServiceResult | null
  anthropic: ServiceResult | null
}

export function IntegrationsSettings() {
  const [form, setForm] = useState({
    apolloApiKey: '',
    attioAccessToken: '',
    attioListId: '',
    anthropicApiKey: '',
    stripeSecretKey: '',
    holdedApiKey: '',
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
          anthropicApiKey: d.anthropicApiKey ?? '',
          stripeSecretKey: d.stripeSecretKey ?? '',
          holdedApiKey: d.holdedApiKey ?? '',
          icpTitles: (d.icpTitles ?? []).join('\n'),
          maxPeoplePerCompany: d.maxPeoplePerCompany ?? 3,
          revealPhones: d.revealPhones ?? false,
          revealEmails: d.revealEmails ?? true,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
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
        anthropic: null,
      })
    } finally {
      setTesting(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3E95B0]'

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando configuración…</div>

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#232323]">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">API keys e integraciones</p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-gray-800">API Keys</h2>
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Anthropic API Key <span className="text-gray-400 font-normal">(GTM Engineer)</span></label>
            <input className={inputCls} type="password" value={form.anthropicApiKey} onChange={(e) => setForm({ ...form, anthropicApiKey: e.target.value })} placeholder="sk-ant-…" autoComplete="off" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Stripe Secret Key <span className="text-gray-400 font-normal">(Dashboard)</span></label>
            <input className={inputCls} type="password" value={form.stripeSecretKey} onChange={(e) => setForm({ ...form, stripeSecretKey: e.target.value })} placeholder="sk_live_…" autoComplete="off" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Holded API Key <span className="text-gray-400 font-normal">(Dashboard — clientes por transferencia)</span></label>
            <input className={inputCls} type="password" value={form.holdedApiKey} onChange={(e) => setForm({ ...form, holdedApiKey: e.target.value })} placeholder="API key de Holded" autoComplete="off" />
          </div>
        </div>

        <h2 className="font-semibold text-gray-800 pt-2">Attio</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Attio List ID <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input className={inputCls} value={form.attioListId} onChange={(e) => setForm({ ...form, attioListId: e.target.value })} placeholder="ID de la lista en Attio" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Max personas por empresa</label>
            <input className={inputCls} type="number" min={1} max={10} value={form.maxPeoplePerCompany} onChange={(e) => setForm({ ...form, maxPeoplePerCompany: parseInt(e.target.value) || 3 })} />
          </div>
        </div>

        <h2 className="font-semibold text-gray-800 pt-2">Prospección Apollo</h2>
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
            <input type="checkbox" className="w-4 h-4 accent-[#3E95B0]" checked={form.revealEmails} onChange={(e) => setForm({ ...form, revealEmails: e.target.checked })} />
            Revelar emails (usa créditos Apollo)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="w-4 h-4 accent-[#3E95B0]" checked={form.revealPhones} onChange={(e) => setForm({ ...form, revealPhones: e.target.checked })} />
            Revelar teléfonos personales
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-[#3E95B0] hover:bg-[#255664] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
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
        <div className="space-y-2">
          <ServiceCard label="Apollo" result={testResult.apollo} />
          {testResult.attio ? <ServiceCard label="Attio" result={testResult.attio} /> : !form.attioAccessToken && <SkippedCard label="Attio" hint="Agrega un token para sincronizar contactos" />}
          {testResult.anthropic ? <ServiceCard label="Anthropic (Claude)" result={testResult.anthropic} /> : !form.anthropicApiKey && <SkippedCard label="Anthropic" hint="Necesario para el GTM Engineer" />}
        </div>
      )}
    </div>
  )
}

function ServiceCard({ label, result }: { label: string; result: { ok: boolean; error?: string; detail?: string } }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
      <span className="text-lg">{result.ok ? '✅' : '❌'}</span>
      <div>
        <p className={`font-semibold ${result.ok ? 'text-green-800' : 'text-red-800'}`}>
          {label} {result.ok ? 'conectado' : 'error'}
        </p>
        <p className={`text-xs ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
          {result.ok ? result.detail : result.error}
        </p>
      </div>
    </div>
  )
}

function SkippedCard({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm bg-gray-50 border border-gray-200">
      <span className="text-lg">⏭</span>
      <div>
        <p className="font-semibold text-gray-600">{label} no configurado</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
    </div>
  )
}
