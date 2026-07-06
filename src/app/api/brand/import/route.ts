import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Vibrant } from 'node-vibrant/node'
import { z } from 'zod'

const bodySchema = z.object({
  url: z.string().min(1).max(500),
})

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OmniWallet-BrandBot/1.0)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const baseUrl = parsed.data.url.startsWith('http') ? parsed.data.url : `https://${parsed.data.url}`

  let html: string
  try {
    html = await fetchHtml(baseUrl)
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch URL: ${String(err)}` }, { status: 422 })
  }

  const $ = cheerio.load(html)
  const logos = candidateLogos($, baseUrl)

  let logoUrl: string | null = null
  let palette: string[] = []
  let brandPrimary: string | null = null
  let brandSecondary: string | null = null

  for (const logoSrc of logos) {
    try {
      const buf = await downloadImage(logoSrc)
      const isSvg = /\.svg(\?|$)/i.test(logoSrc)
      logoUrl = logoSrc

      if (!isSvg) {
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
      break
    } catch {
      continue
    }
  }

  return NextResponse.json({
    logoUrl,
    brandPrimary,
    brandSecondary,
    brandPalette: palette,
    logosFound: logos.length,
  })
}
