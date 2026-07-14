import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    if ((session?.user as { role?: string })?.role !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const settings = await db.integrationSettings.findFirst()
    const holdedKey = (settings as Record<string, unknown>)?.holdedApiKey as string
    if (!holdedKey) return NextResponse.json({ error: 'No Holded key', keyLength: 0 })

    const results: Record<string, unknown> = { keyLength: holdedKey.length }

    // Try each endpoint one by one
    // Try different auth header formats
    const authVariants = [
      { label: 'key-header', headers: { Accept: 'application/json', key: holdedKey } },
      { label: 'bearer', headers: { Accept: 'application/json', Authorization: `Bearer ${holdedKey}` } },
      { label: 'basic', headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(holdedKey + ':').toString('base64')}` } },
    ]

    const testEndpoint = '/invoicing/v1/contacts'

    for (const variant of authVariants) {
      try {
        const res = await fetch(`https://api.holded.com/api${testEndpoint}`, {
          headers: variant.headers,
          signal: AbortSignal.timeout(10_000),
        })
        const text = await res.text()
        results[`auth:${variant.label}`] = { status: res.status, body: text.slice(0, 300) }
      } catch (err) {
        results[`auth:${variant.label}`] = { error: String(err) }
      }
    }

    // Try endpoints with the key header
    const endpoints = [
      '/invoicing/v1/contacts',
      '/invoicing/v1/documents/invoice',
    ]

    for (const ep of endpoints) {
      try {
        const res = await fetch(`https://api.holded.com/api${ep}`, {
          headers: { Accept: 'application/json', key: holdedKey },
          signal: AbortSignal.timeout(10_000),
        })
        const text = await res.text()
        let parsed: unknown
        try { parsed = JSON.parse(text) } catch { parsed = text.slice(0, 500) }

        results[ep] = {
          status: res.status,
          isArray: Array.isArray(parsed),
          count: Array.isArray(parsed) ? parsed.length : null,
          body: JSON.stringify(parsed).slice(0, 500),
          sample: Array.isArray(parsed) && parsed.length > 0
            ? Object.keys(parsed[0] as Record<string, unknown>)
            : null,
          firstItem: Array.isArray(parsed) && parsed.length > 0
            ? JSON.stringify(parsed[0]).slice(0, 500)
            : null,
        }
      } catch (err) {
        results[ep] = { error: err instanceof Error ? err.message : String(err) }
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
