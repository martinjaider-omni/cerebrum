'use client'

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  name: string
  email: string
  role: 'admin' | 'sales'
  createdAt: Date
}

interface CatalogRow {
  id: string
  key: string
  data: unknown
  updatedAt: Date
}

interface Props {
  initialUsers: UserRow[]
  initialCatalogs: CatalogRow[]
  currentUserId: string
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
const btnPrimary = 'px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50'
const btnSecondary = 'px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-sm rounded-lg transition-colors'
const btnDanger = 'px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm rounded-lg transition-colors'

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab({ initial, currentUserId }: { initial: UserRow[]; currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'sales'>('sales')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'sales'>('sales')
  const [editPassword, setEditPassword] = useState('')

  function startEdit(u: UserRow) {
    setEditId(u.id)
    setEditName(u.name)
    setEditEmail(u.email)
    setEditRole(u.role)
    setEditPassword('')
    setError(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Error creando usuario')
      setUsers((prev) => [...prev, json])
      setShowCreate(false)
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('sales')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, string> = { name: editName, email: editEmail, role: editRole }
      if (editPassword) body.password = editPassword
      const res = await fetch(`/api/admin/users/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Error actualizando')
      setUsers((prev) => prev.map((u) => u.id === editId ? json : u))
      setEditId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar al usuario "${name}"? Se eliminarán también todas sus propuestas.`)) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Error eliminando')
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Usuarios</h2>
        <button className={btnPrimary} onClick={() => { setShowCreate(true); setEditId(null); setError(null) }}>
          + Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-teal-50 border border-teal-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-teal-800">Nuevo usuario</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
              <input className={inputCls} required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" className={inputCls} required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@empresa.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
              <input type="password" className={inputCls} required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
              <select className={inputCls} value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'sales')}>
                <option value="sales">Sales</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Creando…' : 'Crear usuario'}</button>
            <button type="button" className={btnSecondary} onClick={() => setShowCreate(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Creado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0">
                {editId === u.id ? (
                  <td colSpan={5} className="px-4 py-4">
                    <form onSubmit={handleUpdate} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                          <input className={inputCls} required value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                          <input type="email" className={inputCls} required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña <span className="text-gray-400">(dejar vacío para no cambiar)</span></label>
                          <input type="password" className={inputCls} minLength={6} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Nueva contraseña" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
                          <select className={inputCls} value={editRole} onChange={(e) => setEditRole(e.target.value as 'admin' | 'sales')}>
                            <option value="sales">Sales</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Guardando…' : 'Guardar'}</button>
                        <button type="button" className={btnSecondary} onClick={() => setEditId(null)}>Cancelar</button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button className={btnSecondary} onClick={() => startEdit(u)}>Editar</button>
                        {u.id !== currentUserId && (
                          <button className={btnDanger} onClick={() => handleDelete(u.id, u.name)}>Eliminar</button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Catalogs tab ───────────────────────────────────────────────────────────────

function CatalogsTab({ initial }: { initial: CatalogRow[] }) {
  const [catalogs, setCatalogs] = useState<CatalogRow[]>(initial)
  const [activeKey, setActiveKey] = useState<string>(initial[0]?.key ?? '')
  const [editJson, setEditJson] = useState<string>(() => {
    const c = initial[0]
    return c ? JSON.stringify(c.data, null, 2) : ''
  })
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function selectCatalog(key: string) {
    const c = catalogs.find((c) => c.key === key)
    if (!c) return
    setActiveKey(key)
    setEditJson(JSON.stringify(c.data, null, 2))
    setJsonError(null)
    setSaved(false)
  }

  function handleJsonChange(val: string) {
    setEditJson(val)
    setSaved(false)
    try {
      JSON.parse(val)
      setJsonError(null)
    } catch {
      setJsonError('JSON inválido')
    }
  }

  async function handleSave() {
    if (jsonError) return
    setSaving(true)
    setSaved(false)
    try {
      const data = JSON.parse(editJson)
      const res = await fetch('/api/admin/catalogs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: activeKey, data }),
      })
      if (!res.ok) throw new Error('Error guardando')
      const updated = await res.json()
      setCatalogs((prev) => prev.map((c) => c.key === activeKey ? updated : c))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setJsonError('Error guardando en servidor')
    } finally {
      setSaving(false)
    }
  }

  const CATALOG_LABELS: Record<string, string> = {
    plans: 'Planes',
    features: 'Funcionalidades',
    technologies: 'Tecnologías',
    defaultTexts: 'Textos por defecto',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Catálogos</h2>
        <p className="text-xs text-gray-400">Los cambios se aplican a nuevas propuestas. El JSON se valida antes de guardar.</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar keys */}
        <div className="w-44 shrink-0 space-y-1">
          {catalogs.map((c) => (
            <button
              key={c.key}
              onClick={() => selectCatalog(c.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeKey === c.key ? 'bg-teal-600 text-white font-medium' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              {CATALOG_LABELS[c.key] ?? c.key}
            </button>
          ))}
        </div>

        {/* JSON editor */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {CATALOG_LABELS[activeKey] ?? activeKey}
              <span className="ml-2 text-xs text-gray-400">key: {activeKey}</span>
            </span>
            <button
              onClick={handleSave}
              disabled={saving || !!jsonError}
              className={btnPrimary}
            >
              {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>

          <textarea
            className={`w-full font-mono text-xs border rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 ${jsonError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            style={{ height: '460px' }}
            value={editJson}
            onChange={(e) => handleJsonChange(e.target.value)}
            spellCheck={false}
          />

          {jsonError && (
            <p className="text-xs text-red-600">{jsonError}</p>
          )}

          <p className="text-xs text-gray-400">
            Última modificación: {new Date(catalogs.find((c) => c.key === activeKey)?.updatedAt ?? '').toLocaleString('es-ES')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AdminPanel({ initialUsers, initialCatalogs, currentUserId }: Props) {
  const [tab, setTab] = useState<'users' | 'catalogs'>('users')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Administración</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('users')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Usuarios
        </button>
        <button
          onClick={() => setTab('catalogs')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'catalogs' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Catálogos
        </button>
      </div>

      {tab === 'users' && <UsersTab initial={initialUsers} currentUserId={currentUserId} />}
      {tab === 'catalogs' && <CatalogsTab initial={initialCatalogs} />}
    </div>
  )
}
