'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  console.error('Application error:', error)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4">⚠️</p>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Algo salió mal</h1>
        <p className="text-gray-500 text-sm mb-2">Error inesperado en la aplicación.</p>
        <p className="text-gray-400 text-xs mb-6">Si el problema persiste, contacta con el equipo técnico.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-[#3E95B0] hover:bg-[#255664] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
