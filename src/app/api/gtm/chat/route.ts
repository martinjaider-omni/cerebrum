import { auth } from '@/lib/auth'
import { NextRequest } from 'next/server'
import { TOOL_DEFINITIONS, executeTool } from '@/lib/gtm/tools'
import { GTM_SYSTEM_PROMPT } from '@/lib/gtm/system-prompt'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured. Add it to your environment variables.' }, { status: 500 })
  }

  const { messages } = (await req.json()) as { messages: Message[] }
  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: 'messages array required' }, { status: 400 })
  }

  // Build Claude API messages
  const apiMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // Agentic loop: call Claude, execute tools, repeat until final text response
  let currentMessages = [...apiMessages]
  const maxIterations = 10

  for (let i = 0; i < maxIterations; i++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: GTM_SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages: currentMessages,
      }),
    })

    if (!response.ok) {
      const err = await response.text().catch(() => '')
      return Response.json({ error: `Claude API ${response.status}: ${err}` }, { status: 500 })
    }

    const result = await response.json()

    // Check if Claude wants to use tools
    if (result.stop_reason === 'tool_use') {
      // Extract tool use blocks
      const toolUseBlocks = result.content.filter((b: { type: string }) => b.type === 'tool_use')
      const textBlocks = result.content.filter((b: { type: string }) => b.type === 'text')

      // Add assistant message with all content blocks
      currentMessages.push({ role: 'assistant', content: result.content })

      // Execute tools and build tool results
      const toolResults = []
      for (const toolUse of toolUseBlocks) {
        const toolResult = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult,
        })
      }

      // Add tool results as user message
      currentMessages.push({ role: 'user', content: toolResults })

      // Continue loop to get Claude's response after tool use
      continue
    }

    // Final response — extract text
    const textContent = result.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')

    return Response.json({ response: textContent })
  }

  return Response.json({ error: 'Max tool iterations reached' }, { status: 500 })
}
