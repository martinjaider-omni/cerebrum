'use client'

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

// ── Bar Chart (Revenue) ──────────────────────────────────────────────────────

export function RevenueChart({ data }: { data: MonthlySnapshot[] }) {
  if (data.length === 0) return null
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)
  const chartWidth = 700
  const chartHeight = 200
  const barPadding = 2
  const barWidth = Math.max(8, Math.min(30, (chartWidth - 60) / data.length - barPadding))
  const startX = 55

  // Show max last 24 months
  const visible = data.slice(-24)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-[#232323] mb-4">Facturación mensual</h2>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${startX + visible.length * (barWidth + barPadding) + 20} ${chartHeight + 40}`} className="w-full" style={{ minWidth: 400 }}>
          {/* Y axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = chartHeight - chartHeight * pct + 10
            const val = maxRevenue * pct
            return (
              <g key={pct}>
                <line x1={startX} y1={y} x2={startX + visible.length * (barWidth + barPadding)} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                <text x={startX - 5} y={y + 4} textAnchor="end" fill="#999" fontSize={9}>{formatEurShort(val)}</text>
              </g>
            )
          })}

          {/* Bars */}
          {visible.map((d, i) => {
            const x = startX + i * (barWidth + barPadding)
            const height = (d.revenue / maxRevenue) * chartHeight
            const y = chartHeight - height + 10

            return (
              <g key={d.month}>
                <rect x={x} y={y} width={barWidth} height={height} rx={3} fill="#3E95B0" opacity={0.85}>
                  <title>{`${formatMonth(d.month)}: €${d.revenue.toLocaleString('es-ES')}`}</title>
                </rect>
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

// ── Line Chart (MRR / Customers) ─────────────────────────────────────────────

export function MrrChart({ data }: { data: MonthlySnapshot[] }) {
  if (data.length < 2) return null
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
    month: d.month,
    mrr: d.mrr,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${chartHeight + 10} L ${points[0].x} ${chartHeight + 10} Z`

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-[#232323] mb-4">Evolución MRR</h2>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} className="w-full" style={{ minWidth: 400 }}>
          {/* Y axis */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = chartHeight - chartHeight * pct + 10
            return (
              <g key={pct}>
                <line x1={startX} y1={y} x2={endX} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                <text x={startX - 5} y={y + 4} textAnchor="end" fill="#999" fontSize={9}>{formatEurShort(maxMrr * pct)}</text>
              </g>
            )
          })}

          {/* Area fill */}
          <path d={areaPath} fill="#3E95B0" opacity={0.1} />

          {/* Line */}
          <path d={linePath} fill="none" stroke="#3E95B0" strokeWidth={2.5} strokeLinejoin="round" />

          {/* Dots + labels */}
          {points.map((p, i) => (
            <g key={p.month}>
              <circle cx={p.x} cy={p.y} r={3} fill="#3E95B0" stroke="white" strokeWidth={1.5}>
                <title>{`${formatMonth(p.month)}: €${p.mrr.toLocaleString('es-ES')}`}</title>
              </circle>
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
    month: d.month,
    customers: d.customers,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-[#232323] mb-4">Clientes activos por mes</h2>
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
              <circle cx={p.x} cy={p.y} r={2.5} fill="#255664">
                <title>{`${formatMonth(p.month)}: ${p.customers} clientes`}</title>
              </circle>
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
