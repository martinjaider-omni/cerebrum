'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { RevenueChart, MrrChart, CustomersChart, ChurnVsNewChart, PlanDonutChart } from '@/components/dashboard/Charts'

interface MonthlySnapshot {
  month: string
  revenue: number
  mrr: number
  customers: number
  newCustomers: number
  churnedCustomers?: number
}

interface PlanMetrics {
  plan: string
  monthly: number
  annual: number
  total: number
  mrr: number
}

interface CustomerRecord {
  customer: string
  email: string
  plan: string
  billingInterval: 'monthly' | 'annual'
  totalAmount: number
  monthlyAmount: number
  status: string
  source: 'stripe' | 'holded'
  created: string
  items: string[]
}

interface Metrics {
  configured: boolean
  mrr: number
  arr: number
  totalCustomers: number
  freeCustomers: number
  payingCustomers: number
  newCustomersThisMonth: number
  newPayingThisMonth?: number
  churnedThisMonth: number
  churnRate: number
  avgRevenuePerCustomer: number
  planBreakdown: PlanMetrics[]
  customers: CustomerRecord[]
  history: MonthlySnapshot[]
  sources: { stripe: boolean; holded: boolean }
}

function formatEur(value: number): string {
  if (!isFinite(value) || isNaN(value)) return '-'
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const planColors: Record<string, string> = {
  Free: 'bg-gray-100 text-gray-600',
  Starter: 'bg-blue-100 text-blue-700',
  Plus: 'bg-purple-100 text-purple-700',
  Advanced: 'bg-[#3E95B0]/15 text-[#255664]',
  Legacy: 'bg-amber-100 text-amber-700',
}

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom'

function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  switch (period) {
    case 'this_month': return { from: new Date(y, m, 1), to: now }
    case 'last_month': return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) }
    case 'this_quarter': { const q = Math.floor(m / 3) * 3; return { from: new Date(y, q, 1), to: now } }
    case 'last_quarter': { const q = Math.floor(m / 3) * 3; return { from: new Date(y, q - 3, 1), to: new Date(y, q, 0) } }
    case 'this_year': return { from: new Date(y, 0, 1), to: now }
    default: return { from: new Date(y, 0, 1), to: now }
  }
}

const CUSTOMERS_PER_PAGE = 15
const CACHE_KEY = 'dashboard_metrics_cache'

type SortField = 'customer' | 'plan' | 'monthlyAmount' | 'totalAmount' | 'created'

