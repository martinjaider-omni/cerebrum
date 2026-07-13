import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { TOOL_DEFINITIONS, executeTool } from '@/lib/gtm/tools'
import { GTM_SYSTEM_PROMPT } from '@/lib/gtm/system-prompt'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await db.integrationSettings.findFirst()
  const ANTHROPIC_API_KEY = (settings as Record<string, unknown>)?.anthropicApiKey as string || process.env.ANTHROPIC_API_KEY

  if (!ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Anthropic API Key no configurada. Ve a Prospección → Configuración para añadirla.' }, { status: 500 })
  }

  const { threadId, message } = (await req.json()) as { threadId: string; message: string }
  if (!threadId || !message) {
    return Response.json({ error: 'threadId and message required' }, { status: 400 })
  }

  // Verify thread ownership
  const thread = await db.gtmThread.findUnique({ where: { id: threadId } })
  if (!thread || thread.ownerId !== session.user.id) {
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }

  // Save user message
  await db.gtmMessage.create({
    data: { threadId, role: 'user', content: message },
  })

  // Update thread title from first message
  if (thread.title === 'Nueva conversación') {
    await db.gtmThread.update({
      where: { id: threadId },
      data: { title: message.slice(0, 80) },
    })
  }

  // Load full conversation history
  const dbMessages = await db.gtmMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
  })

  // Build Claude API messages
  const apiMessages = dbMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Agentic loop
  let currentMessages: unknown[] = [...apiMessages]
  const maxIterations = 20

  for (let i = 0; i < maxIterations; i++) {
    // On last 2 iterations, remove tools to force a text response
    const isLastChance = i >= maxIterations - 2

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: isLastChance
          ? GTM_SYSTEM_PROMPT + '\n\nIMPORTANTE: Responde ahora con lo que tengas. No uses más tools.'
          : GTM_SYSTEM_PROMPT,
        ...(!isLastChance ? { tools: TOOL_DEFINITIONS } : {}),
        messages: currentMessages,
      }),
    })

    if (!response.ok) {
      const err = await response.text().catch(() => '')
      return Response.json({ error: `Claude API ${response.status}: ${err}` }, { status: 500 })
    }

    const result = await response.json()

    if (result.stop_reason === 'tool_use') {
      const toolUseBlocks = result.content.filter((b: { type: string }) => b.type === 'tool_use')
      currentMessages.push({ role: 'assistant', content: result.content })

      const toolResults = []
      for (const toolUse of toolUseBlocks) {
        const toolResult = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult,
        })
      }
      currentMessages.push({ role: 'user', content: toolResults })
      continue
    }

    // Final response
    const textContent = result.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')

    // Save assistant message to DB
    await db.gtmMessage.create({
      data: { threadId, role: 'assistant', content: textContent },
    })

    // Touch thread updatedAt
    await db.gtmThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    })

    return Response.json({ response: textContent })
  }

  return Response.json({ error: 'Max tool iterations reached' }, { status: 500 })
}
