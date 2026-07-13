export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-black text-gray-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Página no encontrada</h1>
        <p className="text-gray-500 text-sm mb-6">El recurso que buscas no existe o ha sido eliminado.</p>
        <a
          href="/"
          className="inline-block bg-[#3E95B0] hover:bg-[#255664] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  )
}
