import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Vibrant } from 'node-vibrant/node'
import { uploadFile } from '@/lib/storage'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const FETCH_HEADERS: HeadersInit = {
  'User-Agent': BROWSER_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8',
  'Accept-Language': 'es,en;q=0.9',
}

async function fetchWithPlaywright(url: string): Promise<{ html: string; downloadFn: (imgUrl: string) => Promise<Buffer>; cleanup: () => Promise<void> }> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
  const html = await page.content()
  return {
    html,
    downloadFn: async (imgUrl: string) => {
      const res = await context.request.get(imgUrl, { timeout: 10_000 })
      if (!res.ok()) throw new Error(`Image fetch failed: ${res.status()}`)
      return Buffer.from(await res.body())
    },
    cleanup: () => browser.close(),
  }
}

async function fetchWithNode(url: string): Promise<{ html: string; downloadFn: (imgUrl: string) => Promise<Buffer>; cleanup: () => Promise<void> }> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  return {
    html,
    downloadFn: async (imgUrl: string) => {
      const imgRes = await fetch(imgUrl, {
        headers: FETCH_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      })
      if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`)
      return Buffer.from(await imgRes.arrayBuffer())
    },
    cleanup: async () => {},
  }
}

function candidateLogos($: ReturnType<typeof cheerio.load>, baseUrl: string): string[] {
  const candidates: string[] = []

  $('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) candidates.push(href)
  })

  $('img').each((_, el) => {
    const src = $(el).attr('src') ?? ''
    const alt = $(el).attr('alt') ?? ''
    const cls = $(el).attr('class') ?? ''
    const id = $(el).attr('id') ?? ''
    if (/logo/i.test(src + alt + cls + id)) candidates.push(src)
  })

  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr('content')
    if (content) candidates.push(content)
  })

  return candidates
    .filter(Boolean)
    .map((s) => {
      try { return new URL(s, baseUrl).href } catch { return null }
    })
    .filter((s): s is string => !!s)
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const proposal = await db.proposal.findUnique({ where: { id: params.id } })
    if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isAdmin = (session.user as { role?: string }).role === 'admin'
    if (!isAdmin && proposal.ownerId !== session.user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const url = proposal.clientUrl?.trim()
    if (!url) return NextResponse.json({ error: 'No clientUrl set on proposal' }, { status: 400 })

    const baseUrl = url.startsWith('http') ? url : `https://${url}`

    // Try Playwright first (bypasses Cloudflare), fallback to fetch
    let fetcher: Awaited<ReturnType<typeof fetchWithPlaywright>>
    try {
      fetcher = await fetchWithPlaywright(baseUrl)
    } catch {
      try {
        fetcher = await fetchWithNode(baseUrl)
      } catch (err) {
        return NextResponse.json({ error: `Could not fetch URL: ${String(err)}` }, { status: 422 })
      }
    }

    try {
      const $ = cheerio.load(fetcher.html)
      const logos = candidateLogos($, baseUrl)

      let brandLogoUrl: string | null = null
      let palette: string[] = []
      let brandPrimary = proposal.brandPrimary
      let brandSecondary = proposal.brandSecondary

      for (const logoSrc of logos) {
        try {
          const buf = await fetcher.downloadFn(logoSrc)
          const mime = logoSrc.match(/\.svg(\?|$)/i) ? 'image/svg+xml' : 'image/png'

          if (mime !== 'image/svg+xml') {
            const vibrant = await Vibrant.from(buf).getPalette()
            const swatches = [
              vibrant.Vibrant,
              vibrant.DarkVibrant,
              vibrant.LightVibrant,
              vibrant.Muted,
              vibrant.DarkMuted,
              vibrant.LightMuted,
            ]
              .filter(Boolean)
              .map((s) => s!.hex)

            if (swatches.length >= 2) {
              brandPrimary = swatches[0]
              brandSecondary = swatches[1]
              palette = swatches
            }
          }

          const ext = logoSrc.match(/\.(svg|png|jpg|jpeg|webp|ico)(\?|$)/i)?.[1] ?? 'png'
          const key = `logos/${params.id}.${ext}`
          const storedPath = await uploadFile(key, buf, mime)
          brandLogoUrl = storedPath

          break
        } catch {
          continue
        }
      }

      const updated = await db.proposal.update({
        where: { id: params.id },
        data: {
          ...(brandLogoUrl ? { brandLogoUrl } : {}),
          brandPrimary,
          brandSecondary,
          brandPalette: palette,
        },
      })

      return NextResponse.json({
        brandLogoUrl: updated.brandLogoUrl,
        brandPrimary: updated.brandPrimary,
        brandSecondary: updated.brandSecondary,
        brandPalette: updated.brandPalette,
        logosFound: logos.length,
      })
    } finally {
      await fetcher.cleanup()
    }
  } catch (err) {
    console.error('brand-import error:', err)
    return NextResponse.json({ error: `Error interno: ${String(err)}` }, { status: 500 })
  }
}
