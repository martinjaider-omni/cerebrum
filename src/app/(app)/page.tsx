'use client'

import { useState, useEffect } from 'react'
import { RevenueChart, MrrChart, CustomersChart } from '@/components/dashboard/Charts'

interface MonthlySnapshot {
  month: string
  revenue: number
  mrr: number
  customers: number
  newCustomers: number
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
  churnedThisMonth: number
  churnRate: number
  avgRevenuePerCustomer: number
  planBreakdown: PlanMetrics[]
  customers: CustomerRecord[]
  history: MonthlySnapshot[]
  sources: { stripe: boolean; holded: boolean }
}

function formatEur(value: number): string {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const planColors: Record<string, string> = {
  Free: 'bg-gray-100 text-gray-600',
  Starter: 'bg-blue-100 text-blue-700',
  Plus: 'bg-purple-100 text-purple-700',
  Advanced: 'bg-[#3E95B0]/15 text-[#255664]',
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

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'paying' | 'free'>('all')
  const [period, setPeriod] = useState<Period>('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then((r) => { if (!r.ok) throw new Error('Error cargando métricas'); return r.json() })
      .then((d) => { setMetrics(d); setLoading(false) })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#3E95B0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
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
          <p className="text-xs text-amber-600 mt-1">Conecta al menos una fuente para ver las métricas SaaS.</p>
        </div>
      </div>
    )
  }

  const filteredCustomers = metrics.customers.filter((c) => {
    if (filter === 'paying') return c.plan !== 'Free' && c.monthlyAmount > 0
    if (filter === 'free') return c.plan === 'Free' || c.monthlyAmount === 0
    return true
  })

  // Filter history by period
  const range = period === 'custom' && customFrom && customTo
    ? { from: new Date(customFrom), to: new Date(customTo) }
    : getPeriodRange(period)

  const filteredHistory = (filteredHistory ?? []).filter((h) => {
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#232323]">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Métricas SaaS
            {metrics.sources?.stripe && metrics.sources?.holded ? ' — Stripe + Holded' :
             metrics.sources?.stripe ? ' — Stripe' :
             metrics.sources?.holded ? ' — Holded' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              <span className="text-gray-400 text-sm">→</span>
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

      {/* Revenue cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">MRR</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{formatEur(metrics.mrr)}</p>
          <p className="text-xs text-gray-400 mt-1">Ingreso mensual recurrente</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">ARR</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{formatEur(metrics.arr)}</p>
          <p className="text-xs text-gray-400 mt-1">Ingreso anual recurrente</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">ARPU</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{formatEur(metrics.avgRevenuePerCustomer)}</p>
          <p className="text-xs text-gray-400 mt-1">Ingreso medio / cliente de pago</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Churn</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{metrics.churnRate}%</p>
          <p className="text-xs text-gray-400 mt-1">{metrics.churnedThisMonth} baja{metrics.churnedThisMonth !== 1 ? 's' : ''} este mes</p>
        </div>
      </div>

      {/* Customer cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total cuentas</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{metrics.totalCustomers}</p>
          <p className="text-xs text-gray-400 mt-1">Free + pago</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-[#3E95B0] uppercase tracking-wide">De pago</p>
          <p className="text-2xl font-bold text-[#3E95B0] mt-1">{metrics.payingCustomers}</p>
          <p className="text-xs text-gray-400 mt-1">Starter + Plus + Advanced</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Free</p>
          <p className="text-2xl font-bold text-[#232323] mt-1">{metrics.freeCustomers}</p>
          <p className="text-xs text-gray-400 mt-1">Cuentas gratuitas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Nuevos este mes</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{metrics.newCustomersThisMonth}</p>
          <p className="text-xs text-gray-400 mt-1">Altas en {new Date().toLocaleDateString('es-ES', { month: 'long' })}</p>
        </div>
      </div>

      {/* Charts */}
      {filteredHistory && filteredHistory.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={filteredHistory} />
          <MrrChart data={filteredHistory} />
        </div>
      )}
      {filteredHistory && filteredHistory.length > 1 && (
        <CustomersChart data={filteredHistory} />
      )}

      {/* Plan breakdown */}
      {metrics.planBreakdown.length > 0 && (
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
              {metrics.planBreakdown.map((p) => (
                <tr key={p.plan} className="border-t border-gray-100">
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${planColors[p.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.plan}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{p.monthly}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{p.annual}</td>
                  <td className="px-5 py-3 text-right font-medium text-[#232323]">{p.total}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{p.plan === 'Free' ? '—' : formatEur(p.mrr)}</td>
                  <td className="px-5 py-3 text-right text-gray-400">
                    {p.plan === 'Free' ? '—' : metrics.mrr > 0 ? `${Math.round((p.mrr / metrics.mrr) * 100)}%` : '0%'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customers table */}
      {metrics.customers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-[#232323]">Clientes</h2>
              <div className="flex gap-1.5">
                {metrics.sources?.stripe && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Stripe</span>}
                {metrics.sources?.holded && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Holded</span>}
              </div>
            </div>
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
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5">Cliente</th>
                  <th className="text-left px-5 py-2.5">Email</th>
                  <th className="text-left px-5 py-2.5">Plan</th>
                  <th className="text-left px-5 py-2.5">Ciclo</th>
                  <th className="text-right px-5 py-2.5">Importe</th>
                  <th className="text-right px-5 py-2.5">MRR</th>
                  <th className="text-left px-5 py-2.5">Fuente</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-[#232323]">{c.customer}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{c.email || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[c.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {c.billingInterval === 'annual' ? 'Anual' : 'Mensual'}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{c.totalAmount > 0 ? formatEur(c.totalAmount) : '—'}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{c.monthlyAmount > 0 ? formatEur(c.monthlyAmount) : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.source === 'stripe' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {c.source === 'stripe' ? 'Stripe' : 'Holded'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
