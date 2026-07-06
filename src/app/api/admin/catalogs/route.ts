import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_CATALOG_KEYS = ['plans', 'features', 'technologies', 'texts'] as const

const catalogSchema = z.object({
  key: z.enum(VALID_CATALOG_KEYS),
  data: z.unknown().refine((v) => v !== null && typeof v === 'object', {
    message: 'data must be a JSON object or array',
  }),
})

async function requireAdmin() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'admin') return null
  return session
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const catalogs = await db.catalog.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json(catalogs)
}

export async function PUT(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const parsed = catalogSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { key, data } = parsed.data

  const catalog = await db.catalog.upsert({
    where: { key },
    update: { data },
    create: { key, data },
  })
  return NextResponse.json(catalog)
}
