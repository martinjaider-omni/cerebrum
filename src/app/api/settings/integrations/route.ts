import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'admin') return null
  return session
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await db.integrationSettings.findFirst()
  if (!settings) {
    return NextResponse.json({
      apolloApiKey: '',
      attioAccessToken: '',
      attioListId: '',
      anthropicApiKey: '',
      stripeSecretKey: '',
      icpTitles: [],
      maxPeoplePerCompany: 3,
      revealPhones: false,
      revealEmails: true,
    })
  }

  // Mask secrets for non-admins
  const isAdmin = (session.user as { role?: string }).role === 'admin'
  return NextResponse.json({
    ...settings,
    apolloApiKey: isAdmin ? settings.apolloApiKey : settings.apolloApiKey ? '••••••••' : '',
    attioAccessToken: isAdmin ? settings.attioAccessToken : settings.attioAccessToken ? '••••••••' : '',
    anthropicApiKey: isAdmin ? settings.anthropicApiKey : settings.anthropicApiKey ? '••••••••' : '',
    stripeSecretKey: isAdmin ? settings.stripeSecretKey : settings.stripeSecretKey ? '••••••••' : '',
  })
}

const Schema = z.object({
  apolloApiKey: z.string().optional(),
  attioAccessToken: z.string().optional(),
  attioListId: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  stripeSecretKey: z.string().optional(),
  icpTitles: z.array(z.string()).optional(),
  maxPeoplePerCompany: z.number().int().min(1).max(10).optional(),
  revealPhones: z.boolean().optional(),
  revealEmails: z.boolean().optional(),
})

export async function PUT(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await db.integrationSettings.findFirst()
  const data = parsed.data

  const settings = existing
    ? await db.integrationSettings.update({ where: { id: existing.id }, data })
    : await db.integrationSettings.create({ data: { ...data } as Parameters<typeof db.integrationSettings.create>[0]['data'] })

  return NextResponse.json(settings)
}
