import { db } from '../db'

// ── Tool definitions for Claude API ──────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'apollo_search_companies',
    description: 'Search for companies/organizations in Apollo.io by name, domain, industry, location, or employee count. Returns company details including domain, phone, industry, and employee count.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Company name or keyword to search' },
        domain: { type: 'string', description: 'Company domain to search (e.g. "shopify.com")' },
        location: { type: 'string', description: 'Location filter (e.g. "Spain", "Barcelona")' },
        min_employees: { type: 'number', description: 'Minimum number of employees' },
        max_employees: { type: 'number', description: 'Maximum number of employees' },
        per_page: { type: 'number', description: 'Results per page (max 25, default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'apollo_search_people',
    description: 'Search for people/contacts in Apollo.io by company, title, seniority, or location. Returns name, title, email, phone, LinkedIn URL.',
    input_schema: {
      type: 'object' as const,
      properties: {
        organization_ids: { type: 'array', items: { type: 'string' }, description: 'Apollo organization IDs to search within' },
        q_organization_name: { type: 'string', description: 'Company name to search people in' },
        person_titles: { type: 'array', items: { type: 'string' }, description: 'Job titles to filter (e.g. ["CEO", "CMO"])' },
        person_seniorities: { type: 'array', items: { type: 'string' }, description: 'Seniority levels (e.g. ["director", "vp", "c_suite"])' },
        person_locations: { type: 'array', items: { type: 'string' }, description: 'Locations (e.g. ["Spain"])' },
        per_page: { type: 'number', description: 'Results per page (max 25, default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'attio_list_records',
    description: 'List or search records from an Attio object (companies or people). Can filter and sort.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object: { type: 'string', enum: ['companies', 'people'], description: 'Object type to query' },
        filter: { type: 'object', description: 'Attio filter object (optional)' },
        limit: { type: 'number', description: 'Max records to return (default 20)' },
      },
      required: ['object'],
    },
  },
  {
    name: 'attio_get_list_entries',
    description: 'Get entries from a specific Attio list, including their attribute values. Use this to see what companies are in a sales pipeline or outbound list.',
    input_schema: {
      type: 'object' as const,
      properties: {
        list_id: { type: 'string', description: 'Attio list ID (leave empty to use the configured default list)' },
        limit: { type: 'number', description: 'Max entries to return (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'attio_get_lists',
    description: 'Get all lists in the Attio workspace. Returns list names, IDs, and types.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'attio_get_workspace',
    description: 'Get Attio workspace info and available objects/attributes. Useful to understand the CRM structure.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'attio_create_company',
    description: 'Create or update a company in Attio. Uses domain as matching key if available.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Company name' },
        domain: { type: 'string', description: 'Company domain (e.g. "company.com")' },
      },
      required: ['name'],
    },
  },
  {
    name: 'attio_add_to_list',
    description: 'Add a company to an Attio list by company record ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        list_id: { type: 'string', description: 'Attio list ID' },
        company_record_id: { type: 'string', description: 'Attio company record ID' },
      },
      required: ['list_id', 'company_record_id'],
    },
  },
  {
    name: 'cerebrum_search_proposals',
    description: 'Search proposals in cerebrum by client name or proposal name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'cerebrum_search_prospects',
    description: 'Search prospected companies and their contacts in cerebrum database.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search by company name, domain, or person name' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: [],
    },
  },
]

// ── Tool implementations ─────────────────────────────────────────────────────

async function getSettings() {
  const settings = await db.integrationSettings.findFirst()
  return settings
}

async function apolloFetch(apiKey: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.apollo.io/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    return { error: `Apollo API ${res.status}: ${err}` }
  }
  return res.json()
}

async function attioFetch(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.attio.com/v2${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    return { error: `Attio API ${res.status}: ${err}` }
  }
  return res.json()
}

