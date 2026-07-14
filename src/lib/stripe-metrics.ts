import { db } from './db'

// ── Types ────────────────────────────────────────────────────────────────────

const PLAN_NAMES = ['Free', 'Starter', 'Plus', 'Advanced'] as const
type PlanName = typeof PLAN_NAMES[number]

export interface CustomerRecord {
  customer: string
  email: string
  plan: PlanName
  billingInterval: 'monthly' | 'annual'
  totalAmount: number     // total de la suscripción (suma de todos los items)
  monthlyAmount: number   // prorrateado mensual
  status: string
  source: 'stripe' | 'holded'
  created: string
  items: string[]         // nombres de productos/items en la suscripción
}

export interface PlanMetrics {
  plan: PlanName
  monthly: number         // clientes con plan mensual
  annual: number          // clientes con plan anual
  total: number
  mrr: number
}

export interface SaasMetrics {
  mrr: number
  arr: number
  totalCustomers: number
  freeCustomers: number
  payingCustomers: number
  newCustomersThisMonth: number
  churnedThisMonth: number
  churnRate: number
  avgRevenuePerCustomer: number   // solo sobre paying
  planBreakdown: PlanMetrics[]
  customers: CustomerRecord[]
  sources: { stripe: boolean; holded: boolean }
}

// ── Plan detection ───────────────────────────────────────────────────────────

function detectPlan(items: Array<{ name: string; amount: number }>): PlanName {
  const allNames = items.map((i) => i.name.toLowerCase()).join(' ')
  if (/advanced/i.test(allNames)) return 'Advanced'
  if (/plus/i.test(allNames)) return 'Plus'
  if (/starter/i.test(allNames)) return 'Starter'

  // By total price
  const totalMonthly = items.reduce((s, i) => s + i.amount, 0)
  if (totalMonthly >= 300) return 'Advanced'
  if (totalMonthly >= 150) return 'Plus'
  if (totalMonthly > 0) return 'Starter'
  return 'Free'
}

// ── Stripe ───────────────────────────────────────────────────────────────────

