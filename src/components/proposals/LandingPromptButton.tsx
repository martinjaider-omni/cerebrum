'use client'

import { useState } from 'react'

export function LandingPromptButton({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (prompt) {
      setOpen(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/landing-prompt`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setPrompt(json.prompt)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = prompt
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Generando…' : '🚀 Prompt Landing'}
      </button>

      {open && prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Prompt para Landing Page</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[#3E95B0] text-white hover:bg-[#255664] transition-colors"
                >
                  {copied ? '✓ Copiado' : 'Copiar prompt'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                {prompt}
              </pre>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <p className="text-xs text-gray-500">
                Copia este prompt y pégalo en Claude, ChatGPT u otra IA para generar la landing page HTML.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
