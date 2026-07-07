import { db } from './db'
import * as cheerio from 'cheerio'

// ── Phone scraping ───────────────────────────────────────────────────────────

// Regex for phone numbers: international and Spanish formats
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}(?:[-.\s]?\d{1,4})?/g

function cleanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  // Must have 9-15 digits to be valid
  if (digits.length < 9 || digits.length > 15) return null
  // Return with + if it started with +
  return raw.trim().startsWith('+') ? `+${digits}` : digits
}

async function scrapeCompanyPhone(domain: string): Promise<string | null> {
  if (!domain || domain === 'x.com') return null

  const baseUrl = `https://${domain}`
  const pagesToTry = [
    '/legal', '/aviso-legal', '/terminos', '/terminos-y-condiciones',
    '/terms', '/terms-and-conditions', '/privacy', '/privacidad',
    '/politica-de-privacidad', '/contact', '/contacto',
    '/impressum', '/imprint', '/',
  ]

  for (const path of pagesToTry) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OmniWallet-Bot/1.0)' },
        signal: AbortSignal.timeout(8_000),
        redirect: 'follow',
      })
      if (!res.ok) continue

      const html = await res.text()
      const $ = cheerio.load(html)

      // Remove scripts/styles to avoid false positives
      $('script, style, noscript').remove()
      const text = $('body').text()

      // Look for tel: links first (most reliable)
      const telHref = $('a[href^="tel:"]').first().attr('href')
      if (telHref) {
        const phone = cleanPhone(telHref.replace('tel:', ''))
        if (phone) {
          console.log(`[scrape] Found phone via tel: link on ${domain}${path}: ${phone}`)
          return phone
        }
      }

      // Look for phone patterns near keywords
      const phoneKeywords = /tel[éeè]fono|phone|tel\b|tfno|llamar|contact/i
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
      for (const line of lines) {
        if (!phoneKeywords.test(line)) continue
        const matches = line.match(PHONE_REGEX)
        if (matches) {
          for (const match of matches) {
            const phone = cleanPhone(match)
            if (phone) {
              console.log(`[scrape] Found phone via keyword on ${domain}${path}: ${phone}`)
              return phone
            }
          }
        }
      }

      // Fallback: look in footer area
      const footerText = $('footer, [class*="footer"], [id*="footer"]').text()
      if (footerText) {
        const matches = footerText.match(PHONE_REGEX)
        if (matches) {
          for (const match of matches) {
            const phone = cleanPhone(match)
            if (phone) {
              console.log(`[scrape] Found phone in footer on ${domain}${path}: ${phone}`)
              return phone
            }
          }
        }
      }
    } catch {
      // Page not found or timeout, try next
      continue
    }
  }

  console.log(`[scrape] No phone found for ${domain}`)
  return null
}

// ── Fetch with retry ─────────────────────────────────────────────────────────

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
  linkedin_url: string | null
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
  const org = json.organizations?.[0] ?? json.accounts?.[0] ?? null
  if (org) console.log(`[apollo] Found org: ${org.name} (${org.primary_domain ?? 'no domain'})`)
  return org
}

