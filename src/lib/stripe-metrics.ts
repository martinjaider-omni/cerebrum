import { db } from './db'

export interface SaasMetrics {
  mrr: number
  arr: number
  totalCustomers: number
  payingCustomers: number
  newCustomersThisMonth: number
  churnedThisMonth: number
  churnRate: number
  avgRevenuePerCustomer: number
  planBreakdown: Array<{ plan: string; count: number; mrr: number }>
  recentSubscriptions: Array<{ customer: string; email: string; plan: string; amount: number; status: string; created: string }>
}

export async function fetchSaasMetrics(): Promise<SaasMetrics | null> {
  const settings = await db.integrationSettings.findFirst()
  const stripeKey = (settings as Record<string, unknown>)?.stripeSecretKey as string
  if (!stripeKey) return null

  // Use Stripe REST API directly (no SDK needed)
  // Fetch active subscriptions, calculate MRR, ARR, etc.

  // Helper to call Stripe API
  async function stripeFetch(path: string, params?: Record<string, string>) {
    const url = new URL(`https://api.stripe.com/v1${path}`)
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${stripeKey}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Stripe ${res.status}`)
    return res.json()
  }

  // Get all active subscriptions
  const subs = await stripeFetch('/subscriptions', { status: 'active', limit: '100', 'expand[]': 'data.customer' })
  // Also get canceled this month
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const canceledSubs = await stripeFetch('/subscriptions', {
    status: 'canceled',
    limit: '100',
    'current_period_start[gte]': String(Math.floor(firstOfMonth.getTime() / 1000)),
  })

  // Calculate MRR from active subs
  let mrr = 0
  const planMap = new Map<string, { count: number; mrr: number }>()
  const recentSubs: SaasMetrics['recentSubscriptions'] = []

  for (const sub of subs.data ?? []) {
    for (const item of sub.items?.data ?? []) {
      const price = item.price
      let monthlyAmount = 0
      if (price.recurring?.interval === 'month') {
        monthlyAmount = ((price.unit_amount ?? 0) / 100) * (item.quantity ?? 1)
      } else if (price.recurring?.interval === 'year') {
        monthlyAmount = ((price.unit_amount ?? 0) / 100 / 12) * (item.quantity ?? 1)
      }
      mrr += monthlyAmount

      const planName = price.nickname ?? price.product ?? 'Unknown'
      const existing = planMap.get(planName) ?? { count: 0, mrr: 0 }
      planMap.set(planName, { count: existing.count + 1, mrr: existing.mrr + monthlyAmount })
    }

    const customer = typeof sub.customer === 'object' ? sub.customer : null
    recentSubs.push({
      customer: customer?.name ?? customer?.id ?? sub.customer,
      email: customer?.email ?? '',
      plan: sub.items?.data?.[0]?.price?.nickname ?? 'N/A',
      amount: (sub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100,
      status: sub.status,
      created: new Date(sub.created * 1000).toISOString(),
    })
  }

  // New customers this month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newThisMonth = (subs.data ?? []).filter((s: any) => s.created * 1000 >= firstOfMonth.getTime()).length
  const churnedCount = canceledSubs.data?.length ?? 0
  const totalActive = subs.data?.length ?? 0
  const prevTotal = totalActive + churnedCount
  const churnRate = prevTotal > 0 ? (churnedCount / prevTotal) * 100 : 0

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    totalCustomers: totalActive,
    payingCustomers: totalActive,
    newCustomersThisMonth: newThisMonth,
    churnedThisMonth: churnedCount,
    churnRate: Math.round(churnRate * 10) / 10,
    avgRevenuePerCustomer: totalActive > 0 ? Math.round((mrr / totalActive) * 100) / 100 : 0,
    planBreakdown: Array.from(planMap.entries()).map(([plan, data]) => ({ plan, ...data })),
    recentSubscriptions: recentSubs
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
      .slice(0, 10),
  }
}
