'use client'

export function Header({ title }: { title?: string }) {
  return (
    <header className="flex h-14 items-center border-b px-6">
      <h2 className="text-lg font-semibold">{title ?? 'OmniWallet'}</h2>
    </header>
  )
}
