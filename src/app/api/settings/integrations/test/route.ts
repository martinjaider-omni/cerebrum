import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

interface ServiceResult { ok: boolean; error?: string; detail?: string }

interface TestResult {
  apollo: ServiceResult
  attio: ServiceResult | null
  anthropic: ServiceResult | null
}

export async function POST() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await db.integrationSettings.findFirst()
  if (!settings) return NextResponse.json({ error: 'No integration settings found' }, { status: 404 })

  const result: TestResult = {
    apollo: { ok: false },
    attio: null,
    anthropic: null,
  }

  // Test Apollo API key
  if (settings.apolloApiKey) {
    try {
      const res = await fetch('https://api.apollo.io/v1/auth/health', {
        method: 'GET',
        headers: { 'X-Api-Key': settings.apolloApiKey },
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok) {
        result.apollo = { ok: true, detail: 'API key válida' }
      } else if (res.status === 401) {
        result.apollo = { ok: false, error: 'API key inválida o expirada' }
      } else {
        // Apollo doesn't have a /health endpoint, so try a lightweight search
        const searchRes = await fetch('https://api.apollo.io/v1/organizations/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': settings.apolloApiKey,
          },
          body: JSON.stringify({ q_organization_name: 'test', page: 1, per_page: 1 }),
          signal: AbortSignal.timeout(10_000),
        })

        if (searchRes.ok) {
          result.apollo = { ok: true, detail: 'Conexión verificada via búsqueda' }
        } else if (searchRes.status === 401 || searchRes.status === 403) {
          result.apollo = { ok: false, error: 'API key inválida o sin permisos' }
        } else {
          result.apollo = { ok: false, error: `Apollo respondió con HTTP ${searchRes.status}` }
        }
      }
    } catch (err) {
      result.apollo = { ok: false, error: `No se pudo conectar: ${err instanceof Error ? err.message : String(err)}` }
    }
  } else {
    result.apollo = { ok: false, error: 'No hay API key configurada' }
  }

  // Test Attio access token (optional)
  if (settings.attioAccessToken) {
    try {
      const res = await fetch('https://api.attio.com/v2/self', {
        method: 'GET',
        headers: { Authorization: `Bearer ${settings.attioAccessToken}` },
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok) {
        const json = await res.json()
        const workspaceName = json.data?.workspace?.name ?? 'Conectado'
        result.attio = { ok: true, detail: `Workspace: ${workspaceName}` }
      } else if (res.status === 401) {
        result.attio = { ok: false, error: 'Access token inválido o expirado' }
      } else {
        result.attio = { ok: false, error: `Attio respondió con HTTP ${res.status}` }
      }
    } catch (err) {
      result.attio = { ok: false, error: `No se pudo conectar: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  // Test Anthropic API key (optional)
  const anthropicKey = (settings as Record<string, unknown>).anthropicApiKey as string
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: AbortSignal.timeout(15_000),
      })

      if (res.ok) {
        result.anthropic = { ok: true, detail: 'API key válida — modelo claude-sonnet-4-6' }
      } else if (res.status === 401) {
        result.anthropic = { ok: false, error: 'API key inválida o expirada' }
      } else if (res.status === 404) {
        // Model not found — try fallback to check if key works
        const fallbackRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: AbortSignal.timeout(15_000),
        })
        if (fallbackRes.ok) {
          result.anthropic = { ok: true, detail: 'API key válida — claude-sonnet-4-6 no disponible, verificar modelo' }
        } else if (fallbackRes.status === 401) {
          result.anthropic = { ok: false, error: 'API key inválida' }
        } else {
          const errBody = await fallbackRes.text().catch(() => '')
          result.anthropic = { ok: false, error: `HTTP ${fallbackRes.status}: ${errBody.slice(0, 200)}` }
        }
      } else {
        const errBody = await res.text().catch(() => '')
        result.anthropic = { ok: false, error: `HTTP ${res.status}: ${errBody.slice(0, 200)}` }
      }
    } catch (err) {
      result.anthropic = { ok: false, error: `No se pudo conectar: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  return NextResponse.json(result)
}
