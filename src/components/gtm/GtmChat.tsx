'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Thread {
  id: string
  title: string
  updatedAt: string
}

export function GtmChat() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load threads
  useEffect(() => {
    fetch('/api/gtm/threads')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setThreads(data) })
      .catch(() => {})
  }, [])

  // Load thread messages
  const loadThread = useCallback(async (threadId: string) => {
    setActiveThreadId(threadId)
    setMessages([])
    setError(null)
    try {
      const res = await fetch(`/api/gtm/threads/${threadId}`)
      const data = await res.json()
      if (data.messages) setMessages(data.messages)
    } catch {
      setError('Error cargando conversación')
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleNewThread() {
    const res = await fetch('/api/gtm/threads', { method: 'POST' })
    const thread = await res.json()
    setThreads((prev) => [thread, ...prev])
    setActiveThreadId(thread.id)
    setMessages([])
    setError(null)
    inputRef.current?.focus()
  }

  async function handleDeleteThread(threadId: string) {
    if (!confirm('¿Eliminar esta conversación?')) return
    await fetch(`/api/gtm/threads/${threadId}`, { method: 'DELETE' })
    setThreads((prev) => prev.filter((t) => t.id !== threadId))
    if (activeThreadId === threadId) {
      setActiveThreadId(null)
      setMessages([])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    // Auto-create thread if none active
    let threadId = activeThreadId
    if (!threadId) {
      const res = await fetch('/api/gtm/threads', { method: 'POST' })
      const thread = await res.json()
      threadId = thread.id
      setThreads((prev) => [thread, ...prev])
      setActiveThreadId(threadId)
    }

    setInput('')
    setError(null)
    const userMsg: Message = { id: `tmp-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/gtm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, message: text }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setMessages((prev) => [...prev, { id: `resp-${Date.now()}`, role: 'assistant', content: json.response }])

      // Update thread title in sidebar
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, title: prev.find((p) => p.id === threadId)?.title === 'Nueva conversación' ? text.slice(0, 80) : t.title, updatedAt: new Date().toISOString() }
            : t
        )
      )
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
    'Busca empresas de moda en España con más de 20 empleados',
    'Muéstrame las propuestas recientes en cerebrum',
    'Dame recomendaciones para mejorar nuestro proceso de outbound',
  ]

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar de threads */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-200`}>
        <div className="p-3 border-b border-gray-100">
          <button
            onClick={handleNewThread}
            className="w-full px-3 py-2 bg-[#3E95B0] hover:bg-[#255664] text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Nueva conversación
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${activeThreadId === t.id ? 'bg-[#3E95B0]/10' : ''}`}
            >
              <button
                onClick={() => loadThread(t.id)}
                className="flex-1 text-left min-w-0"
              >
                <p className="text-sm text-[#232323] truncate">{t.title}</p>
                <p className="text-xs text-gray-400">{new Date(t.updatedAt).toLocaleDateString('es-ES')}</p>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteThread(t.id) }}
                className="shrink-0 text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                title="Eliminar"
              >
                ✕
              </button>
            </div>
          ))}
          {threads.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">Sin conversaciones</p>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-gray-400 hover:text-gray-600 text-sm"
            title={sidebarOpen ? 'Ocultar historial' : 'Mostrar historial'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
          <span className="text-sm text-gray-500 truncate">
            {activeThreadId
              ? threads.find((t) => t.id === activeThreadId)?.title ?? 'Conversación'
              : 'GTM Engineer'}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 && !activeThreadId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-[#3E95B0]/15 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-3xl">🎯</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">GTM Engineer</h2>
              <p className="text-gray-500 text-sm max-w-md mb-6">
                Asistente con acceso a Apollo, Attio y cerebrum. Las conversaciones se guardan automáticamente.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus() }}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 hover:border-[#3E95B0] hover:bg-[#3E95B0]/5 text-gray-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length === 0 && activeThreadId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-400 text-sm">Escribe un mensaje para empezar</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#3E95B0] text-white rounded-br-md'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-table:text-xs">
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
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3E95B0] focus:border-[#3E95B0] max-h-32"
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
              className="shrink-0 bg-[#3E95B0] hover:bg-[#255664] text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '...' : 'Enviar'}
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-2">
            Las conversaciones se guardan automáticamente. Shift+Enter para nueva línea.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: JSX.Element[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

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

    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const rows = tableLines
        .filter((l) => !l.match(/^\|\s*[-:]+/))
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

    if (line.startsWith('### ')) elements.push(<h3 key={i} className="font-bold text-gray-900 mt-3 mb-1">{line.slice(4)}</h3>)
    else if (line.startsWith('## ')) elements.push(<h2 key={i} className="font-bold text-gray-900 text-lg mt-3 mb-1">{line.slice(3)}</h2>)
    else if (line.startsWith('# ')) elements.push(<h1 key={i} className="font-bold text-gray-900 text-xl mt-3 mb-1">{line.slice(2)}</h1>)
    else if (line.match(/^\s*[-*]\s/)) elements.push(<li key={i} className="ml-4 list-disc text-gray-700"><InlineMarkdown text={line.replace(/^\s*[-*]\s/, '')} /></li>)
    else if (line.match(/^\s*\d+\.\s/)) elements.push(<li key={i} className="ml-4 list-decimal text-gray-700"><InlineMarkdown text={line.replace(/^\s*\d+\.\s/, '')} /></li>)
    else if (line.trim() === '') elements.push(<div key={i} className="h-2" />)
    else elements.push(<p key={i} className="text-gray-700"><InlineMarkdown text={line} /></p>)

    i++
  }

  return <>{elements}</>
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-gray-100 px-1 rounded text-xs">{part.slice(1, -1)}</code>
        const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-[#3E95B0] hover:underline">{linkMatch[1]}</a>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
