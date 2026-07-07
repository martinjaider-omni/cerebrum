'use client'

import { useCallback, useEffect, useRef, useState, useId } from 'react'
import { useRouter } from 'next/navigation'
import { SummaryPanel } from './SummaryPanel'
import { FEATURE_PLAN_MAP, PLANS, recommendPlan } from '@/lib/pricing'

const PLAN_ORDER = ['starter', 'plus', 'advanced', 'enterprise'] as const

// ── Catalog data (mirrors seed — in Phase 6 admin can edit these via DB) ──────

const FEATURES_CATALOG = [
  {
    category: 'CORE',
    label: 'Core',
    items: [
      { id: 'wallet', name: 'Tarjetas Wallet (Apple & Google)' },
      { id: 'loyalty', name: 'Sistema de puntos / loyalty' },
      { id: 'cdp', name: 'CDP (datos de cliente)' },
      { id: 'api', name: 'API REST + Webhooks' },
      { id: 'push', name: 'Notificaciones Push' },
      { id: 'tpv', name: 'Integración con TPV/POS' },
      { id: 'stamps', name: 'Sellos digitales (Stamp Cards)' },
      { id: 'points_expiry', name: 'Caducidad de puntos' },
      { id: 'blocked_points', name: 'Puntos bloqueados' },
    ],
  },
  {
    category: 'CRECIMIENTO',
    label: 'Crecimiento',
    items: [
      { id: 'gift_cards', name: 'Tarjetas regalo' },
      { id: 'referrals', name: 'Referidos' },
      { id: 'cashback', name: 'Cashback' },
      { id: 'levels', name: 'Niveles de usuario' },
      { id: 'loyalty_analytics', name: 'Loyalty Analytics' },
      { id: 'data_enrichment', name: 'Enriquecimiento de datos' },
      { id: 'segmentation', name: 'Segmentación de clientes' },
    ],
  },
  {
    category: 'AVANZADO',
    label: 'Avanzado',
    items: [
      { id: 'multi_brand', name: 'Multi-marca / Multi-programa' },
      { id: 'loyalty_market', name: 'Loyalty Market (catálogo de premios)' },
      { id: 'realtime_analytics', name: 'Análisis de transacciones en tiempo real' },
      { id: 'campaign_automation', name: 'Automatización de campañas' },
      { id: 'workflows', name: 'Workflows (automatizaciones)' },
      { id: 'gamification', name: 'Gamificación / Juegos (ruletas)' },
      { id: 'ropo', name: 'ROPO (Research Online, Purchase Offline)' },
      { id: 'omnicodex', name: 'OmniCodex (códigos únicos, FMCG)' },
    ],
  },
  {
    category: 'ENTERPRISE',
    label: 'Enterprise',
    items: [
      { id: 'custom_integrations', name: 'Integraciones personalizadas' },
      { id: 'strategic_consulting', name: 'Consultoría estratégica' },
      { id: 'migration', name: 'Migración asistida a OmniWallet' },
      { id: 'priority_support', name: 'Soporte técnico prioritario' },
      { id: 'csm', name: 'Customer Success Manager dedicado' },
      { id: 'annual_payment', name: 'Pago anual normalizado' },
    ],
  },
]

const ECOMMERCE_OPTIONS = [
  { id: 'shopify', name: 'Shopify', native: true },
  { id: 'woocommerce', name: 'WooCommerce', native: true },
  { id: 'prestashop', name: 'PrestaShop', native: true },
  { id: 'magento2', name: 'Magento 2', native: true },
  { id: 'bigcommerce', name: 'BigCommerce', native: true },
  { id: 'other', name: 'Otra/a medida', native: false },
  { id: 'none', name: 'No tiene', native: false },
]

const POS_OPTIONS = [
  { id: 'agora', name: 'Ágora', native: true },
  { id: 'stockagile', name: 'Stockagile', native: true },
  { id: 'csv', name: 'Fichero/CSV', native: true },
  { id: 'a3innuva', name: 'a3innuva ERP', native: true },
  { id: 'stm', name: 'stm ERP', native: true },
  { id: 'other', name: 'Otro', native: false },
  { id: 'none', name: 'No tiene', native: false },
]

