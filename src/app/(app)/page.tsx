'use client'

import { useState, useEffect } from 'react'

interface PlanBreakdown {
  plan: string
  count: number
  mrr: number
}

interface RecentSubscription {
  customer: string
  email: string
  plan: string
  amount: number
  status: string
  created: string
}

interface Metrics {
  configured: boolean
  mrr: number
  arr: number
  totalCustomers: number
  payingCustomers: number
  newCustomersThisMonth: number
  churnedThisMonth: number
  churnRate: number
  avgRevenuePerCustomer: number
  planBreakdown: PlanBreakdown[]
  recentSubscriptions: RecentSubscription[]
}

function formatEur(value: number): string {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/metrics')
      .then((r) => {
        if (!r.ok) throw new Error('Error cargando metricas')
        return r.json()
      })
      .then((d) => {
        setMetrics(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
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
            Configura la API key de Stripe en Prospeccion &rarr; Configuracion
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Una vez configurada, veras aqui las metricas SaaS de tu cuenta de Stripe.
          </p>
        </div>
      </div>
    )
  }

  const cards = [
    { label: 'MRR', value: formatEur(metrics.mrr), sub: 'Ingreso mensual recurrente' },
    { label: 'ARR', value: formatEur(metrics.arr), sub: 'Ingreso anual recurrente' },
    { label: 'Clientes activos', value: metrics.payingCustomers.toLocaleString('es-ES'), sub: 'Suscripciones activas' },
    { label: 'Nuevos este mes', value: metrics.newCustomersThisMonth.toLocaleString('es-ES'), sub: 'Clientes nuevos' },
    { label: 'Churn rate', value: `${metrics.churnRate}%`, sub: `${metrics.churnedThisMonth} cancelado${metrics.churnedThisMonth !== 1 ? 's' : ''} este mes` },
    { label: 'ARPU', value: formatEur(metrics.avgRevenuePerCustomer), sub: 'Ingreso medio por cliente' },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#232323]">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Metricas SaaS en tiempo real desde Stripe</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-xl font-bold text-[#232323] mt-1">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

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
                <th className="text-right px-5 py-2.5">Suscriptores</th>
                <th className="text-right px-5 py-2.5">MRR</th>
                <th className="text-right px-5 py-2.5">% del total</th>
              </tr>
            </thead>
            <tbody>
              {metrics.planBreakdown.map((plan) => (
                <tr key={plan.plan} className="border-t border-gray-100">
                  <td className="px-5 py-3 font-medium text-[#232323]">{plan.plan}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{plan.count}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{formatEur(plan.mrr)}</td>
                  <td className="px-5 py-3 text-right text-gray-400">
                    {metrics.mrr > 0 ? `${Math.round((plan.mrr / metrics.mrr) * 100)}%` : '0%'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent subscriptions */}
      {metrics.recentSubscriptions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#232323]">Suscripciones recientes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2.5">Cliente</th>
                  <th className="text-left px-5 py-2.5">Email</th>
                  <th className="text-left px-5 py-2.5">Plan</th>
                  <th className="text-right px-5 py-2.5">Importe</th>
                  <th className="text-left px-5 py-2.5">Estado</th>
                  <th className="text-left px-5 py-2.5">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentSubscriptions.map((sub, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-5 py-3 font-medium text-[#232323]">{sub.customer}</td>
                    <td className="px-5 py-3 text-gray-500">{sub.email || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{sub.plan}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{formatEur(sub.amount)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        sub.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : sub.status === 'canceled'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {sub.status === 'active' ? 'Activo' : sub.status === 'canceled' ? 'Cancelado' : sub.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(sub.created).toLocaleDateString('es-ES')}
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
