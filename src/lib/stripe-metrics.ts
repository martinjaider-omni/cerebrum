import { db } from './db'

// ── Types ────────────────────────────────────────────────────────────────────

const PLAN_NAMES = ['Free', 'Starter', 'Plus', 'Advanced', 'Legacy'] as const
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
  churnedCustomers: number
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
  newPayingThisMonth: number
  churnedCustomerDetails: CustomerRecord[]
  sources: { stripe: boolean; holded: boolean }
}

interface InvoiceRecord {
  amount: number
  date: Date
  customerEmail: string
  customerName: string
  source: 'stripe' | 'holded'
  billingInterval: 'monthly' | 'annual'
}

// ── Cache ────────────────────────────────────────────────────────────────────

let cache: { data: SaasMetrics; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export function clearCache() { cache = null }

// ── Plan detection ───────────────────────────────────────────────────────────

function detectPlan(items: Array<{ name: string; amount: number }>): PlanName {
  const allNames = items.map((i) => i.name.toLowerCase()).join(' ')
  // Legacy plans
  if (/legacy/i.test(allNames)) return 'Legacy'
  if (/one plan/i.test(allNames)) return 'Legacy'
  // Current plans
  if (/advanced/i.test(allNames)) return 'Advanced'
  if (/plus/i.test(allNames)) return 'Plus'
  if (/starter/i.test(allNames)) return 'Starter'
  if (/free/i.test(allNames) || /freemium/i.test(allNames)) return 'Free'
  // By amount
  const totalMonthly = items.reduce((s, i) => s + i.amount, 0)
  if (totalMonthly >= 300) return 'Advanced'
  if (totalMonthly >= 150) return 'Plus'
  if (totalMonthly > 0) return 'Starter'
  return 'Free'
}

function parseDecimal(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0
  return 0
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
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [activeSubs, trialingSubs, canceledSubs, allInvoicesRaw] = await Promise.all([
    stripeFetchAll(stripeKey, '/subscriptions', { status: 'active', 'expand[]': 'data.customer' }),
    stripeFetchAll(stripeKey, '/subscriptions', { status: 'trialing', 'expand[]': 'data.customer' }),
    stripeFetchAll(stripeKey, '/subscriptions', {
      status: 'canceled',
      'current_period_start[gte]': String(Math.floor(firstOfMonth.getTime() / 1000)),
      'expand[]': 'data.customer',
    }),
    stripeFetchAll(stripeKey, '/invoices', { status: 'paid' }),
  ])

  // Build map of latest invoice per subscription for REAL MRR (includes overages)
  const latestInvoiceBySubscription = new Map<string, { subtotal: number; date: number }>()
  for (const inv of allInvoicesRaw as Record<string, unknown>[]) {
    const subId = inv.subscription as string
    if (!subId) continue
    const subtotal = ((inv.subtotal_excluding_tax as number) ?? (inv.subtotal as number) ?? 0) / 100
    const created = (inv.created as number) ?? 0
    const existing = latestInvoiceBySubscription.get(subId)
    if (!existing || created > existing.date) {
      latestInvoiceBySubscription.set(subId, { subtotal, date: created })
    }
  }

  const customers: CustomerRecord[] = []
  const subIntervalMap = new Map<string, 'monthly' | 'annual'>()
  let freeCount = 0

  for (const sub of [...activeSubs, ...trialingSubs] as Record<string, unknown>[]) {
    const subId = sub.id as string
    const itemsData = ((sub.items as Record<string, unknown>)?.data as Record<string, unknown>[]) ?? []
    if (itemsData.length === 0) continue

    let planMonthly = 0, totalAmount = 0, isAnnual = false
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

      if (interval === 'year') { isAnnual = true; planMonthly += lineAmount / 12; totalAmount += lineAmount }
      else { planMonthly += lineAmount; totalAmount += lineAmount }

      const name = (price.nickname as string) ?? ''
      itemNames.push(name || String(price.product ?? ''))
      itemsForDetection.push({ name, amount: lineAmount / (interval === 'year' ? 12 : 1) })
    }

    // MRR = latest invoice (captures fixed + variable/metered), with planMonthly as floor
    const lastInvoice = latestInvoiceBySubscription.get(subId)
    let monthlyAmount = planMonthly
    if (lastInvoice && lastInvoice.subtotal > 0) {
      const invoiceMonthly = isAnnual ? lastInvoice.subtotal / 12 : lastInvoice.subtotal
      // Use invoice amount if >= plan price (includes variable charges)
      // but cap at 3x plan price to exclude one-time anomalies
      if (planMonthly > 0 && invoiceMonthly >= planMonthly && invoiceMonthly <= planMonthly * 3) {
        monthlyAmount = invoiceMonthly
      } else if (planMonthly === 0) {
        monthlyAmount = invoiceMonthly // usage-only plans
      }
    }

    subIntervalMap.set(subId, isAnnual ? 'annual' : 'monthly')
    const plan = detectPlan(itemsForDetection)
    const cust = typeof sub.customer === 'object' ? sub.customer as Record<string, unknown> : null
    if (plan === 'Free' || monthlyAmount === 0) freeCount++

    customers.push({
      customer: (cust?.name as string) ?? (cust?.id as string) ?? String(sub.customer),
      email: ((cust?.email as string) ?? '').toLowerCase(),
      plan, billingInterval: isAnnual ? 'annual' : 'monthly',
      totalAmount: lastInvoice ? Math.round(lastInvoice.subtotal * 100) / 100 : Math.round(totalAmount * 100) / 100,
      monthlyAmount: Math.round(monthlyAmount * 100) / 100,
      status: sub.status as string, source: 'stripe',
      created: new Date(((sub.created as number) ?? 0) * 1000).toISOString(),
      items: itemNames,
    })
  }

  // Invoice records for historical charts (subtotal = sin impuestos)
  const invoices: InvoiceRecord[] = []
  for (const inv of allInvoicesRaw as Record<string, unknown>[]) {
    const subtotal = ((inv.subtotal_excluding_tax as number) ?? (inv.subtotal as number) ?? 0) / 100
    if (subtotal <= 0) continue
    const invSubId = inv.subscription as string
    invoices.push({
      amount: subtotal,
      date: new Date(((inv.created as number) ?? 0) * 1000),
      customerEmail: ((inv.customer_email as string) ?? '').toLowerCase(),
      customerName: (inv.customer_name as string) ?? '',
      source: 'stripe',
      billingInterval: subIntervalMap.get(invSubId) ?? 'monthly',
    })
  }

  // Extract churned customer details
  const churnedDetails: CustomerRecord[] = []
  for (const sub of canceledSubs as Record<string, unknown>[]) {
    const cust = typeof sub.customer === 'object' ? sub.customer as Record<string, unknown> : null
    const canceledAt = (sub.canceled_at as number) ?? (sub.ended_at as number) ?? 0
    churnedDetails.push({
      customer: (cust?.name as string) ?? (cust?.id as string) ?? String(sub.customer),
      email: ((cust?.email as string) ?? '').toLowerCase(),
      plan: 'Canceled' as PlanName,
      billingInterval: 'monthly',
      totalAmount: 0, monthlyAmount: 0,
      status: 'canceled', source: 'stripe',
      created: new Date(canceledAt * 1000).toISOString(),
      items: [],
    })
  }

  return { customers, churnedThisMonth: canceledSubs.length, freeCount, invoices, churnedDetails }
}