export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const settings = await getSettings()

  try {
    switch (name) {
      case 'apollo_search_companies': {
        if (!settings?.apolloApiKey) return JSON.stringify({ error: 'Apollo API key not configured' })
        const body: Record<string, unknown> = { page: 1, per_page: input.per_page ?? 10 }
        if (input.query) body.q_organization_name = input.query
        if (input.domain) body.organization_domains = [input.domain]
        if (input.location) body.organization_locations = [input.location]
        if (input.min_employees || input.max_employees) {
          body.organization_num_employees_ranges = [`${input.min_employees ?? 1},${input.max_employees ?? 1000000}`]
        }
        const result = await apolloFetch(settings.apolloApiKey, '/organizations/search', body)
        return JSON.stringify(result, null, 2)
      }

      case 'apollo_search_people': {
        if (!settings?.apolloApiKey) return JSON.stringify({ error: 'Apollo API key not configured' })
        const body: Record<string, unknown> = { page: 1, per_page: input.per_page ?? 10 }
        if (input.organization_ids) body.organization_ids = input.organization_ids
        if (input.q_organization_name) body.q_organization_name = input.q_organization_name
        if (input.person_titles) body.person_titles = input.person_titles
        if (input.person_seniorities) body.person_seniorities = input.person_seniorities
        if (input.person_locations) body.person_locations = input.person_locations
        const result = await apolloFetch(settings.apolloApiKey, '/mixed_people/api_search', body)
        return JSON.stringify(result, null, 2)
      }

      case 'attio_list_records': {
        if (!settings?.attioAccessToken) return JSON.stringify({ error: 'Attio access token not configured' })
        const object = input.object as string
        const limit = (input.limit as number) ?? 20
        const body: Record<string, unknown> = { limit }
        if (input.filter) body.filter = input.filter
        const result = await attioFetch(settings.attioAccessToken, 'POST', `/objects/${object}/records/query`, body)
        return JSON.stringify(result, null, 2)
      }

      case 'attio_get_list_entries': {
        if (!settings?.attioAccessToken) return JSON.stringify({ error: 'Attio access token not configured' })
        const listId = (input.list_id as string) || settings.attioListId
        if (!listId) return JSON.stringify({ error: 'No list ID provided and no default configured' })
        const limit = (input.limit as number) ?? 20
        const result = await attioFetch(settings.attioAccessToken, 'POST', `/lists/${listId}/entries/query`, { limit })
        return JSON.stringify(result, null, 2)
      }

      case 'attio_get_lists': {
        if (!settings?.attioAccessToken) return JSON.stringify({ error: 'Attio access token not configured' })
        const result = await attioFetch(settings.attioAccessToken, 'GET', '/lists')
        return JSON.stringify(result, null, 2)
      }

      case 'attio_get_workspace': {
        if (!settings?.attioAccessToken) return JSON.stringify({ error: 'Attio access token not configured' })
        const [self, objects] = await Promise.all([
          attioFetch(settings.attioAccessToken, 'GET', '/self'),
          attioFetch(settings.attioAccessToken, 'GET', '/objects'),
        ])
        return JSON.stringify({ workspace: self, objects }, null, 2)
      }

      case 'attio_create_company': {
        if (!settings?.attioAccessToken) return JSON.stringify({ error: 'Attio access token not configured' })
        const values: Record<string, unknown> = { name: [{ value: input.name }] }
        const hasDomain = input.domain && input.domain !== ''
        if (hasDomain) values.domains = [{ domain: input.domain }]
        const matchAttr = hasDomain ? 'domains' : 'name'
        const url = `/objects/companies/records?matching_attribute=${matchAttr}`
        const result = await attioFetch(settings.attioAccessToken, hasDomain ? 'PUT' : 'POST', url, { data: { values } })
        return JSON.stringify(result, null, 2)
      }

      case 'attio_add_to_list': {
        if (!settings?.attioAccessToken) return JSON.stringify({ error: 'Attio access token not configured' })
        const result = await attioFetch(settings.attioAccessToken, 'POST', `/lists/${input.list_id}/entries`, {
          data: { record: { target: 'companies', id: { record_id: input.company_record_id } } },
        })
        return JSON.stringify(result, null, 2)
      }

      case 'cerebrum_search_proposals': {
        const limit = (input.limit as number) ?? 10
        const q = (input.query as string) ?? ''
        const proposals = await db.proposal.findMany({
          where: q ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { clientName: { contains: q, mode: 'insensitive' } },
            ],
          } : {},
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, clientName: true, clientSector: true, status: true, updatedAt: true },
        })
        return JSON.stringify(proposals, null, 2)
      }

      case 'cerebrum_search_prospects': {
        const limit = (input.limit as number) ?? 10
        const q = (input.query as string) ?? ''
        const companies = await db.prospectCompany.findMany({
          where: q ? {
            OR: [
              { inputName: { contains: q, mode: 'insensitive' } },
              { domain: { contains: q, mode: 'insensitive' } },
              { people: { some: { fullName: { contains: q, mode: 'insensitive' } } } },
            ],
          } : {},
          include: { people: { where: { status: 'done' } } },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })
        return JSON.stringify(companies, null, 2)
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
  }
}
