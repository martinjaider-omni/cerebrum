import { db } from './db'

// ── Types ────────────────────────────────────────────────────────────────────

const PLAN_NAMES = ['Free', 'Starter', 'Plus', 'Advanced'] as const
type PlanName = typeof PLAN_NAMES[number]

export interface CustomerRecord {
  customer: string
  email: string
  plan: PlanName
  billingInterval: 'monthly' | 'annual'
  totalAmount: number
  monthlyAmount: number
  status: string
  source: 'stripe' | 'holded'
  created: string
  items: string[]
}

export interface PlanMetrics {
  plan: PlanName
  monthly: number
  annual: number
  total: number
  mrr: number
}

export interface MonthlySnapshot {
  month: string
  revenue: number
  mrr: number
  customers: number
  newCustomers: number
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
  avgRevenuePerCustomer: number
  planBreakdown: PlanMetrics[]
  customers: CustomerRecord[]
  history: MonthlySnapshot[]
  sources: { stripe: boolean; holded: boolean }
}

interface InvoiceRecord {
  amount: number
  date: Date
  customerEmail: string
  customerName: string
  source: 'stripe' | 'holded'
}

// ── Cache (avoid re-fetching on every page load) ─────────────────────────────

let cache: { data: SaasMetrics; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ── Plan detection ───────────────────────────────────────────────────────────

function detectPlan(items: Array<{ name: string; amount: number }>): PlanName {
  const allNames = items.map((i) => i.name.toLowerCase()).join(' ')
  if (/advanced/i.test(allNames)) return 'Advanced'
  if (/plus/i.test(allNames)) return 'Plus'
  if (/starter/i.test(allNames)) return 'Starter'
  const totalMonthly = items.reduce((s, i) => s + i.amount, 0)
  if (totalMonthly >= 300) return 'Advanced'
  if (totalMonthly >= 150) return 'Plus'
  if (totalMonthly > 0) return 'Starter'
  return 'Free'
}

// ── Stripe ───────────────────────────────────────────────────────────────────

async function stripeFetchAll(stripeKey: string, path: string, params: Record<string, string> = {}): Promise<unknown[]> {
  const all: unknown[] = []
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const url = new URL(`https://api.stripe.com/v1${path}`)
    Object.entries({ ...params, limit: '100' }).forEach(([k, v]) => url.searchParams.set(k, v))
    if (startingAfter) url.searchParams.set('starting_after', startingAfter)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${stripeKey}` },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Stripe ${res.status}`)
    const json = await res.json()
    const items = json.data ?? []
    all.push(...items)
    hasMore = json.has_more ?? false
    if (items.length > 0) startingAfter = (items[items.length - 1] as { id: string }).id
  }
  return all
}

