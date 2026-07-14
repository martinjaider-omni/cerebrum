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

    const isPAT = holdedKey.startsWith('pat_')
    const results: Record<string, unknown> = { keyLength: holdedKey.length, isPAT }

    // PAT uses different URL structure: /v1/invoicing/ instead of /invoicing/v1/
    const tests = [
      // PAT format (new API)
      { label: 'PAT /v1/invoicing/contacts', url: 'https://api.holded.com/v1/invoicing/contacts', auth: `Bearer ${holdedKey}` },
      { label: 'PAT /v1/invoicing/documents/invoice', url: 'https://api.holded.com/v1/invoicing/documents/invoice', auth: `Bearer ${holdedKey}` },
      { label: 'PAT /v1/invoicing/documents/salesinvoice', url: 'https://api.holded.com/v1/invoicing/documents/salesinvoice', auth: `Bearer ${holdedKey}` },
      { label: 'PAT /v1/invoicing/documents/salesreceipt', url: 'https://api.holded.com/v1/invoicing/documents/salesreceipt', auth: `Bearer ${holdedKey}` },
      // Old API key format
      { label: 'OLD /api/invoicing/v1/contacts', url: 'https://api.holded.com/api/invoicing/v1/contacts', auth: null, key: holdedKey },
    ]

    for (const test of tests) {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (test.auth) headers.Authorization = test.auth
        if ('key' in test && test.key) headers.key = test.key

        const res = await fetch(test.url, { headers, signal: AbortSignal.timeout(10_000) })
        const text = await res.text()
        let parsed: unknown
        try { parsed = JSON.parse(text) } catch { parsed = text.slice(0, 300) }

        const isArr = Array.isArray(parsed)
        results[test.label] = {
          status: res.status,
          isArray: isArr,
          count: isArr ? parsed.length : null,
          firstItemKeys: isArr && parsed.length > 0 ? Object.keys(parsed[0] as Record<string, unknown>) : null,
          firstItem: isArr && parsed.length > 0 ? JSON.stringify(parsed[0]).slice(0, 600) : null,
          body: isArr ? null : JSON.stringify(parsed).slice(0, 300),
        }
      } catch (err) {
        results[test.label] = { error: String(err) }
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
