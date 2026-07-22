import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { Vibrant } from 'node-vibrant/node'
import { uploadFile } from '@/lib/storage'
import { chromium, type BrowserContext } from 'playwright'

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

async function downloadImage(ctx: BrowserContext, url: string): Promise<Buffer> {
  const res = await ctx.request.get(url, { timeout: 10_000 })
  if (!res.ok()) throw new Error(`Image fetch failed: ${res.status()}`)
  return Buffer.from(await res.body())
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
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

  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Navigate with a real browser — bypasses Cloudflare and similar WAFs
    let html: string
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      html = await page.content()
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
        const buf = await downloadImage(context, logoSrc)
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
    await browser.close()
  }
}
