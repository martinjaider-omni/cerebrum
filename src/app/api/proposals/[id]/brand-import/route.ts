import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Vibrant } from 'node-vibrant/node'
import { uploadFile } from '@/lib/storage'

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OmniWallet-BrandBot/1.0)' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function resolveLogoUrl(base: string, src: string): Promise<string> {
  try {
    return new URL(src, base).href
  } catch {
    return src
  }
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function candidateLogos($: ReturnType<typeof cheerio.load>, baseUrl: string): string[] {
  const candidates: string[] = []

  // <link rel="icon">, <link rel="apple-touch-icon">, <link rel="shortcut icon">
  $('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) candidates.push(href)
  })

  // <img> with "logo" in class, id, src, or alt
  $('img').each((_, el) => {
    const src = $(el).attr('src') ?? ''
    const alt = $(el).attr('alt') ?? ''
    const cls = $(el).attr('class') ?? ''
    const id = $(el).attr('id') ?? ''
    if (/logo/i.test(src + alt + cls + id)) candidates.push(src)
  })

  // og:image as last resort
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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const proposal = await db.proposal.findUnique({ where: { id: params.id } })
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && proposal.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = proposal.clientUrl?.trim()
  if (!url) return NextResponse.json({ error: 'No clientUrl set on proposal' }, { status: 400 })

  // Normalize URL
  const baseUrl = url.startsWith('http') ? url : `https://${url}`

  let html: string
  try {
    html = await fetchHtml(baseUrl)
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch URL: ${String(err)}` }, { status: 422 })
  }

  const $ = cheerio.load(html)
  const logos = candidateLogos($, baseUrl)

  let brandLogoUrl: string | null = null
  let palette: string[] = []
  let brandPrimary = proposal.brandPrimary
  let brandSecondary = proposal.brandSecondary

  for (const logoSrc of logos) {
    try {
      const buf = await downloadImage(logoSrc)
      const mime = logoSrc.match(/\.svg(\?|$)/i) ? 'image/svg+xml' : 'image/png'

      // Skip SVGs for color extraction (Vibrant needs raster)
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

      // Store logo
      const ext = logoSrc.match(/\.(svg|png|jpg|jpeg|webp|ico)(\?|$)/i)?.[1] ?? 'png'
      const key = `logos/${params.id}.${ext}`
      const storedPath = await uploadFile(key, buf, mime)
      brandLogoUrl = storedPath

      break
    } catch {
      // Try next candidate
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
}
