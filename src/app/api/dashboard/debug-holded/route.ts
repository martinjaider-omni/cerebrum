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

    // Try many path variations to find the correct ones
    const paths = [
      // Contacts
      '/v1/contacts',
      '/v1/contacts?type=client',
      '/v1/crm/contacts',
      '/v1/accounting/contacts',
      // Invoices / Sales
      '/v1/documents/invoice',
      '/v1/documents/sales',
      '/v1/sales/invoices',
      '/v1/sales/documents',
      '/v1/treasury/documents',
      // With invoicing prefix
      '/v1/invoicing/v1/contacts',
      '/v1/invoicing/v1/documents/invoice',
    ]

    for (const path of paths) {
      try {
        const res = await fetch(`https://api.holded.com${path}`, {
          headers, signal: AbortSignal.timeout(8_000),
        })
        const text = await res.text()
        let parsed: unknown
        try { parsed = JSON.parse(text) } catch { parsed = text.slice(0, 200) }

        const isArr = Array.isArray(parsed)
        const isUseful = isArr || (res.status !== 200) // skip 200 with "check docs"
        const body = isArr ? null : JSON.stringify(parsed).slice(0, 200)
        const isDocRedirect = body?.includes('developers.holded.com')

        // Only show useful results (not the generic "check docs" response)
        if (!isDocRedirect || !isArr) {
          results[path] = {
            status: res.status,
            isArray: isArr,
            count: isArr ? parsed.length : null,
            firstKeys: isArr && parsed.length > 0 ? Object.keys(parsed[0] as Record<string, unknown>).slice(0, 15) : null,
            body: isDocRedirect ? 'DOCS_REDIRECT' : (isArr ? `${parsed.length} items` : body),
          }
        }
      } catch (err) {
        results[path] = { error: String(err).slice(0, 100) }
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