function DeltaBadge({ current, previous, format = 'pct' }: { current: number; previous: number; format?: 'pct' | 'abs'; invert?: boolean }) {
  if (!isFinite(current) || !isFinite(previous)) return null
  if (previous === 0 && current === 0) return null
  const diff = current - previous
  const pctChange = previous !== 0 ? (diff / previous) * 100 : (current > 0 ? 100 : 0)
  if (!isFinite(pctChange)) return null
  const isPositive = diff > 0
  const isNeutral = diff === 0
  const color = isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-600' : 'text-red-500'
  const arrow = isNeutral ? '' : diff > 0 ? '+' : ''
  const label = format === 'pct' ? `${arrow}${Math.round(pctChange)}%` : `${arrow}${Math.round(diff * 100) / 100}`

  return <span className={`text-xs font-medium ${color}`}>{label}</span>
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="h-3 w-16 bg-gray-200 rounded mb-3" />
      <div className="h-7 w-24 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-32 bg-gray-100 rounded" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-4 w-40 bg-gray-200 rounded mb-4" />
      <div className="h-48 bg-gray-100 rounded" />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-48 bg-gray-100 rounded" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
        <div className="h-7 w-32 bg-gray-200 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart /><SkeletonChart />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'paying' | 'free'>('all')
  const [period, setPeriod] = useState<Period>('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('monthlyAmount')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [customerPage, setCustomerPage] = useState(1)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isStale, setIsStale] = useState(false)

  const applyMetrics = useCallback((data: Metrics, fromCache = false) => {
    // Ensure all fields have safe defaults
    data.customers = data.customers ?? []
    data.history = data.history ?? []
    data.planBreakdown = data.planBreakdown ?? []
    data.sources = data.sources ?? { stripe: false, holded: false }
    data.mrr = data.mrr ?? 0
    data.arr = data.arr ?? 0
    data.totalCustomers = data.totalCustomers ?? 0
    data.freeCustomers = data.freeCustomers ?? 0
    data.payingCustomers = data.payingCustomers ?? 0
    data.churnedThisMonth = data.churnedThisMonth ?? 0
    data.churnRate = data.churnRate ?? 0
    data.avgRevenuePerCustomer = data.avgRevenuePerCustomer ?? 0
    data.newCustomersThisMonth = data.newCustomersThisMonth ?? 0
    setMetrics(data)
    setIsStale(fromCache)
    if (!fromCache) {
      setLastUpdated(new Date())
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch (_e) { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    // 1. Show cached data instantly
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (data?.configured && Date.now() - ts < 30 * 60 * 1000) {
          applyMetrics(data, true)
          setLoading(false)
          setLastUpdated(new Date(ts))
        }
      }
    } catch (_e) { /* ignore */ }

    // 2. Fetch fresh data
    fetch('/api/dashboard/metrics')
      .then((r) => { if (!r.ok) throw new Error('Error cargando metricas'); return r.json() })
      .then((d) => { applyMetrics(d); setLoading(false) })
      .catch((err) => { if (!metrics) setError(err.message); setLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const r = await fetch('/api/dashboard/metrics?refresh=1')
      if (!r.ok) throw new Error('Error')
      const d = await r.json()
      applyMetrics(d)
    } catch (_e) { /* ignore */ }
    setRefreshing(false)
  }

  // Reset page when filters change
  useEffect(() => { setCustomerPage(1) }, [filter, customerSearch, sortField, sortDir])

  if (loading && !metrics) {
    return <DashboardSkeleton />
  }

  if (error && !metrics) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800"><strong>Error:</strong> {error}</div>
      </div>
    )
  }

  if (!metrics?.configured) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#232323] mb-6">Dashboard</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm text-amber-800 font-medium">
            Configura Stripe y/o Holded en <a href="/settings" className="underline">Ajustes</a>
          </p>
          <p className="text-xs text-amber-600 mt-1">Conecta al menos una fuente para ver las metricas SaaS.</p>
        </div>
      </div>
    )
  }

  // Filter history by period
  const range = period === 'custom' && customFrom && customTo
    ? { from: new Date(customFrom), to: new Date(customTo) }
    : getPeriodRange(period)

  const filteredHistory = (metrics.history ?? []).filter((h) => {
    const d = new Date(h.month + '-01')
    return d >= range.from && d <= range.to
  })

  const periodRevenue = filteredHistory.reduce((s, h) => s + h.revenue, 0)

  const periodLabels: Record<Period, string> = {
    this_month: 'Este mes',
    last_month: 'Mes anterior',
    this_quarter: 'Trimestre actual',
    last_quarter: 'Trimestre anterior',
    this_year: 'Este año',
    custom: 'Personalizado',
  }

  // -- Computed deltas from history --
  const fullHistory = metrics.history ?? []
  const prevMonthData = fullHistory.length >= 2 ? fullHistory[fullHistory.length - 2] : null
  const prevMrr = prevMonthData?.mrr ?? 0
  const prevCustomers = prevMonthData?.customers ?? 0
  const prevArpu = prevCustomers > 0 ? prevMrr / prevCustomers : 0

  // -- NRR (Net Revenue Retention) --
  const nrr = prevMrr > 0 ? (metrics.mrr / prevMrr) * 100 : 100

  // -- LTV --
  const monthlyChurnRate = (metrics.churnRate ?? 0) / 100
  const ltv = monthlyChurnRate > 0 ? metrics.avgRevenuePerCustomer / monthlyChurnRate : 0

  // -- Quick Ratio --
  const newPayingCount = metrics.newPayingThisMonth ?? metrics.newCustomersThisMonth ?? 0
  const newMrr = newPayingCount * metrics.avgRevenuePerCustomer
  const churnedMrr = (metrics.churnedThisMonth ?? 0) * metrics.avgRevenuePerCustomer
  const quickRatio = churnedMrr > 0 ? newMrr / churnedMrr : (newMrr > 0 ? Infinity : 0)

  // -- Revenue concentration --
  const payingCustomersSorted = (metrics.customers ?? [])
    .filter((c) => c.monthlyAmount > 0)
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
  const top3 = payingCustomersSorted.slice(0, 3)
  const top3Mrr = top3.reduce((s, c) => s + c.monthlyAmount, 0)
  const top3Pct = metrics.mrr > 0 ? (top3Mrr / metrics.mrr) * 100 : 0

  // -- Filtered & sorted customers --
  const customers = metrics.customers ?? []
  const filteredCustomers = (() => {
    let list = customers.filter((c) => {
      if (filter === 'paying') return c.plan !== 'Free' && c.monthlyAmount > 0
      if (filter === 'free') return c.plan === 'Free' || c.monthlyAmount === 0
      return true
    })
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase()
      list = list.filter((c) => c.customer.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortField) {
        case 'customer': av = a.customer.toLowerCase(); bv = b.customer.toLowerCase(); break
        case 'plan': av = a.plan; bv = b.plan; break
        case 'monthlyAmount': av = a.monthlyAmount; bv = b.monthlyAmount; break
        case 'totalAmount': av = a.totalAmount; bv = b.totalAmount; break
        case 'created': av = a.created; bv = b.created; break
        default: av = a.monthlyAmount; bv = b.monthlyAmount
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  })()

  const totalCustomerPages = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE))
  const safePage = Math.min(customerPage, totalCustomerPages)
  const paginatedCustomers = filteredCustomers.slice((safePage - 1) * CUSTOMERS_PER_PAGE, safePage * CUSTOMERS_PER_PAGE)

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return <span className="text-gray-300 ml-0.5">&#8597;</span>
    return <span className="text-[#3E95B0] ml-0.5">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  function exportCsv() {
    const headers = ['Cliente', 'Email', 'Plan', 'Ciclo', 'Importe', 'MRR', 'Fuente', 'Alta']
    const rows = filteredCustomers.map((c) => [
      c.customer, c.email, c.plan,
      c.billingInterval === 'annual' ? 'Anual' : 'Mensual',
      c.totalAmount, c.monthlyAmount, c.source,
      new Date(c.created).toLocaleDateString('es-ES'),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#232323]">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Metricas SaaS
            {metrics.sources?.stripe && metrics.sources?.holded ? ' — Stripe + Holded' :
             metrics.sources?.stripe ? ' — Stripe' :
             metrics.sources?.holded ? ' — Holded' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isStale && (
            <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">datos en cache</span>
          )}
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>{'\u21BB'}</span>
            {refreshing ? 'Actualizando...' : 'Refrescar'}
          </button>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3E95B0]"
          >
            {Object.entries(periodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {period === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
              <span className="text-gray-400 text-sm">{'\u2192'}</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
            </>
          )}
        </div>
      </div>

      {/* Period revenue summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase">Facturado ({periodLabels[period]})</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{formatEur(periodRevenue)}</p>
          <p className="text-xs text-gray-400">{filteredHistory.length} mes{filteredHistory.length !== 1 ? 'es' : ''} · sin impuestos</p>
        </div>
      </div>

      {/* Revenue KPI cards with deltas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">MRR</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{formatEur(metrics.mrr)}</p>
          <div className="flex items-center gap-2 mt-1">
            <DeltaBadge current={metrics.mrr} previous={prevMrr} />
            <span className="text-xs text-gray-400">vs mes ant.</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">ARR</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{formatEur(metrics.arr)}</p>
          <div className="flex items-center gap-2 mt-1">
            <DeltaBadge current={metrics.arr} previous={prevMrr * 12} />
            <span className="text-xs text-gray-400">vs mes ant.</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">ARPU</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{formatEur(metrics.avgRevenuePerCustomer)}</p>
          <div className="flex items-center gap-2 mt-1">
            <DeltaBadge current={metrics.avgRevenuePerCustomer} previous={prevArpu} />
            <span className="text-xs text-gray-400">vs mes ant.</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Churn</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{metrics.churnRate ?? 0}%</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{metrics.churnedThisMonth ?? 0} baja{(metrics.churnedThisMonth ?? 0) !== 1 ? 's' : ''} este mes</span>
          </div>
        </div>
      </div>

      {/* Customer KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total cuentas</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{metrics.totalCustomers}</p>
          <p className="text-xs text-gray-400 mt-1">Free + pago</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-[#3E95B0] uppercase tracking-wide">De pago</p>
          <p className="text-2xl font-bold text-[#3E95B0] mt-1">{metrics.payingCustomers}</p>
          <div className="flex items-center gap-2 mt-1">
            <DeltaBadge current={metrics.payingCustomers} previous={prevCustomers} format="abs" />
            <span className="text-xs text-gray-400">vs mes ant.</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Free</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{metrics.freeCustomers}</p>
          <p className="text-xs text-gray-400 mt-1">Cuentas gratuitas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Nuevos de pago</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{newPayingCount}</p>
          <p className="text-xs text-gray-400 mt-1">Altas de pago en {new Date().toLocaleDateString('es-ES', { month: 'long' })}</p>
        </div>
      </div>

      {/* SaaS Health metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">NRR</p>
          <p className={`text-2xl font-bold mt-1 ${nrr >= 100 ? 'text-emerald-600' : 'text-red-500'}`}>
            {isFinite(nrr) ? Math.round(nrr) : '-'}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Net Revenue Retention</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">LTV</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{ltv > 0 && isFinite(ltv) ? formatEur(ltv) : '-'}</p>
          <p className="text-xs text-gray-400 mt-1">Lifetime Value estimado</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quick Ratio</p>
          <p className={`text-2xl font-bold mt-1 ${quickRatio >= 4 ? 'text-emerald-600' : quickRatio >= 2 ? 'text-amber-600' : 'text-red-500'}`}>
            {!isFinite(quickRatio) ? (quickRatio === Infinity ? '\u221E' : '-') : quickRatio > 0 ? quickRatio.toFixed(1) : '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{quickRatio >= 4 ? 'Excelente' : quickRatio >= 2 ? 'Saludable' : quickRatio > 0 && isFinite(quickRatio) ? 'Bajo' : ''}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Concentracion Top 3</p>
          <p className={`text-2xl font-bold mt-1 ${top3Pct > 50 ? 'text-red-500' : top3Pct > 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {isFinite(top3Pct) ? Math.round(top3Pct) : 0}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {top3Pct > 50 ? 'Riesgo alto' : top3Pct > 30 ? 'Concentrado' : 'Diversificado'}
          </p>
        </div>
      </div>

      {/* Revenue concentration detail */}
      {top3.length > 0 && top3Pct > 20 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-3">Top clientes por MRR</p>
          <div className="space-y-2">
            {top3.map((c, i) => {
              const pct = metrics.mrr > 0 ? (c.monthlyAmount / metrics.mrr) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                  <span className="text-sm font-medium text-[#232323] flex-1">{c.customer}</span>
                  <span className="text-sm text-gray-600">{formatEur(c.monthlyAmount)}</span>
                  <div className="w-24 bg-gray-100 rounded-full h-2">
                    <div className="bg-[#3E95B0] h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-right">{Math.round(pct)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      {filteredHistory.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={filteredHistory} />
          <MrrChart data={filteredHistory} />
        </div>
      )}

      {/* Charts Row 2 */}
      {filteredHistory.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CustomersChart data={filteredHistory} />
          <ChurnVsNewChart data={filteredHistory} />
        </div>
      )}

      {/* Plan Donut + Breakdown */}
      {(metrics.planBreakdown ?? []).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlanDonutChart
            data={(metrics.planBreakdown ?? []).map((p) => ({ plan: p.plan, mrr: p.mrr, count: p.total }))}
            totalMrr={metrics.mrr}
          />

          {/* Plan breakdown table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-[#232323]">Desglose por plan</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5">Plan</th>
                  <th className="text-right px-5 py-2.5">Mensual</th>
                  <th className="text-right px-5 py-2.5">Anual</th>
                  <th className="text-right px-5 py-2.5">Total</th>
                  <th className="text-right px-5 py-2.5">MRR</th>
                  <th className="text-right px-5 py-2.5">% MRR</th>
                </tr>
              </thead>
              <tbody>
                {(metrics.planBreakdown ?? []).map((p) => (
                  <tr key={p.plan} className="border-t border-gray-100">
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${planColors[p.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{p.monthly}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{p.annual}</td>
                    <td className="px-5 py-3 text-right font-medium text-[#232323]">{p.total}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{p.plan === 'Free' ? '-' : formatEur(p.mrr)}</td>
                    <td className="px-5 py-3 text-right text-gray-400">
                      {p.plan === 'Free' ? '-' : metrics.mrr > 0 ? `${Math.round((p.mrr / metrics.mrr) * 100)}%` : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customers table */}
      {customers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-[#232323]">Clientes</h2>
              <div className="flex gap-1.5">
                {metrics.sources?.stripe && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Stripe</span>}
                {metrics.sources?.holded && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Holded</span>}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-[#3E95B0]"
              />
              <div className="flex gap-1">
                {(['all', 'paying', 'free'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition ${filter === f ? 'bg-[#3E95B0] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    {f === 'all' ? `Todos (${metrics.totalCustomers})` : f === 'paying' ? `Pago (${metrics.payingCustomers})` : `Free (${metrics.freeCustomers})`}
                  </button>
                ))}
              </div>
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                {'\u2193'} CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('customer')}>
                    Cliente {sortIndicator('customer')}
                  </th>
                  <th className="text-left px-5 py-2.5">Email</th>
                  <th className="text-left px-5 py-2.5 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('plan')}>
                    Plan {sortIndicator('plan')}
                  </th>
                  <th className="text-left px-5 py-2.5">Ciclo</th>
                  <th className="text-right px-5 py-2.5 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('totalAmount')}>
                    Importe {sortIndicator('totalAmount')}
                  </th>
                  <th className="text-right px-5 py-2.5 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('monthlyAmount')}>
                    MRR {sortIndicator('monthlyAmount')}
                  </th>
                  <th className="text-left px-5 py-2.5">Fuente</th>
                  <th className="text-left px-5 py-2.5 cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort('created')}>
                    Alta {sortIndicator('created')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-[#232323]">{c.customer}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{c.email || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[c.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {c.billingInterval === 'annual' ? 'Anual' : 'Mensual'}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{c.totalAmount > 0 ? formatEur(c.totalAmount) : '-'}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{c.monthlyAmount > 0 ? formatEur(c.monthlyAmount) : '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.source === 'stripe' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {c.source === 'stripe' ? 'Stripe' : 'Holded'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{new Date(c.created).toLocaleDateString('es-ES')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalCustomerPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? 's' : ''} · pagina {safePage} de {totalCustomerPages}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCustomerPage((p) => Math.min(totalCustomerPages, p + 1))}
                  disabled={safePage >= totalCustomerPages}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
