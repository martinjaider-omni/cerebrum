import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

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
  const { key, data } = await req.json()
  if (!key || data === undefined) return NextResponse.json({ error: 'key and data required' }, { status: 400 })

  const catalog = await db.catalog.upsert({
    where: { key },
    update: { data },
    create: { key, data },
  })
  return NextResponse.json(catalog)
}
