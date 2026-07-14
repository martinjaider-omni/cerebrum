'use client'

import { useState, useEffect } from 'react'

interface Props {
  isAdmin: boolean
  userName: string
  userRole: string
}

const navLinks = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/proposals', label: 'Propuestas', icon: '📋' },
  { href: '/prospecting', label: 'Prospección', icon: '🔍' },
  { href: '/directory', label: 'Directorio', icon: '👥' },
  { href: '/gtm', label: 'GTM Engineer', icon: '🎯' },
]

export function MobileSidebarToggle({ isAdmin, userName, userRole }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    document.addEventListener('click', handler, { once: true, capture: true })
    return () => document.removeEventListener('click', handler, { capture: true })
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 flex items-center gap-3 px-4 py-3">
        <button
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="mobile-sidebar"
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E95B0]"
        >
          <span className="block w-5 h-0.5 bg-[#232323] mb-1 transition-transform" style={{ transform: open ? 'translateY(6px) rotate(45deg)' : '' }} />
          <span className="block w-5 h-0.5 bg-[#232323] mb-1 transition-opacity" style={{ opacity: open ? 0 : 1 }} />
          <span className="block w-5 h-0.5 bg-[#232323] transition-transform" style={{ transform: open ? 'translateY(-6px) rotate(-45deg)' : '' }} />
        </button>
        <img
          src="https://omniwallet.net/assets/images/logo.svg"
          alt="OmniWallet"
          className="h-5"
        />
      </div>

      <div className="md:hidden h-[49px] shrink-0" />

      {/* Overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <nav
        id="mobile-sidebar"
        aria-label="Menú móvil"
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5 border-b border-gray-100">
          <img
            src="https://omniwallet.net/assets/images/logo.svg"
            alt="OmniWallet"
            className="h-7"
          />
        </div>
        <div className="flex-1 px-3 py-4 space-y-0.5">
          {navLinks.map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#232323] hover:bg-[#3E95B0]/10 hover:text-[#3E95B0] transition-colors"
            >
              <span aria-hidden="true" className="text-base">{icon}</span>
              <span>{label}</span>
            </a>
          ))}
          {isAdmin && (
            <>
              <a href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#232323] hover:bg-[#3E95B0]/10 hover:text-[#3E95B0] transition-colors">
                <span aria-hidden="true" className="text-base">🔧</span>
                <span>Ajustes</span>
              </a>
              <a href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#232323] hover:bg-[#3E95B0]/10 hover:text-[#3E95B0] transition-colors">
                <span aria-hidden="true" className="text-base">👤</span>
                <span>Usuarios</span>
              </a>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-sm font-medium text-[#232323] truncate">{userName}</p>
          <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${isAdmin ? 'bg-[#3E95B0]/15 text-[#3E95B0]' : 'bg-gray-100 text-gray-500'}`}>
            {userRole}
          </span>
        </div>
      </nav>
    </>
  )
}