async function fetchStripeData(stripeKey: string) {
  // Fetch in parallel: active subs, trialing subs, canceled this month, ALL invoices
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [activeSubs, trialingSubs, canceledSubs, allInvoicesRaw] = await Promise.all([
    stripeFetchAll(stripeKey, '/subscriptions', { status: 'active', 'expand[]': 'data.customer' }),
    stripeFetchAll(stripeKey, '/subscriptions', { status: 'trialing', 'expand[]': 'data.customer' }),
    stripeFetchAll(stripeKey, '/subscriptions', {
      status: 'canceled',
      'current_period_start[gte]': String(Math.floor(firstOfMonth.getTime() / 1000)),
    }),
    stripeFetchAll(stripeKey, '/invoices', { status: 'paid' }),
  ])

  // Build current customers from subscriptions
  const customers: CustomerRecord[] = []
  let freeCount = 0

  for (const sub of [...activeSubs, ...trialingSubs] as Record<string, unknown>[]) {
    const itemsData = ((sub.items as Record<string, unknown>)?.data as Record<string, unknown>[]) ?? []
    if (itemsData.length === 0) continue

    let totalMonthly = 0
    let totalAmount = 0
    let isAnnual = false
    const itemNames: string[] = []
    const itemsForDetection: Array<{ name: string; amount: number }> = []

    for (const item of itemsData) {
      const price = item.price as Record<string, unknown>
      if (!price) continue
      const recurring = price.recurring as Record<string, unknown> | undefined
      const qty = (item.quantity as number) ?? 1
      const unitAmount = ((price.unit_amount as number) ?? 0) / 100
      const lineAmount = unitAmount * qty
      const interval = recurring?.interval as string

      if (interval === 'year') {
        isAnnual = true
        totalMonthly += lineAmount / 12
        totalAmount += lineAmount
      } else {
        totalMonthly += lineAmount
        totalAmount += lineAmount
      }

      const name = (price.nickname as string) ?? ''
      itemNames.push(name || String(price.product ?? ''))
      itemsForDetection.push({ name, amount: lineAmount / (interval === 'year' ? 12 : 1) })
    }

    const plan = detectPlan(itemsForDetection)
    const cust = typeof sub.customer === 'object' ? sub.customer as Record<string, unknown> : null

    if (plan === 'Free' || totalMonthly === 0) freeCount++

    customers.push({
      customer: (cust?.name as string) ?? (cust?.id as string) ?? String(sub.customer),
      email: ((cust?.email as string) ?? '').toLowerCase(),
      plan,
      billingInterval: isAnnual ? 'annual' : 'monthly',
      totalAmount: Math.round(totalAmount * 100) / 100,
      monthlyAmount: Math.round(totalMonthly * 100) / 100,
      status: sub.status as string,
      source: 'stripe',
      created: new Date(((sub.created as number) ?? 0) * 1000).toISOString(),
      items: itemNames,
    })
  }

  // Build invoice records for historical charts
  const invoices: InvoiceRecord[] = []
  for (const inv of allInvoicesRaw as Record<string, unknown>[]) {
    const total = ((inv.amount_paid as number) ?? (inv.total as number) ?? 0) / 100
    if (total <= 0) continue
    invoices.push({
      amount: total,
      date: new Date(((inv.created as number) ?? 0) * 1000),
      customerEmail: ((inv.customer_email as string) ?? '').toLowerCase(),
      customerName: (inv.customer_name as string) ?? '',
      source: 'stripe',
    })
  }

  return { customers, churnedThisMonth: canceledSubs.length, freeCount, invoices }
}

// ── Holded ───────────────────────────────────────────────────────────────────

