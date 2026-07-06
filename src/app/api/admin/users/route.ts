import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'admin') return null
  return session
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const users = await db.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  return NextResponse.json(users)
}

const CreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'sales']).default('sales'),
})

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, email, password, role } = parsed.data
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Email ya en uso' }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: { name, email, passwordHash, role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  return NextResponse.json(user, { status: 201 })
}
