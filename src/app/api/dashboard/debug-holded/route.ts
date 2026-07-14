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

    async function tryFetch(label: string, url: string, opts: RequestInit) {
      try {
        const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8_000) })
        const text = await res.text()
        let parsed: unknown
        try { parsed = JSON.parse(text) } catch { parsed = text.slice(0, 300) }
        const isArr = Array.isArray(parsed)
        results[label] = {
          status: res.status,
          isArray: isArr,
          count: isArr ? parsed.length : null,
          firstKeys: isArr && parsed.length > 0 ? Object.keys(parsed[0] as Record<string, unknown>).slice(0, 15) : null,
          body: isArr ? `${parsed.length} items` : JSON.stringify(parsed).slice(0, 300),
        }
      } catch (err) {
        results[label] = { error: String(err).slice(0, 100) }
      }
    }

    const bearer = { Accept: 'application/json', Authorization: `Bearer ${holdedKey}` }

    // Try old API paths with Bearer (not key header)
    await tryFetch('GET /api/invoicing/v1/contacts (Bearer)', 'https://api.holded.com/api/invoicing/v1/contacts', { headers: bearer })

    // Try POST instead of GET
    await tryFetch('POST /api/invoicing/v1/contacts (Bearer)', 'https://api.holded.com/api/invoicing/v1/contacts', { method: 'POST', headers: bearer })

    // Try with apikey query param
    await tryFetch('GET /api/invoicing/v1/contacts?apikey=', `https://api.holded.com/api/invoicing/v1/contacts?apikey=${holdedKey}`, { headers: { Accept: 'application/json' } })

    // Try different base domains
    await tryFetch('GET app.holded.com/api/invoicing/v1/contacts', `https://app.holded.com/api/invoicing/v1/contacts`, { headers: bearer })

    // Try v2
    await tryFetch('GET /api/v2/contacts', 'https://api.holded.com/api/v2/contacts', { headers: bearer })
    await tryFetch('GET /api/v2/invoicing/contacts', 'https://api.holded.com/api/v2/invoicing/contacts', { headers: bearer })
    await tryFetch('GET /api/v2/invoicing/documents', 'https://api.holded.com/api/v2/invoicing/documents', { headers: bearer })

    // Try the exact Holded docs format
    await tryFetch('GET /api/invoicing/v1/contacts (key header)', 'https://api.holded.com/api/invoicing/v1/contacts', {
      headers: { Accept: 'application/json', key: holdedKey }
    })

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