async function fetchStripeData(stripeKey: string): Promise<{
  customers: CustomerRecord[]
  churnedThisMonth: number
  freeCount: number
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

  // Fetch ALL subscriptions (active + trialing) with items expanded
  const activeSubs = await stripeFetch('/subscriptions', {
    status: 'active',
    limit: '100',
    'expand[]': 'data.customer',
  })

  // Also fetch trialing (free trial = free customers)
  const trialingSubs = await stripeFetch('/subscriptions', {
    status: 'trialing',
    limit: '100',
    'expand[]': 'data.customer',
  })

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const canceledSubs = await stripeFetch('/subscriptions', {
    status: 'canceled',
    limit: '100',
    'current_period_start[gte]': String(Math.floor(firstOfMonth.getTime() / 1000)),
  })

  const customers: CustomerRecord[] = []
  let freeCount = 0
  const allSubs = [...(activeSubs.data ?? []), ...(trialingSubs.data ?? [])]

  for (const sub of allSubs) {
    const items = sub.items?.data ?? []
    if (items.length === 0) continue

    // Calculate TOTAL subscription amount (sum of ALL items)
    let totalMonthly = 0
    let totalAmount = 0
    let isAnnual = false
    const itemNames: string[] = []
    const itemsForDetection: Array<{ name: string; amount: number }> = []

    for (const item of items) {
      const price = item.price
      if (!price) continue

      const qty = item.quantity ?? 1
      const unitAmount = (price.unit_amount ?? 0) / 100
      const lineAmount = unitAmount * qty
      const interval = price.recurring?.interval

      if (interval === 'year') {
        isAnnual = true
        totalMonthly += lineAmount / 12
        totalAmount += lineAmount
      } else {
        totalMonthly += lineAmount
        totalAmount += lineAmount
      }

      const name = price.nickname ?? price.product?.name ?? price.product ?? ''
      itemNames.push(typeof name === 'string' ? name : String(name))
      itemsForDetection.push({ name: typeof name === 'string' ? name : '', amount: lineAmount / (interval === 'year' ? 12 : 1) })
    }

    const plan = detectPlan(itemsForDetection)
    const cust = typeof sub.customer === 'object' ? sub.customer : null

    if (plan === 'Free' || totalMonthly === 0) {
      freeCount++
    }

    customers.push({
      customer: cust?.name ?? cust?.id ?? sub.customer,
      email: (cust?.email ?? '').toLowerCase(),
      plan,
      billingInterval: isAnnual ? 'annual' : 'monthly',
      totalAmount: Math.round(totalAmount * 100) / 100,
      monthlyAmount: Math.round(totalMonthly * 100) / 100,
      status: sub.status,
      source: 'stripe',
      created: new Date(sub.created * 1000).toISOString(),
      items: itemNames,
    })
  }

  return { customers, churnedThisMonth: canceledSubs.data?.length ?? 0, freeCount }
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

  // Load contacts and invoices in parallel
  const [contacts, invoices] = await Promise.all([
    holdedFetch('/invoicing/v1/contacts?type=client'),
    holdedFetch('/invoicing/v1/documents/invoice'),
  ])

  // Build contact lookup
  const contactMap = new Map<string, { name: string; email: string }>()
  for (const c of contacts ?? []) {
    contactMap.set(c.id ?? c.contactId, {
      name: c.name ?? c.tradeName ?? '',
      email: (c.email ?? '').toLowerCase(),
    })
  }

  // Group invoices by contact — keep ALL paid invoices
  const customerData = new Map<string, {
    totalLast12m: number
    invoiceCount: number
    lastDate: number
    firstDate: number
    items: string[]
    isAnnual: boolean
  }>()

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  for (const inv of invoices ?? []) {
    // Accept paid, accepted, or pending invoices
    if (!['paid', 'accepted'].includes(inv.status)) continue

    const contactId = inv.contactId ?? inv.contact
    if (!contactId) continue

    const date = (inv.date ?? inv.createdAt ?? 0) * 1000
    const amount = inv.total ?? inv.subtotal ?? 0
    const desc = (inv.desc ?? inv.notes ?? '').toLowerCase()

    // Collect all item descriptions from invoice lines
    const lineItems: string[] = []
    if (inv.items && Array.isArray(inv.items)) {
      for (const item of inv.items) {
        if (item.name || item.desc) lineItems.push(item.name ?? item.desc)
      }
    }
    if (lineItems.length === 0 && inv.desc) lineItems.push(inv.desc)

    const existing = customerData.get(contactId) ?? {
      totalLast12m: 0, invoiceCount: 0, lastDate: 0, firstDate: Infinity, items: [], isAnnual: false,
    }

    // Only count amounts from last 12 months for MRR calculation
    if (date >= twelveMonthsAgo.getTime()) {
      existing.totalLast12m += amount
    }
    existing.invoiceCount++
    existing.lastDate = Math.max(existing.lastDate, date)
    existing.firstDate = Math.min(existing.firstDate, date)
    existing.items.push(...lineItems)

    // Detect annual billing from description or amount
    if (/anual|annual|12 meses|yearly/i.test(desc) || amount >= 400) {
      existing.isAnnual = true
    }

    customerData.set(contactId, existing)
  }

  // Build customer records from invoice data
  const customers: CustomerRecord[] = []
  for (const [contactId, data] of customerData) {
    // Skip if no recent invoices (last 12 months)
    if (data.totalLast12m === 0) continue

    const contact = contactMap.get(contactId) ?? { name: contactId, email: '' }

    // Calculate monthly amount
    let monthlyAmount: number
    if (data.isAnnual) {
      // Annual invoice — divide by 12
      monthlyAmount = data.totalLast12m / 12
    } else {
      // Monthly — use average over the months we have data for
      const monthsOfData = Math.max(1, Math.min(12,
        Math.ceil((Date.now() - Math.max(data.firstDate, twelveMonthsAgo.getTime())) / (30 * 24 * 60 * 60 * 1000))
      ))
      monthlyAmount = data.totalLast12m / monthsOfData
    }

    const itemsForDetection = data.items.map((name) => ({ name, amount: monthlyAmount }))
    const plan = detectPlan(itemsForDetection)

    customers.push({
      customer: contact.name,
      email: contact.email,
      plan,
      billingInterval: data.isAnnual ? 'annual' : 'monthly',
      totalAmount: Math.round(data.totalLast12m * 100) / 100,
      monthlyAmount: Math.round(monthlyAmount * 100) / 100,
      status: 'active',
      source: 'holded',
      created: new Date(data.lastDate).toISOString(),
      items: [...new Set(data.items)].slice(0, 5),
    })
  }

  return customers
}

