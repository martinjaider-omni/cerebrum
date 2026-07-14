import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MobileSidebarToggle } from '@/components/layout/MobileSidebarToggle'

const navLinks = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/proposals', label: 'Propuestas', icon: '📋' },
  { href: '/prospecting', label: 'Prospección', icon: '🔍' },
  { href: '/directory', label: 'Directorio', icon: '👥' },
  { href: '/gtm', label: 'GTM Engineer', icon: '🎯' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const userName = session.user?.name ?? ''
  const userRole = (session.user as { role?: string }).role ?? ''

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <img
            src="https://omniwallet.net/assets/images/logo.svg"
            alt="OmniWallet"
            className="h-7"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Navegación principal">
          {navLinks.map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#232323] hover:bg-[#3E95B0]/10 hover:text-[#3E95B0] transition-colors"
            >
              <span aria-hidden="true" className="text-base">{icon}</span>
              <span>{label}</span>
            </a>
          ))}
          {isAdmin && (
            <>
              <a
                href="/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#232323] hover:bg-[#3E95B0]/10 hover:text-[#3E95B0] transition-colors"
              >
                <span aria-hidden="true" className="text-base">🔧</span>
                <span>Ajustes</span>
              </a>
              <a
                href="/admin"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#232323] hover:bg-[#3E95B0]/10 hover:text-[#3E95B0] transition-colors"
              >
                <span aria-hidden="true" className="text-base">👤</span>
                <span>Usuarios</span>
              </a>
            </>
          )}
        </nav>

        {/* User info */}
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-sm font-medium text-[#232323] truncate">{userName}</p>
          <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${isAdmin ? 'bg-[#3E95B0]/15 text-[#3E95B0]' : 'bg-gray-100 text-gray-500'}`}>
            {userRole}
          </span>
        </div>
      </aside>

      {/* Mobile */}
      <MobileSidebarToggle isAdmin={isAdmin} userName={userName} userRole={userRole} />

      <main className="flex-1 overflow-auto min-w-0" id="main-content">
        {children}
      </main>
    </div>
  )
}
