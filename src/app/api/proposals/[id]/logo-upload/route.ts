import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Vibrant } from 'node-vibrant/node'
import { uploadFile, deleteFile } from '@/lib/storage'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const proposal = await db.proposal.findUnique({ where: { id: params.id } })
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && proposal.ownerId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.byteLength > MAX_BYTES)
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })

  // Sanitize SVG: strip script tags, event handlers, and external references
  if (file.type === 'image/svg+xml') {
    const svg = buf.toString('utf-8')
    if (/<script[\s>]/i.test(svg) || /on\w+\s*=/i.test(svg) || /javascript:/i.test(svg) || /data:/i.test(svg)) {
      return NextResponse.json({ error: 'SVG contains potentially unsafe content' }, { status: 400 })
    }
  }

  // Delete previous logo if exists
  if (proposal.brandLogoUrl) {
    const oldKey = proposal.brandLogoUrl.replace(/^\/api\/uploads\//, '')
    await deleteFile(oldKey).catch(() => {})
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  const key = `logos/${params.id}.${ext}`
  const storedPath = await uploadFile(key, buf, file.type)

  let brandPrimary = proposal.brandPrimary
  let brandSecondary = proposal.brandSecondary
  let palette: string[] = []

  if (file.type !== 'image/svg+xml') {
    try {
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
    } catch {
      // Color extraction failed — keep existing colors
    }
  }

  const updated = await db.proposal.update({
    where: { id: params.id },
    data: { brandLogoUrl: storedPath, brandPrimary, brandSecondary, brandPalette: palette },
  })

  return NextResponse.json({
    brandLogoUrl: updated.brandLogoUrl,
    brandPrimary: updated.brandPrimary,
    brandSecondary: updated.brandSecondary,
    brandPalette: updated.brandPalette,
  })
}