async function apolloSearchPeople(
  apiKey: string,
  orgId: string,
  titles: string[],
  maxPeople: number,
  revealEmails: boolean
): Promise<ApolloPerson[]> {
  const searchBody: Record<string, unknown> = {
    organization_ids: [orgId],
    page: 1,
    per_page: maxPeople,
  }
  if (titles.length > 0) searchBody.person_titles = titles

  const res = await fetchWithRetry(
    'https://api.apollo.io/v1/mixed_people/api_search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(searchBody),
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    throw new Error(`Apollo people search ${res.status}: ${errorBody}`)
  }
  const json = await res.json()

  // Log raw response keys and counts to diagnose
  const responseKeys = Object.keys(json)
  console.log(`[apollo] People search response keys: ${responseKeys.join(', ')}`)
  for (const key of responseKeys) {
    if (Array.isArray(json[key])) {
      console.log(`[apollo]   ${key}: ${json[key].length} items`)
      if (json[key].length > 0) {
        console.log(`[apollo]   ${key}[0] keys: ${Object.keys(json[key][0]).join(', ')}`)
      }
    } else if (typeof json[key] === 'object' && json[key] !== null) {
      console.log(`[apollo]   ${key}: ${JSON.stringify(json[key]).slice(0, 200)}`)
    } else {
      console.log(`[apollo]   ${key}: ${json[key]}`)
    }
  }

  // Try all possible response fields
  const raw: Array<Record<string, unknown>> = json.contacts ?? json.people ?? json.matches ?? []

  const people: ApolloPerson[] = raw.map((c) => ({
    id: (c.id as string) ?? '',
    name: (c.name as string) ?? (c.first_name ? `${c.first_name} ${c.last_name ?? ''}`.trim() : ''),
    title: (c.title as string) ?? '',
    seniority: (c.seniority as string) ?? '',
    email: (c.email as string) ?? null,
    linkedin_url: (c.linkedin_url as string) ?? null,
    organization_id: (c.organization_id as string) ?? orgId,
    phone_numbers: c.phone_numbers as ApolloPerson['phone_numbers'],
  }))

  console.log(`[apollo] Mapped ${people.length} contacts for org ${orgId}`)

  // If reveal emails is enabled, enrich each person via /people/match
  if (revealEmails && people.length > 0) {
    for (let i = 0; i < people.length; i++) {
      try {
        const matchRes = await fetchWithRetry(
          'https://api.apollo.io/v1/people/match',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
            body: JSON.stringify({
              id: people[i].id,
              reveal_personal_emails: true,
              reveal_phone_number: false,
            }),
            signal: AbortSignal.timeout(15_000),
          }
        )
        if (matchRes.ok) {
          const matchJson = await matchRes.json()
          if (matchJson.person?.email) {
            people[i].email = matchJson.person.email
          }
        }
      } catch {
        // Continue with existing data if reveal fails
      }
    }
  }

  return people
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
): Promise<{ recordId: string | null; error?: string }> {
  // If no valid domain, match by name only
  const values: Record<string, unknown> = { name: [{ value: name }] }
  const matchingAttribute = domain && domain !== 'x.com' ? 'domains' : 'name'
  if (domain && domain !== 'x.com') {
    values.domains = [{ domain }]
  }

  const body = { matching_attribute: matchingAttribute, values }
  console.log(`[attio] PUT companies/records:`, JSON.stringify(body))

  const res = await fetchWithRetry('https://api.attio.com/v2/objects/companies/records', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    console.error(`[attio] Company upsert failed (${res.status}): ${errorBody}`)
    // Try to extract readable error
    try {
      const parsed = JSON.parse(errorBody)
      return { recordId: null, error: `HTTP ${res.status}: ${parsed.message ?? parsed.error ?? errorBody}` }
    } catch {
      return { recordId: null, error: `HTTP ${res.status}: ${errorBody.slice(0, 200)}` }
    }
  }
  const json = await res.json()
  return { recordId: json.data?.id?.record_id ?? null }
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
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    console.error(`[attio] Add to list failed (${res.status}): ${errorBody}`)
    return null
  }
  const json = await res.json()
  return json.data?.id?.entry_id ?? null
}

async function attioUpsertPerson(
  token: string,
  name: string,
  emails: string[],
  companyRecordId: string | null
): Promise<string | null> {
  const values: Record<string, unknown> = {
    name: [{ first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' ') }],
    email_addresses: emails.map((email) => ({ email_address: email })),
  }

  // Link person to company
  if (companyRecordId) {
    values.company = [{ target: 'companies', id: { record_id: companyRecordId } }]
  }

  const res = await fetchWithRetry('https://api.attio.com/v2/objects/people/records', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      matching_attribute: 'email_addresses',
      values,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.data?.id?.record_id ?? null
}

