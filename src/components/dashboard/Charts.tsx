'use client'

import { useState, useRef } from 'react'

interface MonthlySnapshot {
  month: string
  revenue: number
  mrr: number
  customers: number
  newCustomers: number
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`
}

function formatEurShort(v: number): string {
  if (v >= 1000) return `€${(v / 1000).toFixed(1)}k`
  return `€${Math.round(v)}`
}

function formatEurFull(v: number): string {
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// ── Tooltip component ────────────────────────────────────────────────────────

function Tooltip({ x, y, visible, children }: { x: number; y: number; visible: boolean; children: React.ReactNode }) {
  if (!visible) return null
  return (
    <div
      className="absolute pointer-events-none z-10 bg-[#232323] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
      style={{ left: x, top: y - 40, transform: 'translateX(-50%)' }}
    >
      {children}
    </div>
  )
}

function useTooltip(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null)

  function show(e: React.MouseEvent, content: React.ReactNode) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content })
  }

  function hide() { setTooltip(null) }

  return { tooltip, show, hide }
}

// ── Bar Chart (Revenue) ──────────────────────────────────────────────────────

export function RevenueChart({ data }: { data: MonthlySnapshot[] }) {
  if (data.length === 0) return null
  const containerRef = useRef<HTMLDivElement>(null)
  const { tooltip, show, hide } = useTooltip(containerRef)

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)
  const visible = data.slice(-24)
  const chartHeight = 200
  const barPadding = 2
  const barWidth = Math.max(8, Math.min(30, 640 / visible.length - barPadding))
  const startX = 55

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 relative" ref={containerRef}>
      <h2 className="font-semibold text-[#232323] mb-4">Facturación mensual</h2>
      <Tooltip x={tooltip?.x ?? 0} y={tooltip?.y ?? 0} visible={!!tooltip}>{tooltip?.content}</Tooltip>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${startX + visible.length * (barWidth + barPadding) + 20} ${chartHeight + 40}`} className="w-full" style={{ minWidth: 400 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = chartHeight - chartHeight * pct + 10
            return (
              <g key={pct}>
                <line x1={startX} y1={y} x2={startX + visible.length * (barWidth + barPadding)} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                <text x={startX - 5} y={y + 4} textAnchor="end" fill="#999" fontSize={9}>{formatEurShort(maxRevenue * pct)}</text>
              </g>
            )
          })}
          {visible.map((d, i) => {
            const x = startX + i * (barWidth + barPadding)
            const height = (d.revenue / maxRevenue) * chartHeight
            const y = chartHeight - height + 10
            return (
              <g key={d.month}>
                <rect
                  x={x} y={y} width={barWidth} height={height} rx={3} fill="#3E95B0" opacity={0.85}
                  className="cursor-pointer hover:opacity-100 transition-opacity"
                  onMouseMove={(e) => show(e, <><strong>{formatMonth(d.month)}</strong><br />{formatEurFull(d.revenue)}</>)}
                  onMouseLeave={hide}
                />
                {i % Math.max(1, Math.floor(visible.length / 12)) === 0 && (
                  <text x={x + barWidth / 2} y={chartHeight + 25} textAnchor="middle" fill="#999" fontSize={8}>
                    {formatMonth(d.month)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ── Line Chart (MRR) ─────────────────────────────────────────────────────────

export function MrrChart({ data }: { data: MonthlySnapshot[] }) {
  if (data.length < 2) return null
  const containerRef = useRef<HTMLDivElement>(null)
  const { tooltip, show, hide } = useTooltip(containerRef)

  const visible = data.slice(-24)
  const maxMrr = Math.max(...visible.map((d) => d.mrr), 1)
  const chartWidth = 700
  const chartHeight = 200
  const startX = 55
  const endX = chartWidth - 20
  const stepX = (endX - startX) / (visible.length - 1)

  const points = visible.map((d, i) => ({
    x: startX + i * stepX,
    y: chartHeight - (d.mrr / maxMrr) * chartHeight + 10,
    ...d,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${chartHeight + 10} L ${points[0].x} ${chartHeight + 10} Z`

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 relative" ref={containerRef}>
      <h2 className="font-semibold text-[#232323] mb-4">Evolución MRR</h2>
      <Tooltip x={tooltip?.x ?? 0} y={tooltip?.y ?? 0} visible={!!tooltip}>{tooltip?.content}</Tooltip>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} className="w-full" style={{ minWidth: 400 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = chartHeight - chartHeight * pct + 10
            return (
              <g key={pct}>
                <line x1={startX} y1={y} x2={endX} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                <text x={startX - 5} y={y + 4} textAnchor="end" fill="#999" fontSize={9}>{formatEurShort(maxMrr * pct)}</text>
              </g>
            )
          })}
          <path d={areaPath} fill="#3E95B0" opacity={0.1} />
          <path d={linePath} fill="none" stroke="#3E95B0" strokeWidth={2.5} strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={p.month}>
              <circle
                cx={p.x} cy={p.y} r={4} fill="#3E95B0" stroke="white" strokeWidth={2}
                className="cursor-pointer"
                onMouseMove={(e) => show(e, <><strong>{formatMonth(p.month)}</strong><br />MRR: {formatEurFull(p.mrr)}</>)}
                onMouseLeave={hide}
              />
              {/* Invisible larger hit area */}
              <circle
                cx={p.x} cy={p.y} r={12} fill="transparent"
                onMouseMove={(e) => show(e, <><strong>{formatMonth(p.month)}</strong><br />MRR: {formatEurFull(p.mrr)}</>)}
                onMouseLeave={hide}
              />
              {i % Math.max(1, Math.floor(visible.length / 12)) === 0 && (
                <text x={p.x} y={chartHeight + 25} textAnchor="middle" fill="#999" fontSize={8}>
                  {formatMonth(p.month)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

// ── Customers Line Chart ─────────────────────────────────────────────────────

export function CustomersChart({ data }: { data: MonthlySnapshot[] }) {
  if (data.length < 2) return null
  const containerRef = useRef<HTMLDivElement>(null)
  const { tooltip, show, hide } = useTooltip(containerRef)

  const visible = data.slice(-24)
  const maxCust = Math.max(...visible.map((d) => d.customers), 1)
  const chartWidth = 700
  const chartHeight = 160
  const startX = 40
  const endX = chartWidth - 20
  const stepX = (endX - startX) / (visible.length - 1)

  const points = visible.map((d, i) => ({
    x: startX + i * stepX,
    y: chartHeight - (d.customers / maxCust) * chartHeight + 10,
    ...d,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 relative" ref={containerRef}>
      <h2 className="font-semibold text-[#232323] mb-4">Clientes activos por mes</h2>
      <Tooltip x={tooltip?.x ?? 0} y={tooltip?.y ?? 0} visible={!!tooltip}>{tooltip?.content}</Tooltip>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} className="w-full" style={{ minWidth: 400 }}>
          {[0, 0.5, 1].map((pct) => {
            const y = chartHeight - chartHeight * pct + 10
            return (
              <g key={pct}>
                <line x1={startX} y1={y} x2={endX} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                <text x={startX - 5} y={y + 4} textAnchor="end" fill="#999" fontSize={9}>{Math.round(maxCust * pct)}</text>
              </g>
            )
          })}
          <path d={linePath} fill="none" stroke="#255664" strokeWidth={2} strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={p.month}>
              <circle
                cx={p.x} cy={p.y} r={3.5} fill="#255664" stroke="white" strokeWidth={1.5}
                className="cursor-pointer"
                onMouseMove={(e) => show(e, <><strong>{formatMonth(p.month)}</strong><br />{p.customers} clientes · {p.newCustomers} nuevos</>)}
                onMouseLeave={hide}
              />
              <circle
                cx={p.x} cy={p.y} r={12} fill="transparent"
                onMouseMove={(e) => show(e, <><strong>{formatMonth(p.month)}</strong><br />{p.customers} clientes · {p.newCustomers} nuevos</>)}
                onMouseLeave={hide}
              />
              {i % Math.max(1, Math.floor(visible.length / 12)) === 0 && (
                <text x={p.x} y={chartHeight + 25} textAnchor="middle" fill="#999" fontSize={8}>
                  {formatMonth(p.month)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
