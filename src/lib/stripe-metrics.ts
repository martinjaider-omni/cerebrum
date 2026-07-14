import { db } from './db'

export interface CustomerRecord {
  customer: string
  email: string
  plan: string
  amount: number
  interval: 'month' | 'year' | 'one_time'
  monthlyAmount: number
  status: string
  source: 'stripe' | 'holded'
  created: string
}

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
  recentSubscriptions: CustomerRecord[]
  sources: { stripe: boolean; holded: boolean }
}

// ── Stripe ───────────────────────────────────────────────────────────────────

async function fetchStripeCustomers(stripeKey: string): Promise<{
  customers: CustomerRecord[]
  churnedThisMonth: number
}> {
  async function stripeFetch(path: string, params?: Record<string, string>) {
    const url = new URL(`https://api.stripe.com/v1${path}`)
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${stripeKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Stripe ${res.status}`)
    return res.json()
  }

  const subs = await stripeFetch('/subscriptions', { status: 'active', limit: '100', 'expand[]': 'data.customer' })
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const canceledSubs = await stripeFetch('/subscriptions', {
    status: 'canceled',
    limit: '100',
    'current_period_start[gte]': String(Math.floor(firstOfMonth.getTime() / 1000)),
  })

  const customers: CustomerRecord[] = []
  for (const sub of subs.data ?? []) {
    const item = sub.items?.data?.[0]
    const price = item?.price
    if (!price) continue

    let monthlyAmount = 0
    const interval = price.recurring?.interval === 'year' ? 'year' as const : 'month' as const
    const amount = ((price.unit_amount ?? 0) / 100) * (item.quantity ?? 1)
    monthlyAmount = interval === 'year' ? amount / 12 : amount

    const cust = typeof sub.customer === 'object' ? sub.customer : null
    customers.push({
      customer: cust?.name ?? cust?.id ?? sub.customer,
      email: (cust?.email ?? '').toLowerCase(),
      plan: price.nickname ?? price.product ?? 'Unknown',
      amount,
      interval,
      monthlyAmount,
      status: 'active',
      source: 'stripe',
      created: new Date(sub.created * 1000).toISOString(),
    })
  }

  return { customers, churnedThisMonth: canceledSubs.data?.length ?? 0 }
}

// ── Holded ───────────────────────────────────────────────────────────────────

async function fetchHoldedCustomers(holdedKey: string): Promise<CustomerRecord[]> {
  async function holdedFetch(path: string) {
    const res = await fetch(`https://api.holded.com/api${path}`, {
      headers: { Accept: 'application/json', key: holdedKey },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Holded ${res.status}`)
    return res.json()
  }

  // Get contacts (customers)
  const contacts = await holdedFetch('/invoicing/v1/contacts?type=client')
  // Get recent invoices (last 6 months) to find recurring revenue
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const invoices = await holdedFetch('/invoicing/v1/documents/invoice')

  // Build a map of contact ID → contact info
  const contactMap = new Map<string, { name: string; email: string }>()
  for (const c of contacts ?? []) {
    contactMap.set(c.id ?? c.contactId, {
      name: c.name ?? c.tradeName ?? '',
      email: (c.email ?? '').toLowerCase(),
    })
  }

  // Find customers with recurring invoices (at least 2 invoices in last 6 months)
  const customerInvoices = new Map<string, { total: number; count: number; lastDate: number; desc: string }>()
  for (const inv of invoices ?? []) {
    if (inv.status === 'paid' || inv.status === 'accepted') {
      const date = (inv.date ?? inv.createdAt ?? 0) * 1000
      if (date < sixMonthsAgo.getTime()) continue

      const contactId = inv.contactId ?? inv.contact
      const existing = customerInvoices.get(contactId) ?? { total: 0, count: 0, lastDate: 0, desc: '' }
      existing.total += inv.total ?? inv.subtotal ?? 0
      existing.count++
      existing.lastDate = Math.max(existing.lastDate, date)
      existing.desc = inv.desc ?? inv.notes ?? ''
      customerInvoices.set(contactId, existing)
    }
  }

  const customers: CustomerRecord[] = []
  for (const [contactId, data] of customerInvoices) {
    const contact = contactMap.get(contactId) ?? { name: contactId, email: '' }

    // Estimate monthly amount from invoice history
    const monthsSpan = Math.max(1, Math.ceil((Date.now() - sixMonthsAgo.getTime()) / (30 * 24 * 60 * 60 * 1000)))
    const monthlyAmount = data.total / monthsSpan

    // Only include if looks like recurring (2+ invoices or significant amount)
    if (data.count >= 2 || monthlyAmount >= 30) {
      customers.push({
        customer: contact.name,
        email: contact.email,
        plan: 'Holded',
        amount: Math.round(data.total * 100) / 100,
        interval: 'month',
        monthlyAmount: Math.round(monthlyAmount * 100) / 100,
        status: 'active',
        source: 'holded',
        created: new Date(data.lastDate).toISOString(),
      })
    }
  }

  return customers
}

// ── Merge & Deduplicate ──────────────────────────────────────────────────────

function deduplicateCustomers(stripe: CustomerRecord[], holded: CustomerRecord[]): CustomerRecord[] {
  // Stripe is primary source — if a customer exists in both, keep Stripe version
  const stripeEmails = new Set(stripe.filter((c) => c.email).map((c) => c.email))
  const stripeNames = new Set(stripe.map((c) => c.customer.toLowerCase()))

  const uniqueHolded = holded.filter((h) => {
    // Skip if email matches a Stripe customer
    if (h.email && stripeEmails.has(h.email)) return false
    // Skip if name matches (fuzzy — lowercase comparison)
    if (stripeNames.has(h.customer.toLowerCase())) return false
    return true
  })

  return [...stripe, ...uniqueHolded]
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function fetchSaasMetrics(): Promise<SaasMetrics | null> {
  const settings = await db.integrationSettings.findFirst()
  const s = settings as Record<string, unknown> | null
  const stripeKey = s?.stripeSecretKey as string
  const holdedKey = s?.holdedApiKey as string

  if (!stripeKey && !holdedKey) return null

  let stripeCustomers: CustomerRecord[] = []
  let holdedCustomers: CustomerRecord[] = []
  let churnedThisMonth = 0
  const sources = { stripe: false, holded: false }

  // Fetch from both sources in parallel
  const [stripeResult, holdedResult] = await Promise.allSettled([
    stripeKey ? fetchStripeCustomers(stripeKey) : Promise.resolve(null),
    holdedKey ? fetchHoldedCustomers(holdedKey) : Promise.resolve(null),
  ])

  if (stripeResult.status === 'fulfilled' && stripeResult.value) {
    stripeCustomers = stripeResult.value.customers
    churnedThisMonth = stripeResult.value.churnedThisMonth
    sources.stripe = true
  }

  if (holdedResult.status === 'fulfilled' && holdedResult.value) {
    holdedCustomers = holdedResult.value
    sources.holded = true
  }

  // Merge and deduplicate
  const allCustomers = deduplicateCustomers(stripeCustomers, holdedCustomers)

  // Calculate metrics
  const mrr = allCustomers.reduce((sum, c) => sum + c.monthlyAmount, 0)
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const newThisMonth = allCustomers.filter((c) => new Date(c.created).getTime() >= firstOfMonth.getTime()).length
  const totalActive = allCustomers.length
  const prevTotal = totalActive + churnedThisMonth
  const churnRate = prevTotal > 0 ? (churnedThisMonth / prevTotal) * 100 : 0

  // Plan breakdown
  const planMap = new Map<string, { count: number; mrr: number }>()
  for (const c of allCustomers) {
    const existing = planMap.get(c.plan) ?? { count: 0, mrr: 0 }
    planMap.set(c.plan, { count: existing.count + 1, mrr: existing.mrr + c.monthlyAmount })
  }

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    totalCustomers: totalActive,
    payingCustomers: totalActive,
    newCustomersThisMonth: newThisMonth,
    churnedThisMonth,
    churnRate: Math.round(churnRate * 10) / 10,
    avgRevenuePerCustomer: totalActive > 0 ? Math.round((mrr / totalActive) * 100) / 100 : 0,
    planBreakdown: Array.from(planMap.entries()).map(([plan, data]) => ({ plan, ...data })),
    recentSubscriptions: allCustomers
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
      .slice(0, 20),
    sources,
  }
}
