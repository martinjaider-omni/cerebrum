import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    if ((session?.user as { role?: string })?.role !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const settings = await db.integrationSettings.findFirst()
    const holdedKey = ((settings as Record<string, unknown>)?.holdedApiKey as string ?? '').trim()
    if (!holdedKey) return NextResponse.json({ error: 'No Holded key' })

    const results: Record<string, unknown> = {}
    const headers = { Accept: 'application/json', Authorization: `Bearer ${holdedKey}` }

    async function tryFetch(label: string, url: string) {
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
        const text = await res.text()
        let parsed: unknown
        try { parsed = JSON.parse(text) } catch { parsed = text.slice(0, 300) }
        const isObj = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        const items = isObj ? (parsed as Record<string, unknown>).items : Array.isArray(parsed) ? parsed : null
        const isArr = Array.isArray(items)
        results[label] = {
          status: res.status,
          hasItems: isArr,
          count: isArr ? items.length : null,
          topKeys: isObj ? Object.keys(parsed as Record<string, unknown>).slice(0, 10) : null,
          firstKeys: isArr && items.length > 0 ? Object.keys(items[0] as Record<string, unknown>).slice(0, 20) : null,
          firstItem: isArr && items.length > 0 ? JSON.stringify(items[0]).slice(0, 800) : null,
          body: !isArr ? JSON.stringify(parsed).slice(0, 300) : null,
        }
      } catch (err) {
        results[label] = { error: String(err).slice(0, 100) }
      }
    }

    // v2 endpoints — contacts works, now find invoices/sales
    await tryFetch('contacts', 'https://api.holded.com/api/v2/contacts')
    await tryFetch('contacts?type=client', 'https://api.holded.com/api/v2/contacts?type=client')
    await tryFetch('invoices', 'https://api.holded.com/api/v2/invoices')
    await tryFetch('sales/invoices', 'https://api.holded.com/api/v2/sales/invoices')
    await tryFetch('documents', 'https://api.holded.com/api/v2/documents')
    await tryFetch('documents/invoices', 'https://api.holded.com/api/v2/documents/invoices')
    await tryFetch('documents?type=invoice', 'https://api.holded.com/api/v2/documents?type=invoice')
    await tryFetch('treasury', 'https://api.holded.com/api/v2/treasury')
    await tryFetch('treasury/documents', 'https://api.holded.com/api/v2/treasury/documents')
    await tryFetch('accounting/documents', 'https://api.holded.com/api/v2/accounting/documents')

    // Search for "electro" in contacts
    await tryFetch('contacts?search=electro', 'https://api.holded.com/api/v2/contacts?search=electro')
    await tryFetch('contacts?q=electro', 'https://api.holded.com/api/v2/contacts?q=electro')

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
