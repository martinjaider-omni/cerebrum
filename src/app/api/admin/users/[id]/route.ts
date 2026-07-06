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

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'sales']).optional(),
  password: z.string().min(6).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { password, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (password) data.passwordHash = await bcrypt.hash(password, 10)

  const user = await db.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Prevent self-deletion
  if (params.id === session.user?.id)
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })

  // Check for owned proposals and batches
  const [proposalCount, batchCount] = await Promise.all([
    db.proposal.count({ where: { ownerId: params.id } }),
    db.prospectingBatch.count({ where: { ownerId: params.id } }),
  ])
  if (proposalCount > 0 || batchCount > 0)
    return NextResponse.json({
      error: `El usuario tiene ${proposalCount} propuesta(s) y ${batchCount} lote(s) de prospección. Reasignalos antes de eliminar.`,
    }, { status: 409 })

  await db.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