// ── Holded (API v2 with PAT Bearer) ──────────────────────────────────────────

async function holdedFetchAll(holdedKey: string, path: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = []
  let cursor: string | null = null

  while (true) {
    let url = `https://api.holded.com/api/v2${path}`
    if (cursor) url += (url.includes('?') ? '&' : '?') + `cursor=${cursor}`

    const res = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${holdedKey}` },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Holded ${res.status}`)
    const json = await res.json()
    const items = (json.items ?? json.data ?? []) as Record<string, unknown>[]
    all.push(...items)

    if (json.has_more && json.cursor) {
      cursor = json.cursor as string
    } else {
      break
    }
  }
  return all
}

async function fetchHoldedData(holdedKey: string) {
  const [contacts, invoices] = await Promise.all([
    holdedFetchAll(holdedKey, '/contacts?type=client'),
    holdedFetchAll(holdedKey, '/invoices'),
  ])

  // Contact lookup
  const contactMap = new Map<string, { name: string; email: string }>()
  for (const c of contacts) {
    const id = (c.id ?? c.contactId) as string
    contactMap.set(id, {
      name: ((c.name ?? c.trade_name) as string) ?? '',
      email: ((c.email as string) ?? '').toLowerCase(),
    })
  }

  // Build invoice records (use subtotal = sin impuestos)
  const allInvoices: InvoiceRecord[] = []
  const customerData = new Map<string, {
    total: number; invoiceCount: number; lastDate: number; firstDate: number; items: string[]; isAnnual: boolean
  }>()

  for (const inv of invoices) {
    const status = inv.status as string
    // Include all non-draft invoices (paid, accepted, pending, overdue, etc.)
    if (status === 'draft') continue

    const contactId = (inv.contact_id ?? inv.contactId) as string
    if (!contactId) continue

    // Use subtotal (sin impuestos)
    const subtotal = parseDecimal(inv.subtotal)
    if (subtotal <= 0) continue

    const dateStr = (inv.date ?? inv.created_at) as string
    const dateMs = new Date(dateStr).getTime()
    if (isNaN(dateMs)) continue

    const contact = contactMap.get(contactId) ?? { name: (inv.contact_name as string) ?? contactId, email: '' }

    const desc = ((inv.description as string) ?? '').toLowerCase()
    const descIsAnnual = /anual|annual|12 meses|yearly/i.test(desc)

    allInvoices.push({
      amount: subtotal,
      date: new Date(dateMs),
      customerEmail: contact.email,
      customerName: contact.name,
      source: 'holded',
      billingInterval: descIsAnnual ? 'annual' : 'monthly',
    })

    // Aggregate for customer records
    const existing = customerData.get(contactId) ?? {
      total: 0, invoiceCount: 0, lastDate: 0, firstDate: Infinity, items: [], isAnnual: false,
    }
    existing.total += subtotal
    existing.invoiceCount++
    existing.lastDate = Math.max(existing.lastDate, dateMs)
    existing.firstDate = Math.min(existing.firstDate, dateMs)

    // Extract line item names
    const lines = inv.lines as Array<Record<string, unknown>> | undefined
    if (Array.isArray(lines)) {
      for (const li of lines) {
        const name = (li.name ?? li.description) as string
        if (name) existing.items.push(name)
      }
    } else if (desc) {
      existing.items.push(desc)
    }

    if (descIsAnnual) {
      existing.isAnnual = true
    }
    customerData.set(contactId, existing)
  }

  // Build customer records
  const customers: CustomerRecord[] = []
  const now = Date.now()
  const twelveMonthsAgo = now - 365 * 24 * 60 * 60 * 1000

  for (const [contactId, data] of customerData) {
    const contact = contactMap.get(contactId) ?? { name: contactId, email: '' }

    const recentInvoices = allInvoices
      .filter((inv) => inv.source === 'holded' && inv.date.getTime() >= twelveMonthsAgo &&
        ((inv.customerEmail && inv.customerEmail === contact.email) || inv.customerName === contact.name))
    const recentTotal = recentInvoices.reduce((sum, inv) => sum + inv.amount, 0)

    // Annual detection by invoice frequency:
    // - Description says annual → annual (unless 4+ invoices prove otherwise)
    // - <= 2 invoices in 12 months → annual (regardless of description)
    // - 4+ invoices → monthly (clear recurring pattern)
    const recentCount = recentInvoices.length
    const isAnnual = recentCount <= 2 || (data.isAnnual && recentCount <= 3)

    let monthlyAmount: number
    if (isAnnual) {
      monthlyAmount = recentTotal / 12
    } else {
      const monthsActive = Math.max(1, Math.min(12,
        Math.ceil((now - Math.max(data.firstDate, twelveMonthsAgo)) / (30 * 24 * 60 * 60 * 1000))))
      monthlyAmount = recentTotal / monthsActive
    }

    customers.push({
      customer: contact.name,
      email: contact.email,
      plan: detectPlan(data.items.map((name: string) => ({ name, amount: monthlyAmount }))),
      billingInterval: isAnnual ? 'annual' : 'monthly',
      totalAmount: Math.round(data.total * 100) / 100,
      monthlyAmount: Math.round(monthlyAmount * 100) / 100,
      status: 'active', source: 'holded',
      created: new Date(data.firstDate).toISOString(),
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
    const key = `${monthKey}|${custKey}|${Math.round(inv.amount)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function fetchSaasMetrics(): Promise<SaasMetrics | null> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) return cache.data

  const settings = await db.integrationSettings.findFirst()
  const s = settings as Record<string, unknown> | null
  const stripeKey = s?.stripeSecretKey as string
  const holdedKey = (s?.holdedApiKey as string)?.trim()

  if (!stripeKey && !holdedKey) return null

  let stripeCustomers: CustomerRecord[] = []
  let holdedCustomers: CustomerRecord[] = []
  let allInvoices: InvoiceRecord[] = []
  let churnedThisMonth = 0
  let churnedCustomerDetails: CustomerRecord[] = []
  const sources = { stripe: false, holded: false }

  const [stripeResult, holdedResult] = await Promise.allSettled([
    stripeKey ? fetchStripeData(stripeKey) : Promise.resolve(null),
    holdedKey ? fetchHoldedData(holdedKey) : Promise.resolve(null),
  ])

  if (stripeResult.status === 'fulfilled' && stripeResult.value) {
    stripeCustomers = stripeResult.value.customers
    churnedThisMonth = stripeResult.value.churnedThisMonth
    churnedCustomerDetails = stripeResult.value.churnedDetails
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
  const newPayingThisMonth = payingCustomers.filter((c) => new Date(c.created).getTime() >= firstOfMonth.getTime()).length

  // Plan breakdown
  const planMetrics = new Map<PlanName, PlanMetrics>()
  for (const name of PLAN_NAMES) planMetrics.set(name, { plan: name, monthly: 0, annual: 0, total: 0, mrr: 0 })
  for (const c of allCustomers) {
    const pm = planMetrics.get(c.plan)!
    c.billingInterval === 'annual' ? pm.annual++ : pm.monthly++
    pm.total++
    pm.mrr += c.monthlyAmount
  }

  // Monthly history
  const dedupedInvoices = deduplicateInvoices(allInvoices)
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthlyMap = new Map<string, { revenue: number; mrr: number; customers: Set<string> }>()

  function ensureMonth(key: string) {
    if (!monthlyMap.has(key)) monthlyMap.set(key, { revenue: 0, mrr: 0, customers: new Set<string>() })
    return monthlyMap.get(key)!
  }

  for (const inv of dedupedInvoices) {
    const monthKey = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, '0')}`
    const custKey = inv.customerEmail || normalizeName(inv.customerName)
    const entry = ensureMonth(monthKey)
    entry.revenue += inv.amount
    entry.customers.add(custKey)

    if (inv.billingInterval === 'annual') {
      // Spread MRR across 12 months from invoice date
      const monthlyContribution = inv.amount / 12
      for (let m = 0; m < 12; m++) {
        const d = new Date(inv.date.getFullYear(), inv.date.getMonth() + m, 1)
        const fKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (fKey > nowKey) break
        const fEntry = ensureMonth(fKey)
        fEntry.mrr += monthlyContribution
        fEntry.customers.add(custKey)
      }
    } else {
      entry.mrr += inv.amount
    }
  }

  const sortedMonths = Array.from(monthlyMap.keys()).sort()
  const cumulativeCustomers = new Set<string>()
  let prevMonthCustomers = new Set<string>()
  const history: MonthlySnapshot[] = sortedMonths.map((month) => {
    const data = monthlyMap.get(month)!
    const prevSize = cumulativeCustomers.size
    for (const c of data.customers) cumulativeCustomers.add(c)
    const churned = Array.from(prevMonthCustomers).filter((c) => !data.customers.has(c)).length
    prevMonthCustomers = new Set(Array.from(data.customers))
    return {
      month, revenue: Math.round(data.revenue * 100) / 100,
      mrr: Math.round(data.mrr * 100) / 100,
      customers: data.customers.size,
      newCustomers: cumulativeCustomers.size - prevSize,
      churnedCustomers: churned,
    }
  })

  // Include Holded churn in total churn (Stripe only tracks cancellations)
  const lastHistoryChurn = history.length > 0 ? history[history.length - 1].churnedCustomers : 0
  const totalChurned = Math.max(churnedThisMonth, lastHistoryChurn)
  const prevTotal = payingCustomers.length + totalChurned
  const churnRate = prevTotal > 0 ? (totalChurned / prevTotal) * 100 : 0

  const result: SaasMetrics = {
    mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100,
    totalCustomers: allCustomers.length, freeCustomers: freeCustomers.length,
    payingCustomers: payingCustomers.length, newCustomersThisMonth: newThisMonth,
    newPayingThisMonth,
    churnedThisMonth: totalChurned, churnRate: Math.round(churnRate * 10) / 10,
    avgRevenuePerCustomer: payingCustomers.length > 0 ? Math.round((mrr / payingCustomers.length) * 100) / 100 : 0,
    planBreakdown: Array.from(planMetrics.values()).filter((p) => p.total > 0),
    customers: allCustomers.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()),
    churnedCustomerDetails,
    history, sources,
  }

  cache = { data: result, timestamp: Date.now() }
  return result
}
