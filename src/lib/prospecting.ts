import { db } from './db'

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  delayMs = 1000
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options)
    if (res.ok || res.status < 500) return res
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
  }
  return fetch(url, options)
}

// ── Apollo API helpers ─────────────────────────────────────────────────────────

interface ApolloOrg {
  id: string
  name: string
  website_url: string
  primary_domain: string
  phone: string | null
}

interface ApolloPerson {
  id: string
  name: string
  title: string
  seniority: string
  email: string | null
  organization_id: string
  phone_numbers?: Array<{ raw_number: string; type: string }>
}

async function apolloSearchOrg(
  apiKey: string,
  name: string
): Promise<ApolloOrg | null> {
  const res = await fetchWithRetry('https://api.apollo.io/v1/organizations/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ q_organization_name: name, page: 1, per_page: 1 }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Apollo org search ${res.status}`)
  const json = await res.json()
  return json.organizations?.[0] ?? null
}

async function apolloSearchPeople(
  apiKey: string,
  orgId: string,
  titles: string[],
  maxPeople: number,
  revealEmails: boolean
): Promise<ApolloPerson[]> {
  const body: Record<string, unknown> = {
    organization_ids: [orgId],
    page: 1,
    per_page: maxPeople,
  }
  if (titles.length > 0) body.person_titles = titles

  const res = await fetchWithRetry(
    revealEmails
      ? 'https://api.apollo.io/v1/mixed_people/search'
      : 'https://api.apollo.io/v1/people/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) throw new Error(`Apollo people search ${res.status}`)
  const json = await res.json()
  return json.people ?? []
}

async function apolloRevealPhone(
  apiKey: string,
  personId: string
): Promise<string | null> {
  const res = await fetchWithRetry('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ id: personId, reveal_personal_emails: false, reveal_phone_number: true }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.person?.phone_numbers?.[0]?.raw_number ?? null
}

// ── Attio API helpers ──────────────────────────────────────────────────────────

async function attioUpsertCompany(
  token: string,
  name: string,
  domain: string
): Promise<string | null> {
  const res = await fetchWithRetry('https://api.attio.com/v2/objects/companies/records', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      matching_attribute: 'domains',
      values: { name: [{ value: name }], domains: domain ? [{ domain }] : [] },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.data?.id?.record_id ?? null
}

async function attioAddToList(
  token: string,
  listId: string,
  companyRecordId: string
): Promise<string | null> {
  const res = await fetchWithRetry(`https://api.attio.com/v2/lists/${listId}/entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: { record: { target: 'companies', id: { record_id: companyRecordId } } },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.data?.id?.entry_id ?? null
}

async function attioUpsertPerson(
  token: string,
  name: string,
  emails: string[]
): Promise<string | null> {
  const res = await fetchWithRetry('https://api.attio.com/v2/objects/people/records', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      matching_attribute: 'email_addresses',
      values: {
        name: [{ first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' ') }],
        email_addresses: emails.map((email) => ({ email_address: email })),
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.data?.id?.record_id ?? null
}

// ── Batch processor ────────────────────────────────────────────────────────────

export async function processBatch(batchId: string): Promise<void> {
  const settings = await db.integrationSettings.findFirst()
  if (!settings?.apolloApiKey) throw new Error('Apollo API key not configured')

  await db.prospectingBatch.update({
    where: { id: batchId },
    data: { status: 'processing' },
  })

  const companies = await db.prospectCompany.findMany({
    where: { batchId, status: 'pending' },
  })

  let processed = 0
  let errors = 0
  let totalPeople = 0
  let totalPhones = 0

  for (const company of companies) {
    try {
      await db.prospectCompany.update({
        where: { id: company.id },
        data: { status: 'enriching' },
      })

      // 1. Find org in Apollo
      const org = await apolloSearchOrg(settings.apolloApiKey, company.inputName)
      if (!org) {
        await db.prospectCompany.update({
          where: { id: company.id },
          data: { status: 'error', error: 'No encontrada en Apollo' },
        })
        errors++
        continue
      }

      const domain = org.primary_domain ?? new URL(org.website_url || 'https://x.com').hostname

      // 2. Find people in Apollo
      const apolloPeople = await apolloSearchPeople(
        settings.apolloApiKey,
        org.id,
        settings.icpTitles as string[],
        settings.maxPeoplePerCompany,
        settings.revealEmails
      )

      // 3. Upsert to Attio (if configured)
      let attioCompanyId: string | null = null
      let attioListEntryId: string | null = null

      if (settings.attioAccessToken) {
        attioCompanyId = await attioUpsertCompany(settings.attioAccessToken, org.name, domain)
        if (attioCompanyId && settings.attioListId) {
          attioListEntryId = await attioAddToList(settings.attioAccessToken, settings.attioListId, attioCompanyId)
        }
      }

      await db.prospectCompany.update({
        where: { id: company.id },
        data: {
          domain,
          apolloOrgId: org.id,
          attioCompanyId,
          attioListEntryId,
          status: 'done',
        },
      })

      // 4. Create people
      for (const person of apolloPeople) {
        let personalPhone: string | null = null
        let phoneStatus: 'pending' | 'revealed' | 'none' = 'pending'

        if (settings.revealPhones) {
          personalPhone = await apolloRevealPhone(settings.apolloApiKey, person.id)
          phoneStatus = personalPhone ? 'revealed' : 'none'
        }

        let attioPersonId: string | null = null
        if (settings.attioAccessToken && person.email) {
          attioPersonId = await attioUpsertPerson(
            settings.attioAccessToken,
            person.name,
            person.email ? [person.email] : []
          )
        }

        await db.prospectPerson.create({
          data: {
            companyId: company.id,
            apolloPersonId: person.id,
            fullName: person.name,
            title: person.title ?? '',
            seniority: person.seniority ?? '',
            emails: person.email ? [person.email] : [],
            personalPhone,
            phoneStatus,
            attioPersonId,
            status: 'done',
          },
        })

        totalPeople++
        if (personalPhone) totalPhones++
      }

      processed++
    } catch (err) {
      await db.prospectCompany.update({
        where: { id: company.id },
        data: { status: 'error', error: String(err) },
      })
      errors++
    }
  }

  await db.prospectingBatch.update({
    where: { id: batchId },
    data: {
      status: errors === companies.length ? 'error' : 'done',
      counts: { companies: processed, people: totalPeople, phones: totalPhones, errors },
    },
  })
}