async function attioSetListEntryContact(
  token: string,
  listId: string,
  entryId: string,
  personRecordId: string
): Promise<void> {
  await fetchWithRetry(
    `https://api.attio.com/v2/lists/${listId}/entries/${entryId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          values: {
            main_point_of_contact: [{ target: 'people', id: { record_id: personRecordId } }],
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    }
  )
}

// ── Batch processor ────────────────────────────────────────────────────────────

export async function processBatch(batchId: string): Promise<void> {
  try {
    await _processBatchInner(batchId)
  } catch (err) {
    console.error(`[prospecting] Fatal error in batch ${batchId}:`, err)
    await db.prospectingBatch.update({
      where: { id: batchId },
      data: {
        status: 'error',
        counts: { companies: 0, people: 0, phones: 0, errors: 1 },
      },
    }).catch(() => {})
  }
}

async function _processBatchInner(batchId: string): Promise<void> {
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

      // 2. Scrape company phone from website
      let companyPhone: string | null = org.phone ?? null
      if (!companyPhone) {
        try {
          companyPhone = await scrapeCompanyPhone(domain)
        } catch {
          // Non-critical: continue without phone
        }
      }

      // 3. Find people in Apollo
      const apolloPeople = await apolloSearchPeople(
        settings.apolloApiKey,
        org.id,
        settings.icpTitles as string[],
        settings.maxPeoplePerCompany,
        settings.revealEmails
      )

      // 4. Upsert to Attio (if configured)
      let attioCompanyId: string | null = null
      let attioListEntryId: string | null = null

      if (settings.attioAccessToken) {
        console.log(`[attio] Upserting company: ${org.name} (${domain})`)
        const attioResult = await attioUpsertCompany(settings.attioAccessToken, org.name, domain)
        attioCompanyId = attioResult.recordId
        if (attioResult.error) console.error(`[attio] Company error: ${attioResult.error}`)
        console.log(`[attio] Company record ID: ${attioCompanyId}`)
        if (attioCompanyId && settings.attioListId) {
          attioListEntryId = await attioAddToList(settings.attioAccessToken, settings.attioListId, attioCompanyId)
          console.log(`[attio] List entry ID: ${attioListEntryId}`)
        }
      } else {
        console.log(`[attio] Skipped — no access token configured`)
      }

      await db.prospectCompany.update({
        where: { id: company.id },
        data: {
          domain,
          phone: companyPhone,
          apolloOrgId: org.id,
          attioCompanyId,
          attioListEntryId,
          status: 'done',
        },
      })

      // 4. Create people
      let isFirstContact = true
      for (const person of apolloPeople) {
        let personalPhone: string | null = null
        let phoneStatus: 'pending' | 'revealed' | 'none' = 'pending'

        if (settings.revealPhones) {
          personalPhone = await apolloRevealPhone(settings.apolloApiKey, person.id)
          phoneStatus = personalPhone ? 'revealed' : 'none'
        }

        let attioPersonId: string | null = null
        if (settings.attioAccessToken && person.email) {
          console.log(`[attio] Upserting person: ${person.name} (${person.email})`)
          attioPersonId = await attioUpsertPerson(
            settings.attioAccessToken,
            person.name,
            person.email ? [person.email] : [],
            attioCompanyId
          )
          console.log(`[attio] Person record ID: ${attioPersonId}`)

          // Set first contact as main contact on the list entry
          if (attioPersonId && attioListEntryId && isFirstContact && settings.attioListId) {
            try {
              await attioSetListEntryContact(
                settings.attioAccessToken,
                settings.attioListId,
                attioListEntryId,
                attioPersonId
              )
              console.log(`[attio] Set main contact on list entry: ${attioPersonId}`)
            } catch (err) {
              console.error(`[attio] Failed to set main contact:`, err instanceof Error ? err.message : err)
            }
            isFirstContact = false
          }
        } else if (settings.attioAccessToken && !person.email) {
          console.log(`[attio] Skipped person ${person.name} — no email for matching`)
        }

        await db.prospectPerson.create({
          data: {
            companyId: company.id,
            apolloPersonId: person.id,
            fullName: person.name,
            title: person.title ?? '',
            seniority: person.seniority ?? '',
            linkedinUrl: person.linkedin_url,
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

// ── Manual Attio sync ────────────────────────────────────────────────────────

export async function syncBatchToAttio(batchId: string): Promise<{
  companiesSynced: number
  peopleSynced: number
  contactsSet: number
  errors: string[]
}> {
  const settings = await db.integrationSettings.findFirst()
  if (!settings?.attioAccessToken) throw new Error('Attio access token not configured')

  const companies = await db.prospectCompany.findMany({
    where: { batchId, status: 'done' },
    include: { people: { where: { status: 'done' } } },
  })

  let companiesSynced = 0
  let peopleSynced = 0
  let contactsSet = 0
  const syncErrors: string[] = []

  for (const company of companies) {
    try {
      // Upsert company
      const domain = company.domain || ''
      console.log(`[attio-sync] Upserting: ${company.inputName} (${domain})`)
      const attioResult = await attioUpsertCompany(
        settings.attioAccessToken,
        company.inputName,
        domain
      )
      if (!attioResult.recordId) {
        syncErrors.push(`${company.inputName}: ${attioResult.error ?? 'Error desconocido'}`)
        continue
      }
      const attioCompanyId = attioResult.recordId
      console.log(`[attio-sync] Company OK: ${attioCompanyId}`)

      // Add to list
      let attioListEntryId: string | null = null
      if (settings.attioListId) {
        attioListEntryId = await attioAddToList(
          settings.attioAccessToken,
          settings.attioListId,
          attioCompanyId
        )
      }

      // Update local record
      await db.prospectCompany.update({
        where: { id: company.id },
        data: { attioCompanyId, attioListEntryId },
      })
      companiesSynced++

      // Upsert people
      let isFirstContact = true
      for (const person of company.people) {
        if (person.emails.length === 0) continue

        const attioPersonId = await attioUpsertPerson(
          settings.attioAccessToken,
          person.fullName,
          person.emails,
          attioCompanyId
        )

        if (attioPersonId) {
          await db.prospectPerson.update({
            where: { id: person.id },
            data: { attioPersonId },
          })
          peopleSynced++

          // Set first contact as main point of contact
          if (attioListEntryId && isFirstContact && settings.attioListId) {
            try {
              await attioSetListEntryContact(
                settings.attioAccessToken,
                settings.attioListId,
                attioListEntryId,
                attioPersonId
              )
              contactsSet++
            } catch {
              // Non-critical
            }
            isFirstContact = false
          }
        }
      }
    } catch (err) {
      syncErrors.push(`${company.inputName}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { companiesSynced, peopleSynced, contactsSet, errors: syncErrors }
}
