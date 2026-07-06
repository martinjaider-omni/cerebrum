import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MobileSidebarToggle } from '@/components/layout/MobileSidebarToggle'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = (session.user as { role?: string }).role === 'admin'
  const userName = session.user?.name ?? ''
  const userRole = (session.user as { role?: string }).role ?? ''

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-[#1e1e1e] text-white flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <h1 className="font-bold text-lg tracking-tight">OmniWallet</h1>
          <p className="text-xs text-gray-400 mt-0.5">Propuestas Comerciales</p>
        </div>
        <nav className="flex-1 p-4 space-y-0.5" aria-label="Navegación principal">
          <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
            <span aria-hidden="true">📋</span> Dashboard
          </a>
          <a href="/proposals/new" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
            <span aria-hidden="true">✏️</span> Nueva propuesta
          </a>
          <a href="/prospecting" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
            <span aria-hidden="true">🔍</span> Prospección
          </a>
          {isAdmin && (
            <a href="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 transition-colors">
              <span aria-hidden="true">⚙️</span> Admin
            </a>
          )}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-gray-400 truncate">{userName}</p>
          <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded ${isAdmin ? 'bg-purple-900 text-purple-200' : 'bg-gray-700 text-gray-300'}`}>
            {userRole}
          </span>
        </div>
      </aside>

      {/* Mobile: header bar + drawer handled client-side */}
      <MobileSidebarToggle isAdmin={isAdmin} userName={userName} userRole={userRole} />

      <main className="flex-1 overflow-auto min-w-0" id="main-content">
        {children}
      </main>
    </div>
  )
}
