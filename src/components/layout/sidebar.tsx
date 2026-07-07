'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FilePlus,
  Users,
  BookUser,
  Shield,
  LogOut,
} from 'lucide-react'

const baseLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/proposals/new', label: 'Nueva Propuesta', icon: FilePlus },
  { href: '/prospecting', label: 'Prospección', icon: Users },
  { href: '/directory', label: 'Directorio', icon: BookUser },
]

const adminLink = { href: '/admin', label: 'Admin', icon: Shield }

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const navLinks = isAdmin ? [...baseLinks, adminLink] : baseLinks

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-background px-4 py-6">
      <div className="mb-8">
        <h1 className="text-lg font-bold text-primary">OmniWallet</h1>
        <p className="text-xs text-muted-foreground">Generador de Propuestas</p>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              pathname === href && 'bg-accent text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors mt-4"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </button>
    </aside>
  )
}