// ── Merge & Deduplicate ──────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,\-_]/g, ' ')
    .replace(/\b(s\.?l\.?u?\.?|s\.?a\.?|s\.?c\.?|ltd|gmbh|inc|corp)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function deduplicateCustomers(stripe: CustomerRecord[], holded: CustomerRecord[]): CustomerRecord[] {
  // Build Stripe lookup sets
  const stripeEmails = new Set(stripe.filter((c) => c.email).map((c) => c.email))
  const stripeNames = new Set(stripe.map((c) => normalizeName(c.customer)))

  const uniqueHolded = holded.filter((h) => {
    // Match by email (exact)
    if (h.email && stripeEmails.has(h.email)) return false
    // Match by normalized name (exact)
    if (stripeNames.has(normalizeName(h.customer))) return false
    // Match by name containment (one contains the other)
    const hNorm = normalizeName(h.customer)
    for (const sName of stripeNames) {
      if (sName.includes(hNorm) || hNorm.includes(sName)) return false
    }
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
  let stripeFreeCount = 0
  const sources = { stripe: false, holded: false }

  const [stripeResult, holdedResult] = await Promise.allSettled([
    stripeKey ? fetchStripeData(stripeKey) : Promise.resolve(null),
    holdedKey ? fetchHoldedCustomers(holdedKey) : Promise.resolve(null),
  ])

  if (stripeResult.status === 'fulfilled' && stripeResult.value) {
    stripeCustomers = stripeResult.value.customers
    churnedThisMonth = stripeResult.value.churnedThisMonth
    stripeFreeCount = stripeResult.value.freeCount
    sources.stripe = true
  }

  if (holdedResult.status === 'fulfilled' && holdedResult.value) {
    holdedCustomers = holdedResult.value
    sources.holded = true
  }

  const allCustomers = deduplicateCustomers(stripeCustomers, holdedCustomers)

  // Separate free vs paying
  const freeCustomers = allCustomers.filter((c) => c.plan === 'Free' || c.monthlyAmount === 0)
  const payingCustomers = allCustomers.filter((c) => c.plan !== 'Free' && c.monthlyAmount > 0)

  const mrr = payingCustomers.reduce((sum, c) => sum + c.monthlyAmount, 0)
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const newThisMonth = allCustomers.filter((c) => new Date(c.created).getTime() >= firstOfMonth.getTime()).length
  const prevTotal = payingCustomers.length + churnedThisMonth
  const churnRate = prevTotal > 0 ? (churnedThisMonth / prevTotal) * 100 : 0

  // Plan breakdown with monthly/annual split
  const planMetrics = new Map<PlanName, PlanMetrics>()
  for (const name of PLAN_NAMES) {
    planMetrics.set(name, { plan: name, monthly: 0, annual: 0, total: 0, mrr: 0 })
  }
  for (const c of allCustomers) {
    const pm = planMetrics.get(c.plan) ?? { plan: c.plan, monthly: 0, annual: 0, total: 0, mrr: 0 }
    if (c.billingInterval === 'annual') pm.annual++
    else pm.monthly++
    pm.total++
    pm.mrr += c.monthlyAmount
    planMetrics.set(c.plan, pm)
  }

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    totalCustomers: allCustomers.length,
    freeCustomers: freeCustomers.length,
    payingCustomers: payingCustomers.length,
    newCustomersThisMonth: newThisMonth,
    churnedThisMonth,
    churnRate: Math.round(churnRate * 10) / 10,
    avgRevenuePerCustomer: payingCustomers.length > 0 ? Math.round((mrr / payingCustomers.length) * 100) / 100 : 0,
    planBreakdown: Array.from(planMetrics.values()).filter((p) => p.total > 0),
    customers: allCustomers.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()),
    sources,
  }
}
