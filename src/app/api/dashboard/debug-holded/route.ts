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

    const trimmedKey = holdedKey.trim()
    const results: Record<string, unknown> = {
      keyLength: holdedKey.length,
      trimmedLength: trimmedKey.length,
      keyStart: trimmedKey.slice(0, 4),
      keyEnd: trimmedKey.slice(-4),
      hasSpaces: holdedKey !== trimmedKey,
    }

    // Try each endpoint one by one
    const trimKey = trimmedKey

    // Try all combinations of base URL + auth + endpoint
    const tests = [
      // PAT format with Bearer on different base paths
      { label: 'bearer /invoicing/v1/contacts', url: 'https://api.holded.com/api/invoicing/v1/contacts', headers: { Accept: 'application/json', Authorization: `Bearer ${trimKey}` } },
      { label: 'bearer /v1/invoicing/contacts', url: 'https://api.holded.com/v1/invoicing/contacts', headers: { Accept: 'application/json', Authorization: `Bearer ${trimKey}` } },
      { label: 'bearer /api/contacts', url: 'https://api.holded.com/api/contacts', headers: { Accept: 'application/json', Authorization: `Bearer ${trimKey}` } },
      // Old key format
      { label: 'key-header /invoicing/v1/contacts', url: 'https://api.holded.com/api/invoicing/v1/contacts', headers: { Accept: 'application/json', key: trimKey } },
      // Try with Accept header variations
      { label: 'bearer+json /invoicing/v1/contacts', url: 'https://api.holded.com/api/invoicing/v1/contacts', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${trimKey}` } },
    ]

    for (const test of tests) {
      try {
        const res = await fetch(test.url, {
          headers: test.headers,
          signal: AbortSignal.timeout(10_000),
        })
        const text = await res.text()
        results[test.label] = { status: res.status, body: text.slice(0, 300) }
      } catch (err) {
        results[test.label] = { error: String(err) }
      }
    }

    // Also try listing documents with Bearer
    const endpoints = [
      '/invoicing/v1/documents/invoice',
    ]

    for (const ep of endpoints) {
      try {
        const res = await fetch(`https://api.holded.com/api${ep}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${trimKey}` },
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
