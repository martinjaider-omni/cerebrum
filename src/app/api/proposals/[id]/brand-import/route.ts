import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Vibrant } from 'node-vibrant/node'
import { uploadFile } from '@/lib/storage'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function getDomain(url: string): string {
  try { return new URL(url).hostname } catch { return url }
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

async function fetchHtmlSafe(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
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
    const domain = getDomain(baseUrl)

    // Build logo candidates from multiple sources
    const logoSources: string[] = []

    // 1. Google Favicon API (high-res, always works)
    logoSources.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`)

    // 2. Clearbit Logo API (real company logos, not just favicons)
    logoSources.push(`https://logo.clearbit.com/${domain}`)

    // 3. Direct favicon paths (no scraping needed)
    logoSources.push(`${baseUrl}/favicon.ico`)
    logoSources.push(`${baseUrl}/apple-touch-icon.png`)
    logoSources.push(`${baseUrl}/favicon.png`)

    // 4. Try scraping HTML for more candidates (best effort, may fail with 403)
    const html = await fetchHtmlSafe(baseUrl)
    if (html) {
      const $ = cheerio.load(html)
      logoSources.push(...candidateLogos($, baseUrl))
    }

    let brandLogoUrl: string | null = null
    let palette: string[] = []
    let brandPrimary = proposal.brandPrimary
    let brandSecondary = proposal.brandSecondary

    // Try each source until one works
    for (const logoSrc of logoSources) {
      try {
        const buf = await downloadImage(logoSrc)
        if (buf.length < 100) continue // skip tiny/empty responses

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
      logosFound: logoSources.length,
    })
  } catch (err) {
    console.error('brand-import error:', err)
    return NextResponse.json({ error: `Error interno: ${String(err)}` }, { status: 500 })
  }
}
