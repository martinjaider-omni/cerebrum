// Plans
export const PLANS = {
  freemium:   { id: 'freemium',   name: 'Freemium',   base: 0,   included: 100 },
  starter:    { id: 'starter',    name: 'Starter',    base: 39,  included: 650 },
  plus:       { id: 'plus',       name: 'Plus',       base: 199, included: 1900 },
  advanced:   { id: 'advanced',   name: 'Advanced',   base: 399, included: 3900 },
  enterprise: { id: 'enterprise', name: 'Enterprise', base: 0,   included: Infinity },
} as const

// Activity tiers (additional activities pricing)
const TIERS = [
  { upTo: 1000,  price: 0.10 },
  { upTo: 5000,  price: 0.08 },
  { upTo: 10000, price: 0.06 },
  { upTo: 50000, price: 0.04 },
  { upTo: Infinity, price: 0.02 },
]

export function calcActivities(params: {
  ordersOnline: number
  ordersOffline: number
  offlineRegPct: number
  activityFactor: number
}): number {
  const effective = params.ordersOnline + params.ordersOffline * (params.offlineRegPct / 100)
  return Math.round(effective * params.activityFactor)
}

export function calcTieredCost(additionalActivities: number): number {
  let remaining = additionalActivities
  let cost = 0
  let prev = 0
  for (const tier of TIERS) {
    if (remaining <= 0) break
    const tierSize = tier.upTo === Infinity ? remaining : tier.upTo - prev
    const used = Math.min(remaining, tierSize)
    cost += used * tier.price
    remaining -= used
    prev = tier.upTo === Infinity ? prev : tier.upTo
  }
  return Math.round(cost * 100) / 100
}

export function calcMonthlyCost(planId: string, activitiesPerMonth: number): number {
  const plan = PLANS[planId as keyof typeof PLANS]
  if (!plan || planId === 'enterprise') return 0
  const additional = Math.max(0, activitiesPerMonth - plan.included)
  return plan.base + calcTieredCost(additional)
}

export const FEATURE_PLAN_MAP: Record<string, string> = {
  'wallet': 'starter',
  'loyalty': 'starter',
  'cdp': 'starter',
  'api': 'starter',
  'push': 'starter',
  'tpv': 'starter',
  'stamps': 'starter',
  'points_expiry': 'starter',
  'blocked_points': 'starter',
  'gift_cards': 'plus',
  'referrals': 'plus',
  'cashback': 'plus',
  'levels': 'plus',
  'loyalty_analytics': 'plus',
  'data_enrichment': 'plus',
  'segmentation': 'plus',
  'multi_brand': 'advanced',
  'loyalty_market': 'advanced',
  'realtime_analytics': 'advanced',
  'campaign_automation': 'advanced',
  'workflows': 'advanced',
  'gamification': 'advanced',
  'ropo': 'advanced',
  'omnicodex': 'advanced',
  'custom_integrations': 'enterprise',
  'strategic_consulting': 'enterprise',
  'migration': 'enterprise',
  'priority_support': 'enterprise',
  'csm': 'enterprise',
  'annual_payment': 'enterprise',
}

const PLAN_ORDER = ['starter', 'plus', 'advanced', 'enterprise']

export function recommendPlan(features: string[]): { planId: string; enterpriseRequired: boolean } {
  let maxPlanIdx = 0
  let enterpriseRequired = false
  for (const feature of features) {
    const minPlan = FEATURE_PLAN_MAP[feature]
    if (!minPlan) continue
    if (minPlan === 'enterprise') {
      enterpriseRequired = true
      continue
    }
    const idx = PLAN_ORDER.indexOf(minPlan)
    if (idx > maxPlanIdx) maxPlanIdx = idx
  }
  const planId = PLAN_ORDER[maxPlanIdx] || 'starter'
  return { planId, enterpriseRequired }
}

export function suggestEnterpriseFee(monthlyCost: number, planBase: number): number {
  const suggested = Math.ceil(monthlyCost / 50) * 50
  return Math.max(suggested, planBase)
}

export const IMPL_PACE_MULTIPLIERS = {
  rapida: 0.6,
  estandar: 1.0,
  holgada: 1.6,
}