async function holdedFetchAll(holdedKey: string, path: string): Promise<unknown[]> {
  // Holded paginates with page param
  const all: unknown[] = []
  let page = 1
  while (true) {
    const res = await fetch(`https://api.holded.com/api${path}${path.includes('?') ? '&' : '?'}page=${page}`, {
      headers: { Accept: 'application/json', key: holdedKey },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Holded ${res.status}`)
    const data = await res.json()
    const items = Array.isArray(data) ? data : []
    if (items.length === 0) break
    all.push(...items)
    if (items.length < 50) break // Holded default page size is 50
    page++
  }
  return all
}

async function fetchHoldedData(holdedKey: string) {
  const [contacts, invoices] = await Promise.all([
    holdedFetchAll(holdedKey, '/invoicing/v1/contacts?type=client'),
    holdedFetchAll(holdedKey, '/invoicing/v1/documents/invoice'),
  ])

  // Contact lookup
  const contactMap = new Map<string, { name: string; email: string }>()
  for (const c of contacts as Record<string, unknown>[]) {
    const id = (c.id ?? c.contactId) as string
    contactMap.set(id, {
      name: ((c.name ?? c.tradeName) as string) ?? '',
      email: ((c.email as string) ?? '').toLowerCase(),
    })
  }

  // All invoice records for charts
  const allInvoices: InvoiceRecord[] = []

  // Group by contact for customer records
  const customerData = new Map<string, {
    total: number
    invoiceCount: number
    lastDate: number
    firstDate: number
    items: string[]
    isAnnual: boolean
  }>()

  for (const raw of invoices as Record<string, unknown>[]) {
    const status = raw.status as string
    if (status !== 'paid' && status !== 'accepted') continue

    const contactId = (raw.contactId ?? raw.contact) as string
    if (!contactId) continue

    // Parse date — Holded uses Unix timestamp (seconds)
    let dateMs: number
    const rawDate = raw.date ?? raw.createdAt ?? raw.created
    if (typeof rawDate === 'number') {
      dateMs = rawDate > 1e12 ? rawDate : rawDate * 1000 // handle both ms and seconds
    } else {
      dateMs = new Date(String(rawDate)).getTime()
    }
    if (isNaN(dateMs) || dateMs < 0) continue

    const amount = (raw.total ?? raw.subtotal ?? 0) as number
    if (amount <= 0) continue

    const contact = contactMap.get(contactId) ?? { name: contactId, email: '' }

    // Invoice record for charts
    allInvoices.push({
      amount,
      date: new Date(dateMs),
      customerEmail: contact.email,
      customerName: contact.name,
      source: 'holded',
    })

    // Customer aggregation
    const desc = ((raw.desc ?? raw.notes ?? '') as string).toLowerCase()
    const existing = customerData.get(contactId) ?? {
      total: 0, invoiceCount: 0, lastDate: 0, firstDate: Infinity, items: [], isAnnual: false,
    }
    existing.total += amount
    existing.invoiceCount++
    existing.lastDate = Math.max(existing.lastDate, dateMs)
    existing.firstDate = Math.min(existing.firstDate, dateMs)

    // Extract line items
    const lineItems = raw.items as Array<Record<string, unknown>> | undefined
    if (Array.isArray(lineItems)) {
      for (const li of lineItems) {
        const name = (li.name ?? li.desc) as string
        if (name) existing.items.push(name)
      }
    } else if (desc) {
      existing.items.push(desc)
    }

    if (/anual|annual|12 meses|yearly/i.test(desc) || amount >= 400) {
      existing.isAnnual = true
    }

    customerData.set(contactId, existing)
  }

  // Build customer records — include ALL clients with any paid invoice
  const customers: CustomerRecord[] = []
  const now = Date.now()
  const twelveMonthsAgo = now - 365 * 24 * 60 * 60 * 1000

  for (const [contactId, data] of customerData) {
    const contact = contactMap.get(contactId) ?? { name: contactId, email: '' }

    // Calculate MRR based on invoices in last 12 months
    // For clients with older invoices only, still show them but with 0 MRR
    const recentTotal = allInvoices
      .filter((inv) => {
        const cEmail = contact.email
        const cName = contact.name.toLowerCase()
        return (
          inv.source === 'holded' &&
          inv.date.getTime() >= twelveMonthsAgo &&
          ((inv.customerEmail && inv.customerEmail === cEmail) || inv.customerName.toLowerCase() === cName)
        )
      })
      .reduce((sum, inv) => sum + inv.amount, 0)

    let monthlyAmount: number
    if (data.isAnnual) {
      monthlyAmount = recentTotal / 12
    } else {
      const monthsActive = Math.max(1, Math.min(12,
        Math.ceil((now - Math.max(data.firstDate, twelveMonthsAgo)) / (30 * 24 * 60 * 60 * 1000))
      ))
      monthlyAmount = recentTotal / monthsActive
    }

    const itemsForDetection = data.items.map((name) => ({ name, amount: monthlyAmount }))

    customers.push({
      customer: contact.name,
      email: contact.email,
      plan: detectPlan(itemsForDetection),
      billingInterval: data.isAnnual ? 'annual' : 'monthly',
      totalAmount: Math.round(data.total * 100) / 100,
      monthlyAmount: Math.round(monthlyAmount * 100) / 100,
      status: 'active',
      source: 'holded',
      created: new Date(data.lastDate).toISOString(),
      items: [...new Set(data.items)].slice(0, 5),
    })
  }

  return { customers, invoices: allInvoices }
}

// ── Dedup ────────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[.,\-_]/g, ' ').replace(/\b(s\.?l\.?u?\.?|s\.?a\.?|s\.?c\.?|ltd|gmbh|inc|corp)\b/g, '').replace(/\s+/g, ' ').trim()
}

function deduplicateCustomers(stripe: CustomerRecord[], holded: CustomerRecord[]): CustomerRecord[] {
  const stripeEmails = new Set(stripe.filter((c) => c.email).map((c) => c.email))
  const stripeNames = new Set(stripe.map((c) => normalizeName(c.customer)))

  return [...stripe, ...holded.filter((h) => {
    if (h.email && stripeEmails.has(h.email)) return false
    const hNorm = normalizeName(h.customer)
    if (stripeNames.has(hNorm)) return false
    for (const sName of stripeNames) {
      if (sName.length > 3 && hNorm.length > 3 && (sName.includes(hNorm) || hNorm.includes(sName))) return false
    }
    return true
  })]
}

function deduplicateInvoices(invoices: InvoiceRecord[]): InvoiceRecord[] {
  const seen = new Set<string>()
  return invoices.filter((inv) => {
    const monthKey = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, '0')}`
    const custKey = (inv.customerEmail || normalizeName(inv.customerName))
    const amountKey = Math.round(inv.amount)
    const key = `${monthKey}|${custKey}|${amountKey}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function fetchSaasMetrics(): Promise<SaasMetrics | null> {
  // Return cached data if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) return cache.data

  const settings = await db.integrationSettings.findFirst()
  const s = settings as Record<string, unknown> | null
  const stripeKey = s?.stripeSecretKey as string
  const holdedKey = s?.holdedApiKey as string

  if (!stripeKey && !holdedKey) return null

  let stripeCustomers: CustomerRecord[] = []
  let holdedCustomers: CustomerRecord[] = []
  let allInvoices: InvoiceRecord[] = []
  let churnedThisMonth = 0
  const sources = { stripe: false, holded: false }

  const [stripeResult, holdedResult] = await Promise.allSettled([
    stripeKey ? fetchStripeData(stripeKey) : Promise.resolve(null),
    holdedKey ? fetchHoldedData(holdedKey) : Promise.resolve(null),
  ])

  if (stripeResult.status === 'fulfilled' && stripeResult.value) {
    stripeCustomers = stripeResult.value.customers
    churnedThisMonth = stripeResult.value.churnedThisMonth
    allInvoices.push(...stripeResult.value.invoices)
    sources.stripe = true
  }

  if (holdedResult.status === 'fulfilled' && holdedResult.value) {
    holdedCustomers = holdedResult.value.customers
    allInvoices.push(...holdedResult.value.invoices)
    sources.holded = true
  }

  const allCustomers = deduplicateCustomers(stripeCustomers, holdedCustomers)
  const freeCustomers = allCustomers.filter((c) => c.plan === 'Free' || c.monthlyAmount === 0)
  const payingCustomers = allCustomers.filter((c) => c.plan !== 'Free' && c.monthlyAmount > 0)

  const mrr = payingCustomers.reduce((sum, c) => sum + c.monthlyAmount, 0)
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const newThisMonth = allCustomers.filter((c) => new Date(c.created).getTime() >= firstOfMonth.getTime()).length
  const prevTotal = payingCustomers.length + churnedThisMonth
  const churnRate = prevTotal > 0 ? (churnedThisMonth / prevTotal) * 100 : 0

  // Plan breakdown
  const planMetrics = new Map<PlanName, PlanMetrics>()
  for (const name of PLAN_NAMES) planMetrics.set(name, { plan: name, monthly: 0, annual: 0, total: 0, mrr: 0 })
  for (const c of allCustomers) {
    const pm = planMetrics.get(c.plan)!
    c.billingInterval === 'annual' ? pm.annual++ : pm.monthly++
    pm.total++
    pm.mrr += c.monthlyAmount
  }

  // Monthly history from deduplicated invoices
  const dedupedInvoices = deduplicateInvoices(allInvoices)
  const monthlyMap = new Map<string, { revenue: number; customers: Set<string> }>()
  for (const inv of dedupedInvoices) {
    const monthKey = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, '0')}`
    const entry = monthlyMap.get(monthKey) ?? { revenue: 0, customers: new Set() }
    entry.revenue += inv.amount
    const custKey = inv.customerEmail || normalizeName(inv.customerName)
    if (custKey) entry.customers.add(custKey)
    monthlyMap.set(monthKey, entry)
  }

  const sortedMonths = Array.from(monthlyMap.keys()).sort()
  const cumulativeCustomers = new Set<string>()
  const history: MonthlySnapshot[] = sortedMonths.map((month) => {
    const data = monthlyMap.get(month)!
    const prevSize = cumulativeCustomers.size
    for (const c of data.customers) cumulativeCustomers.add(c)
    return {
      month,
      revenue: Math.round(data.revenue * 100) / 100,
      mrr: Math.round(data.revenue * 100) / 100,
      customers: data.customers.size,
      newCustomers: cumulativeCustomers.size - prevSize,
    }
  })

  const result: SaasMetrics = {
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
    history,
    sources,
  }

  // Cache result
  cache = { data: result, timestamp: Date.now() }
  return result
}
