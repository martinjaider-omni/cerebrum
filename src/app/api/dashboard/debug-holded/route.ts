import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await db.integrationSettings.findFirst()
  const holdedKey = (settings as Record<string, unknown>)?.holdedApiKey as string
  if (!holdedKey) return NextResponse.json({ error: 'Holded API key not configured' })

  async function holdedFetch(path: string) {
    const res = await fetch(`https://api.holded.com/api${path}`, {
      headers: { Accept: 'application/json', key: holdedKey },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { error: `HTTP ${res.status}`, path }
    return res.json()
  }

  // Fetch first pages of contacts and invoices
  const [contacts, invoices] = await Promise.all([
    holdedFetch('/invoicing/v1/contacts?type=client'),
    holdedFetch('/invoicing/v1/documents/invoice'),
  ])

  // Search for "electro" in contacts
  const contactsList = Array.isArray(contacts) ? contacts : []
  const electroContacts = contactsList.filter((c: Record<string, unknown>) => {
    const name = ((c.name ?? c.tradeName ?? '') as string).toLowerCase()
    return name.includes('electro') || name.includes('alqvimia') || name.includes('stocks')
  })

  // Show sample invoice structure
  const invoicesList = Array.isArray(invoices) ? invoices : []
  const sampleInvoice = invoicesList[0] ?? null

  // Count invoices by status
  const statusCounts: Record<string, number> = {}
  for (const inv of invoicesList) {
    const s = (inv as Record<string, unknown>).status as string ?? 'unknown'
    statusCounts[s] = (statusCounts[s] ?? 0) + 1
  }

  // Search for electro in invoices
  const electroInvoices = invoicesList.filter((inv: Record<string, unknown>) => {
    const contactId = (inv.contactId ?? inv.contact) as string
    return electroContacts.some((c: Record<string, unknown>) => (c.id ?? c.contactId) === contactId)
  })

  return NextResponse.json({
    totalContacts: contactsList.length,
    totalInvoices: invoicesList.length,
    invoiceStatusCounts: statusCounts,
    sampleInvoiceKeys: sampleInvoice ? Object.keys(sampleInvoice) : [],
    sampleInvoice: sampleInvoice ? {
      ...sampleInvoice,
      // Truncate large fields
      items: (sampleInvoice as Record<string, unknown>).items ? 'HAS_ITEMS' : 'NO_ITEMS',
    } : null,
    electroContacts: electroContacts.map((c: Record<string, unknown>) => ({
      id: c.id ?? c.contactId,
      name: c.name ?? c.tradeName,
      email: c.email,
    })),
    electroInvoicesCount: electroInvoices.length,
    electroInvoicesSample: electroInvoices.slice(0, 2).map((inv: Record<string, unknown>) => ({
      id: inv.id,
      contactId: inv.contactId ?? inv.contact,
      status: inv.status,
      total: inv.total,
      subtotal: inv.subtotal,
      date: inv.date,
      createdAt: inv.createdAt,
    })),
  })
}
