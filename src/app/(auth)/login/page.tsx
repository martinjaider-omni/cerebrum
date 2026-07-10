'use client'

import { useState, useId } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setError('Email o contraseña incorrectos')
    } else {
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8 text-center">
          <img
            src="https://omniwallet.net/assets/images/logo.svg"
            alt="OmniWallet"
            className="h-8 mx-auto mb-4"
          />
          <p className="text-gray-500 mt-1 text-sm">Plataforma Comercial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Formulario de acceso" noValidate>
          <div>
            <label htmlFor={emailId} className="block text-sm font-medium text-[#232323] mb-1">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3E95B0] focus:border-[#3E95B0]"
              placeholder="tu@empresa.com"
              aria-describedby={error ? errorId : undefined}
            />
          </div>

          <div>
            <label htmlFor={passwordId} className="block text-sm font-medium text-[#232323] mb-1">
              Contraseña
            </label>
            <input
              id={passwordId}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3E95B0] focus:border-[#3E95B0]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p id={errorId} role="alert" className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3E95B0] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#255664] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3E95B0] focus-visible:ring-offset-2"
            aria-busy={loading}
          >
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
