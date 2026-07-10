'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function GtmChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    const userMsg: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/gtm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setMessages((prev) => [...prev, { role: 'assistant', content: json.response }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const suggestions = [
    'Analiza el workspace de Attio y dime qué listas tenemos',
    'Busca empresas de moda en España con más de 20 empleados en Apollo',
    'Busca contactos de ecommerce managers en Shopify stores',
    'Muéstrame las propuestas recientes en cerebrum',
    'Recomiéndame una estrategia de outbound para el sector restauración',
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-3xl">🎯</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">GTM Engineer</h2>
            <p className="text-gray-500 text-sm max-w-md mb-6">
              Asistente de ventas con acceso directo a Apollo y Attio. Busca prospectos, analiza tu CRM, y recibe recomendaciones GTM.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 text-gray-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-teal-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-table:text-xs prose-pre:bg-gray-50 prose-pre:text-gray-800">
                  <MarkdownContent content={msg.content} />
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                <span className="ml-2">Consultando APIs...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta sobre prospectos, CRM, o estrategia GTM..."
            rows={1}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 max-h-32"
            style={{ minHeight: '44px' }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Enviar'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">
          GTM Engineer tiene acceso a Apollo, Attio y cerebrum. Shift+Enter para nueva línea.
        </p>
      </div>
    </div>
  )
}

// Simple markdown renderer (tables, bold, lists, code blocks, links)
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: JSX.Element[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(<pre key={i} className="bg-gray-50 rounded-lg p-3 overflow-auto text-xs"><code>{codeLines.join('\n')}</code></pre>)
      i++
      continue
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const rows = tableLines
        .filter((l) => !l.match(/^\|\s*[-:]+/)) // skip separator rows
        .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
      if (rows.length > 0) {
        elements.push(
          <div key={i} className="overflow-auto">
            <table className="min-w-full text-xs border border-gray-200 rounded">
              <thead>
                <tr className="bg-gray-50">
                  {rows[0].map((h, j) => <th key={j} className="px-3 py-1.5 text-left font-semibold text-gray-600 border-b">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-100">
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-1.5 text-gray-700">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="font-bold text-gray-900 mt-3 mb-1">{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="font-bold text-gray-900 text-lg mt-3 mb-1">{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="font-bold text-gray-900 text-xl mt-3 mb-1">{line.slice(2)}</h1>)
    }
    // List
    else if (line.match(/^\s*[-*]\s/)) {
      elements.push(<li key={i} className="ml-4 list-disc text-gray-700"><InlineMarkdown text={line.replace(/^\s*[-*]\s/, '')} /></li>)
    } else if (line.match(/^\s*\d+\.\s/)) {
      elements.push(<li key={i} className="ml-4 list-decimal text-gray-700"><InlineMarkdown text={line.replace(/^\s*\d+\.\s/, '')} /></li>)
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    }
    // Regular paragraph
    else {
      elements.push(<p key={i} className="text-gray-700"><InlineMarkdown text={line} /></p>)
    }

    i++
  }

  return <>{elements}</>
}

function InlineMarkdown({ text }: { text: string }) {
  // Bold, italic, code, links
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-gray-100 px-1 rounded text-xs">{part.slice(1, -1)}</code>
        }
        const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) {
          return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{linkMatch[1]}</a>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