const CRM_OPTIONS = [
  { id: 'hubspot', name: 'HubSpot', native: false },
  { id: 'klaviyo', name: 'Klaviyo', native: true },
  { id: 'brevo', name: 'Brevo', native: true },
  { id: 'connectif', name: 'Connectif', native: true },
  { id: 'salesmanago', name: 'Sales Manago', native: true },
  { id: 'other', name: 'Otro', native: false },
  { id: 'none', name: 'No tiene', native: false },
]

const SECTORS = [
  'Moda y textil', 'Cosmética y belleza', 'Deporte y outdoor', 'Alimentación y bebidas',
  'Electrónica', 'Hogar y decoración', 'Farmacia y salud', 'Joyería y accesorios',
  'Librería y papelería', 'Mascotas', 'Óptica', 'Otro',
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProposalData {
  id: string
  name: string
  status: string
  clientName: string
  clientUrl: string
  clientSector: string
  clientContact: string
  channelOnline: boolean
  channelStore: boolean
  ordersOnline: number
  ordersOffline: number
  offlineRegPct: number
  activityFactor: number
  techEcommerce: string
  techPos: string
  techCrm: string
  features: string[]
  implPace: 'rapida' | 'estandar' | 'holgada'
  dualPlanEnabled: boolean
  dualPlanFeatures: string[]
  enterpriseEnabled: boolean
  enterpriseMonthlyFee: number | null
  enterpriseTerm: string
  enterpriseIncludes: string[]
  brandLogoUrl: string | null
  brandPrimary: string
  brandSecondary: string
  brandPalette: string[]
  notes: string
  message: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function planBadge(featureId: string) {
  const p = FEATURE_PLAN_MAP[featureId]
  if (!p) return null
  const colors: Record<string, string> = {
    starter: 'bg-blue-50 text-blue-700',
    plus: 'bg-purple-50 text-purple-700',
    advanced: 'bg-teal-50 text-teal-700',
    enterprise: 'bg-orange-50 text-orange-700',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[p] ?? ''}`}>
      {PLANS[p as keyof typeof PLANS]?.name ?? p}
    </span>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
const selectCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white'

// ── Main Component ─────────────────────────────────────────────────────────────

export function ProposalEditor({ initial }: { initial: ProposalData }) {
  const router = useRouter()
  const [data, setData] = useState<ProposalData>(initial)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [saveError, setSaveError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [brandImporting, setBrandImporting] = useState(false)
  const [brandImportError, setBrandImportError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInputId = useId()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [assets, setAssets] = useState<Array<{ id: string; filename: string; kind: string; url?: string }>>([])
  const [assetUploading, setAssetUploading] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const assetInputId = useId()

  // ── Autosave ───────────────────────────────────────────────────────────────

  const save = useCallback(async (payload: ProposalData) => {
    setSaveState('saving')
    setSaveError(false)
    try {
      const res = await fetch(`/api/proposals/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      setSaveState('saved')
    } catch {
      setSaveState('unsaved')
      setSaveError(true)
    }
  }, [])

  const update = useCallback(
    (patch: Partial<ProposalData>) => {
      setData((prev) => {
        const next = { ...prev, ...patch }
        setSaveState('unsaved')
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => save(next), 1500)
        return next
      })
    },
    [save]
  )

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === 'unsaved' || debounceRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveState])

  // Load assets on mount
  useEffect(() => {
    fetch(`/api/proposals/${initial.id}/assets`)
      .then((r) => r.json())
      .then((list) => { if (Array.isArray(list)) setAssets(list) })
      .catch(() => {})
  }, [initial.id])

  async function handleAssetUpload(file: File) {
    setAssetUploading(true)
    setAssetError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/proposals/${data.id}/assets`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error subiendo archivo')
      setAssets((prev) => [json, ...prev])

      // If it's a text file, append content to notes
      if (file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const text = await file.text()
        if (text.trim()) {
          update({ notes: (data.notes ? data.notes + '\n\n' : '') + `--- ${file.name} ---\n${text.trim()}` })
        }
      }
    } catch (err) {
      setAssetError(err instanceof Error ? err.message : 'Error')
    } finally {
      setAssetUploading(false)
    }
  }

  async function handleAssetDelete(assetId: string) {
    await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
    setAssets((prev) => prev.filter((a) => a.id !== assetId))
  }

  const toggleFeature = (id: string) => {
    update({
      features: data.features.includes(id)
        ? data.features.filter((f) => f !== id)
        : [...data.features, id],
    })
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleDuplicate() {
    const res = await fetch(`/api/proposals/${data.id}/duplicate`, { method: 'POST' })
    if (res.ok) {
      const dup = await res.json()
      router.push(`/proposals/${dup.id}/edit`)
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta propuesta? No se puede deshacer.')) return
    await fetch(`/api/proposals/${data.id}`, { method: 'DELETE' })
    router.push('/')
  }

  async function handleSaveNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await save(data)
  }

  async function handleBrandImport() {
    if (!data.clientUrl) return
    setBrandImporting(true)
    setBrandImportError(null)
    try {
      const res = await fetch(`/api/proposals/${data.id}/brand-import`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error importando marca')
      setData((prev) => ({
        ...prev,
        brandLogoUrl: json.brandLogoUrl ?? prev.brandLogoUrl,
        brandPrimary: json.brandPrimary ?? prev.brandPrimary,
        brandSecondary: json.brandSecondary ?? prev.brandSecondary,
        brandPalette: json.brandPalette ?? prev.brandPalette,
      }))
    } catch (err) {
      setBrandImportError(String(err instanceof Error ? err.message : err))
    } finally {
      setBrandImporting(false)
    }
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true)
    setLogoError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/proposals/${data.id}/logo-upload`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error subiendo logo')
      setData((prev) => ({
        ...prev,
        brandLogoUrl: json.brandLogoUrl ?? prev.brandLogoUrl,
        brandPrimary: json.brandPrimary ?? prev.brandPrimary,
        brandSecondary: json.brandSecondary ?? prev.brandSecondary,
        brandPalette: json.brandPalette ?? prev.brandPalette,
      }))
    } catch (err) {
      setLogoError(String(err instanceof Error ? err.message : err))
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleShareCreate() {
    setShareLoading(true)
    try {
      const res = await fetch(`/api/proposals/${data.id}/share`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error generando link')
      setShareUrl(json.url)
    } finally {
      setShareLoading(false)
    }
  }

  async function handleShareRevoke() {
    if (!confirm('¿Revocar el link? El cliente ya no podrá acceder.')) return
    setShareLoading(true)
    try {
      await fetch(`/api/proposals/${data.id}/share`, { method: 'DELETE' })
      setShareUrl(null)
    } finally {
      setShareLoading(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available — use textarea fallback
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col xl:flex-row gap-6 p-4 md:p-6 min-h-screen bg-gray-50">
      {/* ── Left: form ── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
          <div className="flex-1 flex items-center gap-2">
            <input
              className="text-xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-teal-400 focus:outline-none px-1 py-0.5"
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
            />
            <span className={`text-xs px-2 py-0.5 rounded-full ${data.status === 'final' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {data.status === 'final' ? 'Final' : 'Borrador'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Save status */}
            <span
              aria-live="polite"
              aria-atomic="true"
              className={`text-xs ${saveState === 'saved' ? 'text-green-600' : saveState === 'saving' ? 'text-gray-400' : 'text-orange-500'}`}
            >
              {saveState === 'saved' ? '✓ Guardado' : saveState === 'saving' ? 'Guardando…' : '● Sin guardar'}
            </span>
            {saveError && (
              <button onClick={handleSaveNow} className="text-xs text-red-500 underline">Reintentar</button>
            )}
            <button
              onClick={() => router.push(`/proposals/${data.id}/preview`)}
              className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
            >
              Ver propuesta →
            </button>
            <div className="relative group">
              <button className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">⋮</button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-10 w-40">
                <button onClick={handleDuplicate} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Duplicar</button>
                <button
                  onClick={() => update({ status: data.status === 'draft' ? 'final' : 'draft' })}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                >
                  {data.status === 'draft' ? 'Marcar como final' : 'Volver a borrador'}
                </button>
                <hr className="my-1" />
                <button onClick={handleDelete} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Eliminar</button>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Datos del lead */}
        <Section title="1. Datos del lead">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre del cliente">
              <input className={inputCls} value={data.clientName} onChange={(e) => update({ clientName: e.target.value })} placeholder="Empresa S.L." />
            </Field>
            <Field label="Sector">
              <select className={selectCls} value={data.clientSector} onChange={(e) => update({ clientSector: e.target.value })}>
                <option value="">Selecciona sector</option>
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Web del cliente" hint="(para importar marca)">
              <input className={inputCls} value={data.clientUrl} onChange={(e) => update({ clientUrl: e.target.value })} placeholder="https://empresa.com" />
            </Field>
            <Field label="Persona de contacto">
              <input className={inputCls} value={data.clientContact} onChange={(e) => update({ clientContact: e.target.value })} placeholder="Nombre y cargo" />
            </Field>
          </div>
          <Field label="Canales activos">
            <div className="flex gap-6 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={data.channelOnline} onChange={(e) => update({ channelOnline: e.target.checked })} />
                <span className="text-sm">Tienda online (eCommerce)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={data.channelStore} onChange={(e) => update({ channelStore: e.target.checked })} />
                <span className="text-sm">Tiendas físicas (TPV)</span>
              </label>
            </div>
          </Field>
        </Section>

        {/* 2. Marca */}
        <Section title="2. Marca del cliente">
          {/* Logo actual */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {data.brandLogoUrl
                ? <img src={data.brandLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                : <span className="text-gray-300 text-xs text-center leading-tight px-1">Sin logo</span>}
            </div>
            <div className="space-y-2">
              <button
                onClick={handleBrandImport}
                disabled={brandImporting || !data.clientUrl}
                className="block w-full text-sm px-4 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {brandImporting ? 'Importando…' : '⬇ Importar marca desde web'}
              </button>
              <label
                htmlFor={logoInputId}
                className={`block text-center text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {logoUploading ? 'Subiendo…' : '📁 Subir logo manualmente'}
              </label>
              <input
                id={logoInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) { handleLogoUpload(file); e.target.value = '' }
                }}
              />
              {!data.clientUrl && (
                <p className="text-xs text-gray-400">Añade la web del cliente para importar.</p>
              )}
            </div>
          </div>

          {brandImportError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {brandImportError}
            </div>
          )}

          {logoError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {logoError}
            </div>
          )}

          {/* Paleta extraída */}
          {data.brandPalette && data.brandPalette.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Paleta extraída</p>
              <div className="flex gap-2">
                {data.brandPalette.map((hex) => (
                  <button
                    key={hex}
                    title={hex}
                    onClick={() => {
                      if (hex === data.brandPrimary) update({ brandSecondary: hex })
                      else update({ brandPrimary: hex })
                    }}
                    className="w-8 h-8 rounded-full border-2 border-white shadow ring-1 ring-gray-200 cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Click en un color para asignarlo como primario.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Color primario">
              <div className="flex gap-2 items-center">
                <input type="color" value={data.brandPrimary} onChange={(e) => update({ brandPrimary: e.target.value })} className="w-10 h-9 rounded border cursor-pointer" />
                <input className={inputCls} value={data.brandPrimary} onChange={(e) => update({ brandPrimary: e.target.value })} placeholder="#3E95B0" />
              </div>
            </Field>
            <Field label="Color secundario">
              <div className="flex gap-2 items-center">
                <input type="color" value={data.brandSecondary} onChange={(e) => update({ brandSecondary: e.target.value })} className="w-10 h-9 rounded border cursor-pointer" />
                <input className={inputCls} value={data.brandSecondary} onChange={(e) => update({ brandSecondary: e.target.value })} placeholder="#255664" />
              </div>
            </Field>
          </div>
          <div className="flex gap-3 items-center">
            <div className="h-10 w-10 rounded-full border border-gray-200" style={{ backgroundColor: data.brandPrimary }} />
            <div className="h-10 w-10 rounded-full border border-gray-200" style={{ backgroundColor: data.brandSecondary }} />
            <span className="text-xs text-gray-400">Vista previa de colores</span>
          </div>
        </Section>

        {/* 3. Volumen */}
        <Section title="3. Volumen de pedidos">
          <div className="grid grid-cols-2 gap-4">
            {data.channelOnline && (
              <Field label="Pedidos online / mes">
                <input
                  type="number" min={0} className={inputCls}
                  value={data.ordersOnline}
                  onChange={(e) => update({ ordersOnline: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </Field>
            )}
            {data.channelStore && (
              <Field label="Pedidos en tienda física / mes">
                <input
                  type="number" min={0} className={inputCls}
                  value={data.ordersOffline}
                  onChange={(e) => update({ ordersOffline: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </Field>
            )}
          </div>

          {data.channelStore && (
            <Field label={`% de registro offline año 1: ${data.offlineRegPct}%`} hint="(clientes que se registran en tienda)">
              <input
                type="range" min={0} max={100} step={5}
                value={data.offlineRegPct}
                onChange={(e) => update({ offlineRegPct: parseInt(e.target.value) })}
                className="w-full accent-teal-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </Field>
          )}

          <Field label={`Factor de actividades: ${data.activityFactor}`} hint="(actividades por pedido; por defecto 1,3)">
            <input
              type="range" min={1} max={3} step={0.1}
              value={data.activityFactor}
              onChange={(e) => update({ activityFactor: parseFloat(e.target.value) })}
              className="w-full accent-teal-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1,0</span><span>2,0</span><span>3,0</span>
            </div>
          </Field>
        </Section>

        {/* 4. Tecnología */}
        <Section title="4. Tecnología actual">
          <div className="grid grid-cols-3 gap-4">
            <Field label="eCommerce">
              <select className={selectCls} value={data.techEcommerce} onChange={(e) => update({ techEcommerce: e.target.value })}>
                <option value="">Seleccionar</option>
                {ECOMMERCE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}{o.native ? ' ✓' : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="TPV / POS">
              <select className={selectCls} value={data.techPos} onChange={(e) => update({ techPos: e.target.value })}>
                <option value="">Seleccionar</option>
                {POS_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}{o.native ? ' ✓' : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="CRM">
              <select className={selectCls} value={data.techCrm} onChange={(e) => update({ techCrm: e.target.value })}>
                <option value="">Seleccionar</option>
                {CRM_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}{o.native ? ' ✓' : ''}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-gray-400">✓ = conector nativo disponible</p>
        </Section>

        {/* 5. Funcionalidades */}
        <Section title="5. Funcionalidades a utilizar">
          <div className="space-y-4">
            {FEATURES_CATALOG.map((cat) => (
              <div key={cat.category}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat.label}</p>
                <div className="grid grid-cols-2 gap-1">
                  {cat.items.map((feat) => (
                    <label key={feat.id} className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-teal-600 shrink-0"
                        checked={data.features.includes(feat.id)}
                        onChange={() => toggleFeature(feat.id)}
                      />
                      <span className="text-sm text-gray-700 flex-1">{feat.name}</span>
                      {planBadge(feat.id)}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 6. Comparativa de planes */}
        <Section title="6. Comparativa de planes">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => update({ dualPlanEnabled: !data.dualPlanEnabled, dualPlanFeatures: data.dualPlanFeatures ?? [] })}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${data.dualPlanEnabled ? 'bg-teal-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${data.dualPlanEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm font-medium">Mostrar dos opciones de plan al cliente</span>
          </label>
          <p className="text-xs text-gray-400">
            Presenta la propuesta base junto a un plan superior con más funcionalidades para que el cliente pueda comparar.
          </p>

          {data.dualPlanEnabled && (() => {
            const { planId: basePlan } = recommendPlan(data.features)
            const basePlanIdx = PLAN_ORDER.indexOf(basePlan as typeof PLAN_ORDER[number])
            const upgradePlanId = basePlanIdx < PLAN_ORDER.length - 1 ? PLAN_ORDER[basePlanIdx + 1] : null
            const upgradePlan = upgradePlanId ? PLANS[upgradePlanId as keyof typeof PLANS] : null

            if (!upgradePlan) return (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-500">
                Ya estás en el plan más alto disponible (Enterprise).
              </div>
            )

            // Features available in the upgrade plan but not in current selection
            const upgradeFeatures = Object.entries(FEATURE_PLAN_MAP)
              .filter(([, plan]) => plan === upgradePlanId)
              .map(([id]) => id)
              .filter((id) => !data.features.includes(id))

            const allUpgradeFeatures = Object.entries(FEATURE_PLAN_MAP)
              .filter(([, plan]) => plan === upgradePlanId)
              .map(([id]) => id)

            return (
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Opción A — Base</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{PLANS[basePlan as keyof typeof PLANS]?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{data.features.length} funcionalidades seleccionadas</p>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                    <p className="text-xs font-semibold text-teal-600 uppercase">Opción B — Superior</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{upgradePlan.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{data.features.length + (data.dualPlanFeatures?.length ?? 0)} funcionalidades</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Funcionalidades adicionales en {upgradePlan.name} (selecciona las que incluir)
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {allUpgradeFeatures.map((featId) => {
                      const feat = FEATURES_CATALOG.flatMap((c) => c.items).find((f) => f.id === featId)
                      if (!feat) return null
                      const alreadyInBase = data.features.includes(featId)
                      const checked = alreadyInBase || (data.dualPlanFeatures ?? []).includes(featId)
                      return (
                        <label key={featId} className={`flex items-center gap-2 py-1 px-2 rounded ${alreadyInBase ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-teal-600 shrink-0"
                            checked={checked}
                            disabled={alreadyInBase}
                            onChange={() => {
                              if (alreadyInBase) return
                              const current = data.dualPlanFeatures ?? []
                              update({
                                dualPlanFeatures: current.includes(featId)
                                  ? current.filter((f) => f !== featId)
                                  : [...current, featId],
                              })
                            }}
                          />
                          <span className="text-sm text-gray-700">{feat.name}</span>
                          {alreadyInBase && <span className="text-xs text-gray-400">(ya incluida)</span>}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </Section>

        {/* 7. Tipo de implementación — SOLO USO INTERNO */}
        <Section title="7. Tipo de implementación">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">⚠ Solo uso interno — no se muestra al cliente</p>
            <p className="text-xs text-slate-500 mt-0.5">Ajusta los tiempos del roadmap. El cliente solo ve las semanas resultantes.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['rapida', 'estandar', 'holgada'] as const).map((pace) => {
              const labels: Record<string, string> = { rapida: 'Rápida ×0,6', estandar: 'Estándar ×1', holgada: 'Holgada ×1,6' }
              const descs: Record<string, string> = { rapida: 'Cliente con recursos técnicos propios', estandar: 'Implementación habitual', holgada: 'Equipo técnico limitado o agenda apretada' }
              return (
                <button
                  key={pace}
                  onClick={() => update({ implPace: pace })}
                  className={`text-left p-3 rounded-lg border-2 transition ${data.implPace === pace ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className="font-semibold text-sm">{labels[pace]}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{descs[pace]}</p>
                </button>
              )
            })}
          </div>
        </Section>

        {/* 8. Alternativa Enterprise */}
        <Section title="8. Alternativa Enterprise (cuota fija)">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => update({ enterpriseEnabled: !data.enterpriseEnabled })}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${data.enterpriseEnabled ? 'bg-teal-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${data.enterpriseEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm font-medium">Incluir alternativa Enterprise a 12 meses</span>
          </label>

          {data.enterpriseEnabled && (
            <div className="grid grid-cols-2 gap-4 mt-2">
              <Field label="Fee fijo mensual (€)" hint="(sugerencia automática editable)">
                <input
                  type="number" min={0} className={inputCls}
                  value={data.enterpriseMonthlyFee ?? ''}
                  placeholder="Sugerencia automática"
                  onChange={(e) => update({ enterpriseMonthlyFee: e.target.value ? parseInt(e.target.value) : null })}
                />
              </Field>
              <Field label="Plazo">
                <input className={inputCls} value={data.enterpriseTerm} onChange={(e) => update({ enterpriseTerm: e.target.value })} placeholder="12 meses" />
              </Field>
              <div className="col-span-2">
                <Field label="Incluye (uno por línea)">
                  <textarea
                    className={`${inputCls} h-24 resize-none`}
                    value={data.enterpriseIncludes.join('\n')}
                    onChange={(e) => update({ enterpriseIncludes: e.target.value.split('\n').filter(Boolean) })}
                    placeholder="CSM dedicado&#10;SLA prioritario&#10;..."
                  />
                </Field>
              </div>
            </div>
          )}
        </Section>

        {/* 9. Notas y archivos */}
        <Section title="9. Notas de la demo y archivos">
          <Field label="Notas de la demo / briefing" hint="(se usan para personalizar la propuesta y el prompt HTML)">
            <textarea
              className={`${inputCls} h-36 resize-none font-mono text-xs`}
              value={data.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Apuntes de la demo, necesidades del cliente, puntos clave comentados..."
            />
          </Field>

          {/* File upload */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label
                htmlFor={assetInputId}
                className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors ${assetUploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {assetUploading ? 'Subiendo…' : '📎 Adjuntar archivo'}
              </label>
              <input
                id={assetInputId}
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.svg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) { handleAssetUpload(file); e.target.value = '' }
                }}
              />
              <span className="text-xs text-gray-400">PDF, DOCX, TXT, MD, CSV, imágenes (max 10 MB)</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">Los archivos .txt y .md se añaden automáticamente a las notas.</p>

            {assetError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                {assetError}
              </div>
            )}

            {assets.length > 0 && (
              <div className="space-y-1">
                {assets.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-400">
                      {a.kind === 'image' ? '🖼' : a.kind === 'pdf' ? '📄' : a.kind === 'notes' ? '📝' : '📎'}
                    </span>
                    <span className="flex-1 truncate text-gray-700">{a.filename}</span>
                    <button
                      onClick={() => handleAssetDelete(a.id)}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* 10. Mensaje personalizado */}
        <Section title="10. Mensaje personalizado">
          <Field label="Resumen ejecutivo" hint="(aparece en la propuesta del cliente)">
            <textarea
              className={`${inputCls} h-28 resize-none`}
              value={data.message}
              onChange={(e) => update({ message: e.target.value })}
              placeholder="Escribe un mensaje personalizado para el cliente..."
            />
          </Field>
        </Section>

        {/* 11. Compartir */}
        <Section title="11. Compartir propuesta">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Genera un link público de solo lectura para enviar al cliente. El cliente podrá ver la propuesta y descargar el PDF sin necesidad de iniciar sesión.
            </p>

            {shareUrl ? (
              <div className="space-y-3">
                <div className="flex gap-2 items-center">
                  <input
                    readOnly
                    value={shareUrl}
                    className={`${inputCls} flex-1 bg-gray-50 text-gray-600 font-mono text-xs`}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={handleCopy}
                    className="shrink-0 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                <div className="flex gap-3">
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Abrir link →
                  </a>
                  <button
                    onClick={handleShareRevoke}
                    disabled={shareLoading}
                    className="text-sm text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
                  >
                    Revocar link
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleShareCreate}
                disabled={shareLoading}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {shareLoading ? 'Generando…' : '🔗 Generar link de compartir'}
              </button>
            )}
          </div>
        </Section>

      </div>

      {/* ── Right: summary panel ── */}
      <SummaryPanel
        ordersOnline={data.ordersOnline}
        ordersOffline={data.ordersOffline}
        offlineRegPct={data.offlineRegPct}
        activityFactor={data.activityFactor}
        channelOnline={data.channelOnline}
        channelStore={data.channelStore}
        techCrm={data.techCrm}
        features={data.features}
        implPace={data.implPace}
        enterpriseEnabled={data.enterpriseEnabled}
        enterpriseMonthlyFee={data.enterpriseMonthlyFee}
      />
    </div>
  )
}
