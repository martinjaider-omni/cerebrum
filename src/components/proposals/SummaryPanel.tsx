'use client'

import { compute, PLANS, type ComputeResult } from '@/lib/pricing'

interface Props {
  ordersOnline: number
  ordersOffline: number
  offlineRegPct: number
  activityFactor: number
  channelOnline: boolean
  channelStore: boolean
  techCrm: string
  features: string[]
  implPace: 'rapida' | 'estandar' | 'holgada'
  enterpriseEnabled: boolean
  enterpriseMonthlyFee: number | null
}

export function SummaryPanel(props: Props) {
  const result: ComputeResult = compute({
    ordersOnline: props.ordersOnline,
    ordersOffline: props.ordersOffline,
    offlineRegPct: props.offlineRegPct,
    activityFactor: props.activityFactor,
    channelOnline: props.channelOnline,
    channelStore: props.channelStore,
    techCrm: props.techCrm,
    features: props.features,
    implPace: props.implPace,
  })

  const plan = PLANS[result.recommendedPlanId as keyof typeof PLANS]
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const fmtN = (n: number) => new Intl.NumberFormat('es-ES').format(n)

  const enterpriseFee = props.enterpriseEnabled
    ? (props.enterpriseMonthlyFee ?? result.suggestedEnterpriseFee)
    : null

  return (
    <div className="w-72 shrink-0 space-y-4">
      {/* Plan recomendado */}
      <div className="bg-[#232323] text-white rounded-xl p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Plan recomendado</p>
        <p className="text-2xl font-bold">{plan?.name ?? '—'}</p>
        {result.enterpriseRequired && (
          <span className="inline-block mt-1 text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
            Enterprise requerido
          </span>
        )}
      </div>

      {/* Actividades */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Actividades / mes</p>
        <p className="text-3xl font-bold text-gray-900">{fmtN(result.activitiesPerMonth)}</p>
        {result.warnings.includes('freemium_eligible') && (
          <p className="text-xs text-green-600 mt-1">Elegible Freemium</p>
        )}
        {result.warnings.includes('volume_high') && (
          <p className="text-xs text-orange-600 mt-1">Volumen alto — Enterprise a medida</p>
        )}
      </div>

      {/* Coste */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Propuesta económica</p>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-gray-600">Mensual</span>
          <span className="text-xl font-bold text-[#3E95B0]">{fmt(result.monthlyCost)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-gray-600">Anual</span>
          <span className="text-base font-semibold text-gray-700">{fmt(result.annualCost)}</span>
        </div>
        {result.tieredBreakdown.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Desglose adicionales</p>
            {result.tieredBreakdown.map((t, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-500">
                <span>{fmtN(t.units)} act. @ {t.price}€</span>
                <span>{fmt(t.subtotal)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enterprise alternativa */}
      {enterpriseFee !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <p className="text-xs text-amber-700 uppercase tracking-wider font-medium">Fee fijo Enterprise</p>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-amber-800">Mensual</span>
            <span className="text-xl font-bold text-amber-700">{fmt(enterpriseFee)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-amber-800">12 meses</span>
            <span className="text-base font-semibold text-amber-700">{fmt(enterpriseFee * 12)}</span>
          </div>
        </div>
      )}

      {/* Roadmap resumen */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Roadmap estimado</p>
        <div className="space-y-1">
          {result.roadmap.filter(p => p.weeks > 0).map((p) => (
            <div key={p.phase} className="flex justify-between text-xs">
              <span className="text-gray-600 truncate pr-2">{p.name}</span>
              <span className="text-gray-400 shrink-0">{p.weeks}s</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs font-medium">
          <span>Total semanas</span>
          <span>{result.roadmap.reduce((a, p) => a + p.weeks, 0)} sem</span>
        </div>
      </div>
    </div>
  )
}
