'use client'

import { useState, useEffect } from 'react'

interface Props {
  isAdmin: boolean
  userName: string
  userRole: string
}

export function MobileSidebarToggle({ isAdmin, userName, userRole }: Props) {
  const [open, setOpen] = useState(false)

  // Close on route change (simple — listen to clicks on links inside drawer)
  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    document.addEventListener('click', handler, { once: true, capture: true })
    return () => document.removeEventListener('click', handler, { capture: true })
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#1e1e1e] text-white flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="mobile-sidebar"
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <span className="block w-5 h-0.5 bg-white mb-1 transition-transform" style={{ transform: open ? 'translateY(6px) rotate(45deg)' : '' }} />
          <span className="block w-5 h-0.5 bg-white mb-1 transition-opacity" style={{ opacity: open ? 0 : 1 }} />
          <span className="block w-5 h-0.5 bg-white transition-transform" style={{ transform: open ? 'translateY(-6px) rotate(-45deg)' : '' }} />
        </button>
        <span className="font-bold text-sm">OmniWallet</span>
      </div>

      {/* Spacer so content doesn't go under mobile header */}
      <div className="md:hidden h-[49px] shrink-0" />

      {/* Overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <nav
        id="mobile-sidebar"
        aria-label="Menú móvil"
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-[#1e1e1e] text-white flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 border-b border-white/10">
          <h1 className="font-bold text-lg tracking-tight">OmniWallet</h1>
          <p className="text-xs text-gray-400 mt-0.5">Propuestas Comerciales</p>
        </div>
        <div className="flex-1 p-4 space-y-0.5">
          <a href="/" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
            <span aria-hidden="true">📋</span> Dashboard
          </a>
          <a href="/proposals/new" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
            <span aria-hidden="true">✏️</span> Nueva propuesta
          </a>
          <a href="/prospecting" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
            <span aria-hidden="true">🔍</span> Prospección
          </a>
          <a href="/directory" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
            <span aria-hidden="true">👥</span> Directorio
          </a>
          <a href="/gtm" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
            <span aria-hidden="true">🎯</span> GTM Engineer
          </a>
          {isAdmin && (
            <a href="/admin" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
              <span aria-hidden="true">⚙️</span> Admin
            </a>
          )}
        </div>
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-gray-400 truncate">{userName}</p>
          <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded ${isAdmin ? 'bg-purple-900 text-purple-200' : 'bg-gray-700 text-gray-300'}`}>
            {userRole}
          </span>
        </div>
      </nav>
    </>
  )
}
