import { db } from '../db'

// ── Tool definitions for Claude API ──────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  // ── Apollo ───────────────────────────────────────────────────────────────
  {
    name: 'apollo_search_companies',
    description: 'Search for companies/organizations in Apollo.io by name, domain, industry, location, or employee count.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Company name or keyword to search' },
        domain: { type: 'string', description: 'Company domain (e.g. "shopify.com")' },
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
    description: 'Search for people/contacts in Apollo.io by company, title, seniority, or location.',
    input_schema: {
      type: 'object' as const,
      properties: {
        organization_ids: { type: 'array', items: { type: 'string' }, description: 'Apollo organization IDs' },
        q_organization_name: { type: 'string', description: 'Company name to search people in' },
        person_titles: { type: 'array', items: { type: 'string' }, description: 'Job titles (e.g. ["CEO", "CMO"])' },
        person_seniorities: { type: 'array', items: { type: 'string' }, description: 'Seniority levels (e.g. ["director", "vp"])' },
        person_locations: { type: 'array', items: { type: 'string' }, description: 'Locations (e.g. ["Spain"])' },
        per_page: { type: 'number', description: 'Results per page (max 25, default 10)' },
      },
      required: [],
    },
  },

  // ── Attio: Workspace & Schema ────────────────────────────────────────────
  {
    name: 'attio_get_workspace',
    description: 'Get Attio workspace info (name, members) and list all available objects. Use this first to understand the CRM structure.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'attio_get_object_schema',
    description: 'Get the full schema of an Attio object: all its attributes with types, slugs, and configuration. Essential to know what fields are available before creating/updating records.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object: { type: 'string', description: 'Object slug (e.g. "companies", "people", "deals", or custom object slug)' },
      },
      required: ['object'],
    },
  },
  {
    name: 'attio_list_workspace_members',
    description: 'List all workspace members (users) in Attio.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },

  // ── Attio: Records (CRUD on any object) ──────────────────────────────────
  {
    name: 'attio_query_records',
    description: 'Query/search records from any Attio object with optional filters and sorting. Returns records with all their attribute values.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object: { type: 'string', description: 'Object slug (e.g. "companies", "people", "deals")' },
        filter: { type: 'object', description: 'Attio filter object. Example: {"attribute":"name","condition":"contains","value":"Acme"}' },
        sorts: { type: 'array', items: { type: 'object' }, description: 'Array of sort objects. Example: [{"attribute":"created_at","direction":"desc"}]' },
        limit: { type: 'number', description: 'Max records (default 20, max 100)' },
        offset: { type: 'number', description: 'Offset for pagination' },
      },
      required: ['object'],
    },
  },
  {
    name: 'attio_get_record',
    description: 'Get a single record by ID from any Attio object. Returns all attribute values.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object: { type: 'string', description: 'Object slug (e.g. "companies", "people")' },
        record_id: { type: 'string', description: 'Record ID' },
      },
      required: ['object', 'record_id'],
    },
  },
  {
    name: 'attio_create_record',
    description: 'Create a new record in any Attio object. Use attio_get_object_schema first to know available attributes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object: { type: 'string', description: 'Object slug (e.g. "companies", "people")' },
        values: { type: 'object', description: 'Record values. Format: { "attribute_slug": [{ "value": "..." }] }. For domains: { "domains": [{ "domain": "example.com" }] }' },
        matching_attribute: { type: 'string', description: 'Unique attribute for upsert (e.g. "domains" for companies, "email_addresses" for people). If set, uses PUT for upsert.' },
      },
      required: ['object', 'values'],
    },
  },
  {
    name: 'attio_update_record',
    description: 'Update specific attributes of an existing record in any Attio object.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object: { type: 'string', description: 'Object slug' },
        record_id: { type: 'string', description: 'Record ID to update' },
        values: { type: 'object', description: 'Values to update. Same format as create.' },
      },
      required: ['object', 'record_id', 'values'],
    },
  },
  {
    name: 'attio_delete_record',
    description: 'Delete a record from any Attio object.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object: { type: 'string', description: 'Object slug' },
        record_id: { type: 'string', description: 'Record ID to delete' },
      },
      required: ['object', 'record_id'],
    },
  },

  // ── Attio: Lists & Entries ───────────────────────────────────────────────
  {
    name: 'attio_get_lists',
    description: 'Get all lists in the Attio workspace with their IDs, names, and object types.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'attio_get_list_schema',
    description: 'Get the schema of a list: its attributes/columns with types and slugs. Essential before updating entry values.',
    input_schema: {
      type: 'object' as const,
      properties: {
        list_id: { type: 'string', description: 'List ID' },
      },
      required: ['list_id'],
    },
  },
  {
    name: 'attio_query_list_entries',
    description: 'Query entries from an Attio list with optional filters. Returns entries with all attribute values.',
    input_schema: {
      type: 'object' as const,
      properties: {
        list_id: { type: 'string', description: 'List ID (leave empty for configured default)' },
        filter: { type: 'object', description: 'Filter object' },
        sorts: { type: 'array', items: { type: 'object' }, description: 'Sort objects' },
        limit: { type: 'number', description: 'Max entries (default 20)' },
        offset: { type: 'number', description: 'Offset for pagination' },
      },
      required: [],
    },
  },
  {
    name: 'attio_add_to_list',
    description: 'Add a record (company or person) to an Attio list.',
    input_schema: {
      type: 'object' as const,
      properties: {
        list_id: { type: 'string', description: 'List ID' },
        record_id: { type: 'string', description: 'Record ID to add' },
        record_type: { type: 'string', enum: ['companies', 'people'], description: 'Record type (default: companies)' },
      },
      required: ['list_id', 'record_id'],
    },
  },
  {
    name: 'attio_update_list_entry',
    description: 'Update attribute values on a list entry. Use attio_get_list_schema first to know available attributes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        list_id: { type: 'string', description: 'List ID' },
        entry_id: { type: 'string', description: 'Entry ID to update' },
        values: { type: 'object', description: 'Values to update. Format depends on attribute type.' },
      },
      required: ['list_id', 'entry_id', 'values'],
    },
  },
  {
    name: 'attio_delete_list_entry',
    description: 'Remove an entry from an Attio list.',
    input_schema: {
      type: 'object' as const,
      properties: {
        list_id: { type: 'string', description: 'List ID' },
        entry_id: { type: 'string', description: 'Entry ID to remove' },
      },
      required: ['list_id', 'entry_id'],
    },
  },

  // ── Attio: Notes ─────────────────────────────────────────────────────────
  {
    name: 'attio_create_note',
    description: 'Create a note attached to a record in Attio. Notes support markdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        parent_object: { type: 'string', description: 'Object slug of the parent record (e.g. "companies", "people")' },
        parent_record_id: { type: 'string', description: 'Record ID to attach the note to' },
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content (plain text)' },
      },
      required: ['parent_object', 'parent_record_id', 'title', 'content'],
    },
  },
  {
    name: 'attio_list_notes',
    description: 'List notes attached to a record in Attio.',
    input_schema: {
      type: 'object' as const,
      properties: {
        parent_object: { type: 'string', description: 'Object slug' },
        parent_record_id: { type: 'string', description: 'Record ID' },
        limit: { type: 'number', description: 'Max notes (default 20)' },
      },
      required: ['parent_object', 'parent_record_id'],
    },
  },

  // ── Attio: Tasks ─────────────────────────────────────────────────────────
  {
    name: 'attio_create_task',
    description: 'Create a task in Attio, optionally linked to a record.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'Task description' },
        deadline: { type: 'string', description: 'Deadline (ISO date string, e.g. "2024-12-31")' },
        is_completed: { type: 'boolean', description: 'Whether the task is already completed' },
        linked_records: {
          type: 'array',
          items: { type: 'object' },
          description: 'Records to link. Format: [{ "target_object": "companies", "target_record_id": "..." }]',
        },
        assignees: {
          type: 'array',
          items: { type: 'object' },
          description: 'Assignees. Format: [{ "referenced_actor_type": "workspace-member", "referenced_actor_id": "..." }]',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'attio_list_tasks',
    description: 'List tasks in Attio, optionally filtered by linked record.',
    input_schema: {
      type: 'object' as const,
      properties: {
        linked_object: { type: 'string', description: 'Filter by linked object slug' },
        linked_record_id: { type: 'string', description: 'Filter by linked record ID' },
        limit: { type: 'number', description: 'Max tasks (default 20)' },
      },
      required: [],
    },
  },

  // ── Cerebrum ─────────────────────────────────────────────────────────────
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

// ── Shared helpers ───────────────────────────────────────────────────────────

async function getSettings() {
  return db.integrationSettings.findFirst()
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

function requireAttio(settings: Awaited<ReturnType<typeof getSettings>>): string | null {
  if (!settings?.attioAccessToken) return null
  return settings.attioAccessToken
}

// ── Tool execution ───────────────────────────────────────────────────────────

export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const settings = await getSettings()

  try {
    // ── Apollo ─────────────────────────────────────────────────────────────
    if (name === 'apollo_search_companies') {
      if (!settings?.apolloApiKey) return JSON.stringify({ error: 'Apollo API key not configured' })
      const body: Record<string, unknown> = { page: 1, per_page: input.per_page ?? 10 }
      if (input.query) body.q_organization_name = input.query
      if (input.domain) body.organization_domains = [input.domain]
      if (input.location) body.organization_locations = [input.location]
      if (input.min_employees || input.max_employees) {
        body.organization_num_employees_ranges = [`${input.min_employees ?? 1},${input.max_employees ?? 1000000}`]
      }
      return JSON.stringify(await apolloFetch(settings.apolloApiKey, '/organizations/search', body), null, 2)
    }

    if (name === 'apollo_search_people') {
      if (!settings?.apolloApiKey) return JSON.stringify({ error: 'Apollo API key not configured' })
      const body: Record<string, unknown> = { page: 1, per_page: input.per_page ?? 10 }
      if (input.organization_ids) body.organization_ids = input.organization_ids
      if (input.q_organization_name) body.q_organization_name = input.q_organization_name
      if (input.person_titles) body.person_titles = input.person_titles
      if (input.person_seniorities) body.person_seniorities = input.person_seniorities
      if (input.person_locations) body.person_locations = input.person_locations
      return JSON.stringify(await apolloFetch(settings.apolloApiKey, '/mixed_people/api_search', body), null, 2)
    }

    // ── Attio: Workspace ───────────────────────────────────────────────────
    if (name === 'attio_get_workspace') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const [self, objects] = await Promise.all([
        attioFetch(token, 'GET', '/self'),
        attioFetch(token, 'GET', '/objects'),
      ])
      return JSON.stringify({ workspace: self, objects }, null, 2)
    }

    if (name === 'attio_get_object_schema') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const [object, attributes] = await Promise.all([
        attioFetch(token, 'GET', `/objects/${input.object}`),
        attioFetch(token, 'GET', `/objects/${input.object}/attributes`),
      ])
      return JSON.stringify({ object, attributes }, null, 2)
    }

    if (name === 'attio_list_workspace_members') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      return JSON.stringify(await attioFetch(token, 'GET', '/workspace_members'), null, 2)
    }

    // ── Attio: Records ─────────────────────────────────────────────────────
    if (name === 'attio_query_records') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const body: Record<string, unknown> = { limit: input.limit ?? 20 }
      if (input.filter) body.filter = input.filter
      if (input.sorts) body.sorts = input.sorts
      if (input.offset) body.offset = input.offset
      return JSON.stringify(await attioFetch(token, 'POST', `/objects/${input.object}/records/query`, body), null, 2)
    }

    if (name === 'attio_get_record') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      return JSON.stringify(await attioFetch(token, 'GET', `/objects/${input.object}/records/${input.record_id}`), null, 2)
    }

    if (name === 'attio_create_record') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const matchAttr = input.matching_attribute as string | undefined
      if (matchAttr) {
        return JSON.stringify(await attioFetch(token, 'PUT', `/objects/${input.object}/records?matching_attribute=${matchAttr}`, { data: { values: input.values } }), null, 2)
      }
      return JSON.stringify(await attioFetch(token, 'POST', `/objects/${input.object}/records`, { data: { values: input.values } }), null, 2)
    }

    if (name === 'attio_update_record') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      return JSON.stringify(await attioFetch(token, 'PATCH', `/objects/${input.object}/records/${input.record_id}`, { data: { values: input.values } }), null, 2)
    }

    if (name === 'attio_delete_record') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      return JSON.stringify(await attioFetch(token, 'DELETE', `/objects/${input.object}/records/${input.record_id}`), null, 2)
    }

    // ── Attio: Lists ───────────────────────────────────────────────────────
    if (name === 'attio_get_lists') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      return JSON.stringify(await attioFetch(token, 'GET', '/lists'), null, 2)
    }

    if (name === 'attio_get_list_schema') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const [list, attributes] = await Promise.all([
        attioFetch(token, 'GET', `/lists/${input.list_id}`),
        attioFetch(token, 'GET', `/lists/${input.list_id}/attributes`),
      ])
      return JSON.stringify({ list, attributes }, null, 2)
    }

    if (name === 'attio_query_list_entries') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const listId = (input.list_id as string) || settings?.attioListId
      if (!listId) return JSON.stringify({ error: 'No list ID provided' })
      const body: Record<string, unknown> = { limit: input.limit ?? 20 }
      if (input.filter) body.filter = input.filter
      if (input.sorts) body.sorts = input.sorts
      if (input.offset) body.offset = input.offset
      return JSON.stringify(await attioFetch(token, 'POST', `/lists/${listId}/entries/query`, body), null, 2)
    }

    if (name === 'attio_add_to_list') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const recordType = (input.record_type as string) || 'companies'
      return JSON.stringify(await attioFetch(token, 'POST', `/lists/${input.list_id}/entries`, {
        data: { record: { target: recordType, id: { record_id: input.record_id } } },
      }), null, 2)
    }

    if (name === 'attio_update_list_entry') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      return JSON.stringify(await attioFetch(token, 'PATCH', `/lists/${input.list_id}/entries/${input.entry_id}`, {
        data: { values: input.values },
      }), null, 2)
    }

    if (name === 'attio_delete_list_entry') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      return JSON.stringify(await attioFetch(token, 'DELETE', `/lists/${input.list_id}/entries/${input.entry_id}`), null, 2)
    }

    // ── Attio: Notes ───────────────────────────────────────────────────────
    if (name === 'attio_create_note') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      return JSON.stringify(await attioFetch(token, 'POST', '/notes', {
        data: {
          title: input.title,
          content_plaintext: input.content,
          parent_object: input.parent_object,
          parent_record_id: input.parent_record_id,
        },
      }), null, 2)
    }

    if (name === 'attio_list_notes') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const limit = (input.limit as number) ?? 20
      return JSON.stringify(await attioFetch(token, 'GET', `/notes?parent_object=${input.parent_object}&parent_record_id=${input.parent_record_id}&limit=${limit}`), null, 2)
    }

    // ── Attio: Tasks ───────────────────────────────────────────────────────
    if (name === 'attio_create_task') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      const body: Record<string, unknown> = {
        data: {
          content: input.content,
          is_completed: input.is_completed ?? false,
        },
      }
      if (input.deadline) (body.data as Record<string, unknown>).deadline = input.deadline
      if (input.linked_records) (body.data as Record<string, unknown>).linked_records = input.linked_records
      if (input.assignees) (body.data as Record<string, unknown>).assignees = input.assignees
      return JSON.stringify(await attioFetch(token, 'POST', '/tasks', body), null, 2)
    }

    if (name === 'attio_list_tasks') {
      const token = requireAttio(settings)
      if (!token) return JSON.stringify({ error: 'Attio not configured' })
      let path = `/tasks?limit=${input.limit ?? 20}`
      if (input.linked_object && input.linked_record_id) {
        path += `&linked_object=${input.linked_object}&linked_record_id=${input.linked_record_id}`
      }
      return JSON.stringify(await attioFetch(token, 'GET', path), null, 2)
    }

    // ── Cerebrum ───────────────────────────────────────────────────────────
    if (name === 'cerebrum_search_proposals') {
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

    if (name === 'cerebrum_search_prospects') {
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

    return JSON.stringify({ error: `Unknown tool: ${name}` })
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
  }
}
