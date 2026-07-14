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

  // Try different API paths to find the right one
  const [contacts1, contacts2, contacts3, invoices1, invoices2, invoices3] = await Promise.all([
    holdedFetch('/invoicing/v1/contacts?type=client'),
    holdedFetch('/invoicing/v1/contacts'),
    holdedFetch('/contacts/v1/contacts'),
    holdedFetch('/invoicing/v1/documents/invoice'),
    holdedFetch('/invoicing/v1/documents/sales'),
    holdedFetch('/invoicing/v1/invoices'),
  ])

  const contacts = Array.isArray(contacts1) && contacts1.length > 0 ? contacts1
    : Array.isArray(contacts2) && contacts2.length > 0 ? contacts2
    : Array.isArray(contacts3) && contacts3.length > 0 ? contacts3
    : []
  const invoices = Array.isArray(invoices1) && invoices1.length > 0 ? invoices1
    : Array.isArray(invoices2) && invoices2.length > 0 ? invoices2
    : Array.isArray(invoices3) && invoices3.length > 0 ? invoices3
    : []

  const apiResults = {
    'invoicing/v1/contacts?type=client': Array.isArray(contacts1) ? contacts1.length : contacts1,
    'invoicing/v1/contacts': Array.isArray(contacts2) ? contacts2.length : contacts2,
    'contacts/v1/contacts': Array.isArray(contacts3) ? contacts3.length : contacts3,
    'invoicing/v1/documents/invoice': Array.isArray(invoices1) ? invoices1.length : invoices1,
    'invoicing/v1/documents/sales': Array.isArray(invoices2) ? invoices2.length : invoices2,
    'invoicing/v1/invoices': Array.isArray(invoices3) ? invoices3.length : invoices3,
  }

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
    apiResults,
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