export function calcRoadmap(params: {
  channelOnline: boolean
  channelStore: boolean
  techCrm: string
  features: string[]
  implPace: 'rapida' | 'estandar' | 'holgada'
}): Array<{ phase: number; name: string; weeks: number }> {
  const mult = IMPL_PACE_MULTIPLIERS[params.implPace]
  const w = (base: number) => Math.max(1, Math.round(base * mult))

  const phases = [
    { phase: 1, name: 'Kick-off & alineación técnica', weeks: w(1), always: true },
    { phase: 2, name: 'Configuración base (cuenta, puntos, Wallet, niveles)', weeks: w(2), always: true },
    { phase: 3, name: 'Integración eCommerce', weeks: w(1), cond: params.channelOnline },
    { phase: 4, name: 'Integración TPV & tiendas físicas', weeks: w(2), cond: params.channelStore },
    { phase: 5, name: 'Sincronización con CRM', weeks: w(1), cond: !!params.techCrm && params.techCrm !== 'No tiene' && params.techCrm !== '' },
    { phase: 6, name: 'Loyalty Market / catálogo de premios', weeks: w(2), cond: params.features.includes('loyalty_market') },
    { phase: 7, name: 'Comunicaciones (push, WhatsApp, email)', weeks: w(1), always: true },
    { phase: 8, name: 'Marketing & automatización avanzada', weeks: w(2), cond: params.features.some(f => ['workflows','gamification','campaign_automation'].includes(f)) },
    { phase: 9, name: 'Analítica, ROPO & segmentación', weeks: w(1), cond: params.features.some(f => ['loyalty_analytics','ropo','realtime_analytics','segmentation'].includes(f)) },
    { phase: 10, name: 'Formación, QA & go-live', weeks: w(1), always: true },
    { phase: 11, name: 'Hand-off a Onboarding & seguimiento', weeks: w(1), always: true },
  ]

  return phases
    .filter(p => (p as any).always || (p as any).cond)
    .map(({ phase, name, weeks }) => ({ phase, name, weeks }))
}

export interface ComputeResult {
  activitiesPerMonth: number
  recommendedPlanId: string
  enterpriseRequired: boolean
  monthlyCost: number
  annualCost: number
  tieredBreakdown: Array<{ label: string; units: number; price: number; subtotal: number }>
  suggestedEnterpriseFee: number
  warnings: string[]
  roadmap: Array<{ phase: number; name: string; weeks: number }>
}

export function compute(params: {
  ordersOnline: number
  ordersOffline: number
  offlineRegPct: number
  activityFactor: number
  channelOnline: boolean
  channelStore: boolean
  techCrm: string
  features: string[]
  implPace: 'rapida' | 'estandar' | 'holgada'
}): ComputeResult {
  const activitiesPerMonth = calcActivities(params)
  const { planId: recommendedPlanId, enterpriseRequired } = recommendPlan(params.features)
  const monthlyCost = calcMonthlyCost(recommendedPlanId, activitiesPerMonth)
  const annualCost = monthlyCost * 12

  const plan = PLANS[recommendedPlanId as keyof typeof PLANS]
  const additional = Math.max(0, activitiesPerMonth - (plan?.included ?? 0))

  const tieredBreakdown: ComputeResult['tieredBreakdown'] = []
  let remaining = additional
  let prev = 0
  const tierLabels = ['1–1.000', '1.001–5.000', '5.001–10.000', '10.001–50.000', '>50.000']
  for (let i = 0; i < TIERS.length; i++) {
    if (remaining <= 0) break
    const tier = TIERS[i]
    const tierSize = tier.upTo === Infinity ? remaining : tier.upTo - prev
    const used = Math.min(remaining, tierSize)
    tieredBreakdown.push({
      label: tierLabels[i],
      units: used,
      price: tier.price,
      subtotal: Math.round(used * tier.price * 100) / 100,
    })
    remaining -= used
    prev = tier.upTo === Infinity ? prev : tier.upTo
  }

  const warnings: string[] = []
  if (activitiesPerMonth <= 100) warnings.push('freemium_eligible')
  if (activitiesPerMonth > 150000) warnings.push('volume_high')
  if (enterpriseRequired) warnings.push('enterprise_required')

  const roadmap = calcRoadmap(params)
  const suggestedEnterpriseFee = suggestEnterpriseFee(monthlyCost, plan?.base ?? 0)

  return {
    activitiesPerMonth,
    recommendedPlanId,
    enterpriseRequired,
    monthlyCost,
    annualCost,
    tieredBreakdown,
    suggestedEnterpriseFee,
    warnings,
    roadmap,
  }
}
