'use client'

import { useState, useRef } from 'react'

interface MonthlySnapshot {
  month: string
  revenue: number
  mrr: number
  customers: number
  newCustomers: number
  churnedCustomers?: number
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`
}

function formatEurShort(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return `${Math.round(v)}`
}

function formatEurFull(v: number): string {
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// -- Tooltip component --

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

// -- Bar Chart (Revenue) --

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
      <h2 className="font-semibold text-[#232323] mb-4">Facturacion mensual</h2>
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

// -- Line Chart (MRR) --

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
      <h2 className="font-semibold text-[#232323] mb-4">Evolucion MRR</h2>
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

// -- Customers Line Chart --

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

// -- New vs Churn Bar Chart --

export function ChurnVsNewChart({ data }: { data: MonthlySnapshot[] }) {
  if (data.length < 2) return null
  const containerRef = useRef<HTMLDivElement>(null)
  const { tooltip, show, hide } = useTooltip(containerRef)

  const visible = data.slice(-24)
  const maxVal = Math.max(...visible.map((d) => Math.max(d.newCustomers, d.churnedCustomers ?? 0)), 1)
  const chartHeight = 160
  const barPadding = 4
  const groupWidth = Math.max(16, Math.min(50, 640 / visible.length - barPadding))
  const barWidth = (groupWidth - 2) / 2
  const startX = 40

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#232323]">Nuevos vs Bajas</h2>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Nuevos</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Bajas</span>
        </div>
      </div>
      <Tooltip x={tooltip?.x ?? 0} y={tooltip?.y ?? 0} visible={!!tooltip}>{tooltip?.content}</Tooltip>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${startX + visible.length * (groupWidth + barPadding) + 20} ${chartHeight + 40}`} className="w-full" style={{ minWidth: 400 }}>
          {[0, 0.5, 1].map((pct) => {
            const y = chartHeight - chartHeight * pct + 10
            return (
              <g key={pct}>
                <line x1={startX} y1={y} x2={startX + visible.length * (groupWidth + barPadding)} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                <text x={startX - 5} y={y + 4} textAnchor="end" fill="#999" fontSize={9}>{Math.round(maxVal * pct)}</text>
              </g>
            )
          })}
          {visible.map((d, i) => {
            const x = startX + i * (groupWidth + barPadding)
            const newH = (d.newCustomers / maxVal) * chartHeight
            const churnH = ((d.churnedCustomers ?? 0) / maxVal) * chartHeight
            return (
              <g key={d.month}>
                <rect
                  x={x} y={chartHeight - newH + 10} width={barWidth} height={newH} rx={2} fill="#10b981" opacity={0.85}
                  className="cursor-pointer hover:opacity-100"
                  onMouseMove={(e) => show(e, <><strong>{formatMonth(d.month)}</strong><br />{d.newCustomers} nuevos</>)}
                  onMouseLeave={hide}
                />
                <rect
                  x={x + barWidth + 2} y={chartHeight - churnH + 10} width={barWidth} height={churnH} rx={2} fill="#f87171" opacity={0.85}
                  className="cursor-pointer hover:opacity-100"
                  onMouseMove={(e) => show(e, <><strong>{formatMonth(d.month)}</strong><br />{d.churnedCustomers ?? 0} bajas</>)}
                  onMouseLeave={hide}
                />
                {i % Math.max(1, Math.floor(visible.length / 12)) === 0 && (
                  <text x={x + groupWidth / 2} y={chartHeight + 25} textAnchor="middle" fill="#999" fontSize={8}>
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

// -- Donut Chart (Plan Distribution by MRR) --

interface PlanSlice {
  plan: string
  mrr: number
  count: number
}

const DONUT_COLORS: Record<string, string> = {
  Starter: '#3b82f6',
  Plus: '#8b5cf6',
  Advanced: '#3E95B0',
  Legacy: '#f59e0b',
  Free: '#9ca3af',
}

export function PlanDonutChart({ data, totalMrr }: { data: PlanSlice[]; totalMrr: number }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const paying = data.filter((d) => d.plan !== 'Free' && d.mrr > 0)
  if (paying.length === 0) return null

  const size = 180
  const cx = size / 2, cy = size / 2
  const outerR = 75, innerR = 48

  let cumAngle = -Math.PI / 2
  const slices = paying.map((d) => {
    const pct = totalMrr > 0 ? d.mrr / totalMrr : 0
    const startAngle = cumAngle
    cumAngle += pct * 2 * Math.PI
    return { ...d, pct, startAngle, endAngle: cumAngle }
  })

  function arcPath(startAngle: number, endAngle: number, r: number, ir: number) {
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    const sx = cx + r * Math.cos(startAngle), sy = cy + r * Math.sin(startAngle)
    const ex = cx + r * Math.cos(endAngle), ey = cy + r * Math.sin(endAngle)
    const isx = cx + ir * Math.cos(endAngle), isy = cy + ir * Math.sin(endAngle)
    const iex = cx + ir * Math.cos(startAngle), iey = cy + ir * Math.sin(startAngle)
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} L ${isx} ${isy} A ${ir} ${ir} 0 ${largeArc} 0 ${iex} ${iey} Z`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-[#232323] mb-4">Distribucion MRR por plan</h2>
      <div className="flex items-center gap-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((s) => (
            <path
              key={s.plan}
              d={arcPath(s.startAngle, s.endAngle, hovered === s.plan ? outerR + 4 : outerR, innerR)}
              fill={DONUT_COLORS[s.plan] ?? '#6b7280'}
              opacity={hovered && hovered !== s.plan ? 0.4 : 1}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHovered(s.plan)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#232323" fontSize={14} fontWeight="bold">
            {formatEurShort(totalMrr)}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#999" fontSize={9}>MRR</text>
        </svg>
        <div className="flex flex-col gap-2 text-sm">
          {slices.map((s) => (
            <div
              key={s.plan}
              className="flex items-center gap-2 cursor-pointer"
              onMouseEnter={() => setHovered(s.plan)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[s.plan] ?? '#6b7280' }} />
              <span className="text-gray-700 font-medium">{s.plan}</span>
              <span className="text-gray-400">{Math.round(s.pct * 100)}%</span>
              <span className="text-gray-500">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
