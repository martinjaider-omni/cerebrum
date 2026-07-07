import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = 30
  const skip = (page - 1) * limit

  const where = {
    status: 'done' as const,
    ...(q
      ? {
          OR: [
            { inputName: { contains: q, mode: 'insensitive' as const } },
            { domain: { contains: q, mode: 'insensitive' as const } },
            { people: { some: { fullName: { contains: q, mode: 'insensitive' as const } } } },
          ],
        }
      : {}),
  }

  const allCompanies = await db.prospectCompany.findMany({
    where,
    include: {
      people: {
        where: { status: 'done' },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by domain (or inputName if no domain)
  const grouped = new Map<string, {
    id: string
    inputName: string
    domain: string
    phone: string | null
    people: typeof allCompanies[0]['people']
  }>()

  for (const co of allCompanies) {
    const key = (co.domain && co.domain !== '' && co.domain !== 'x.com')
      ? co.domain.toLowerCase()
      : co.inputName.toLowerCase()

    const existing = grouped.get(key)
    if (existing) {
      // Merge people, deduplicate by email or name
      const existingIds = new Set(existing.people.map((p) => p.apolloPersonId ?? p.fullName))
      for (const person of co.people) {
        const personKey = person.apolloPersonId ?? person.fullName
        if (!existingIds.has(personKey)) {
          existing.people.push(person)
          existingIds.add(personKey)
        }
      }
      // Keep the best phone
      if (!existing.phone && co.phone) existing.phone = co.phone
      // Keep the best domain
      if ((!existing.domain || existing.domain === 'x.com') && co.domain && co.domain !== 'x.com') {
        existing.domain = co.domain
      }
    } else {
      grouped.set(key, {
        id: co.id,
        inputName: co.inputName,
        domain: co.domain,
        phone: (co as Record<string, unknown>).phone as string | null ?? null,
        people: [...co.people],
      })
    }
  }

  const merged = Array.from(grouped.values())
  const total = merged.length
  const paginated = merged.slice(skip, skip + limit)

  return NextResponse.json({ data: paginated, total, page, limit })
}
