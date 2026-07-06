import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadFile } from '@/lib/storage'
import { z } from 'zod'

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

async function authorizeProposal(proposalId: string) {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized', status: 401 } as const
  const proposal = await db.proposal.findUnique({ where: { id: proposalId } })
  if (!proposal) return { error: 'Not found', status: 404 } as const
  const isAdmin = (session.user as { role?: string }).role === 'admin'
  if (!isAdmin && proposal.ownerId !== session.user.id)
    return { error: 'Forbidden', status: 403 } as const
  return { proposal, session } as const
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await authorizeProposal(params.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const assets = await db.asset.findMany({
    where: { proposalId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(assets)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await authorizeProposal(params.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const kind = ALLOWED_TYPES[file.type]
  if (!kind) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.byteLength > MAX_BYTES)
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `assets/${params.id}/${Date.now()}_${sanitized}`
  const storedUrl = await uploadFile(key, buf, file.type)

  const asset = await db.asset.create({
    data: {
      proposalId: params.id,
      kind: kind as 'image' | 'pdf' | 'docx',
      filename: file.name,
      mime: file.type,
      size: buf.byteLength,
      storageKey: key,
      source: 'upload',
    },
  })

  return NextResponse.json({ ...asset, url: storedUrl }, { status: 201 })
}
