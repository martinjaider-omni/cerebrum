import { compute, PLANS } from './pricing'

interface ProposalForTemplate {
  id: string
  name: string
  clientName: string
  clientUrl: string
  clientSector: string
  clientContact: string
  channelOnline: boolean
  channelStore: boolean
  ordersOnline: number
  ordersOffline: number
  offlineRegPct: number
  activityFactor: number
  techEcommerce: string
  techPos: string
  techCrm: string
  features: string[]
  implPace: 'rapida' | 'estandar' | 'holgada'
  enterpriseEnabled: boolean
  enterpriseMonthlyFee: number | null
  enterpriseTerm: string
  enterpriseIncludes: string[]
  brandLogoUrl: string | null
  brandPrimary: string
  brandSecondary: string
  brandPalette: string[]
  message: string
}

const FEATURE_LABELS: Record<string, string> = {
  wallet: 'Tarjetas Wallet (Apple & Google)',
  loyalty: 'Sistema de puntos / loyalty',
  cdp: 'CDP (datos de cliente)',
  api: 'API REST + Webhooks',
  push: 'Notificaciones Push',
  tpv: 'Integración con TPV/POS',
  stamps: 'Sellos digitales (Stamp Cards)',
  points_expiry: 'Caducidad de puntos',
  blocked_points: 'Puntos bloqueados',
  gift_cards: 'Tarjetas regalo',
  referrals: 'Referidos',
  cashback: 'Cashback',
  levels: 'Niveles de usuario',
  loyalty_analytics: 'Loyalty Analytics',
  data_enrichment: 'Enriquecimiento de datos',
  segmentation: 'Segmentación de clientes',
  multi_brand: 'Multi-marca / Multi-programa',
  loyalty_market: 'Loyalty Market (catálogo de premios)',
  realtime_analytics: 'Análisis de transacciones en tiempo real',
  campaign_automation: 'Automatización de campañas',
  workflows: 'Workflows (automatizaciones)',
  gamification: 'Gamificación / Juegos (ruletas)',
  ropo: 'ROPO (Research Online, Purchase Offline)',
  omnicodex: 'OmniCodex (códigos únicos, FMCG)',
  custom_integrations: 'Integraciones personalizadas',
  strategic_consulting: 'Consultoría estratégica',
  migration: 'Migración asistida a OmniWallet',
  priority_support: 'Soporte técnico prioritario',
  csm: 'Customer Success Manager dedicado',
  annual_payment: 'Pago anual normalizado',
}

const PACE_LABELS: Record<string, string> = {
  rapida: 'Rápida',
  estandar: 'Estándar',
  holgada: 'Holgada',
}

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function num(n: number) {
  return new Intl.NumberFormat('es-ES').format(n)
}

function lighten(hex: string, amount = 0.92): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * amount)
  const lg = Math.round(g + (255 - g) * amount)
  const lb = Math.round(b + (255 - b) * amount)
  return `rgb(${lr},${lg},${lb})`
}

export function renderProposalHtml(proposal: ProposalForTemplate, baseUrl = ''): string {
  const result = compute({
    ordersOnline: proposal.ordersOnline,
    ordersOffline: proposal.ordersOffline,
    offlineRegPct: proposal.offlineRegPct,
    activityFactor: proposal.activityFactor,
    channelOnline: proposal.channelOnline,
    channelStore: proposal.channelStore,
    techCrm: proposal.techCrm,
    features: proposal.features,
    implPace: proposal.implPace,
  })

  const plan = PLANS[result.recommendedPlanId as keyof typeof PLANS]
  const primary = proposal.brandPrimary || '#3E95B0'
  const secondary = proposal.brandSecondary || '#255664'
  const primaryLight = lighten(primary)
  const logoSrc = proposal.brandLogoUrl
    ? (proposal.brandLogoUrl.startsWith('/') ? `${baseUrl}${proposal.brandLogoUrl}` : proposal.brandLogoUrl)
    : null

  const totalRoadmapWeeks = result.roadmap.reduce((s, p) => s + p.weeks, 0)
  const selectedFeatureLabels = proposal.features.map((f) => FEATURE_LABELS[f] ?? f)

  const channels = [
    proposal.channelOnline ? 'Tienda online' : null,
    proposal.channelStore ? 'Tiendas físicas' : null,
  ].filter(Boolean).join(' + ')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escHtml(proposal.name)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #1a1a1a; background: #f5f5f5; }
  .page { max-width: 860px; margin: 0 auto; background: #fff; }

  /* COVER */
  .cover {
    background: linear-gradient(135deg, ${primary} 0%, ${secondary} 100%);
    color: #fff;
    padding: 60px 60px 48px;
    position: relative;
    overflow: hidden;
  }
  .cover::after {
    content: '';
    position: absolute;
    right: -60px; top: -60px;
    width: 340px; height: 340px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  .cover-logo { height: 56px; object-fit: contain; margin-bottom: 36px; }
  .cover-logo-placeholder {
    display: inline-flex; align-items: center; justify-content: center;
    height: 56px; width: 56px; border-radius: 12px;
    background: rgba(255,255,255,0.18); margin-bottom: 36px;
    font-size: 28px;
  }
  .cover-label { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.7; margin-bottom: 12px; }
  .cover-title { font-size: 32px; font-weight: 700; line-height: 1.2; margin-bottom: 10px; }
  .cover-client { font-size: 18px; opacity: 0.85; margin-bottom: 36px; }
  .cover-meta { display: flex; gap: 32px; opacity: 0.75; font-size: 13px; }
  .cover-meta span::before { content: attr(data-label) ': '; font-weight: 600; }

  /* SECTION */
  .section { padding: 36px 60px; border-bottom: 1px solid #eee; }
  .section:last-child { border-bottom: none; }
  .section-title {
    font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
    color: ${primary}; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
  }
  .section-title::after { content: ''; flex: 1; height: 1px; background: ${primaryLight}; }

  /* PLAN HERO */
  .plan-hero {
    background: ${primaryLight};
    border: 2px solid ${primary};
    border-radius: 16px;
    padding: 28px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  }
  .plan-name { font-size: 28px; font-weight: 800; color: ${primary}; }
  .plan-desc { font-size: 13px; color: #555; margin-top: 4px; }
  .plan-price-block { text-align: right; }
  .plan-price { font-size: 36px; font-weight: 800; color: ${secondary}; }
  .plan-price sub { font-size: 15px; font-weight: 400; color: #888; }
  .plan-annual { font-size: 13px; color: #666; margin-top: 2px; }

  /* GRID */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

  /* STAT CARD */
  .stat-card { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 12px; padding: 16px 20px; }
  .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .stat-value { font-size: 22px; font-weight: 700; color: #1a1a1a; }
  .stat-sub { font-size: 12px; color: #aaa; margin-top: 2px; }

  /* FEATURES */
  .feature-pill {
    display: inline-flex; align-items: center; gap-6px;
    background: ${primaryLight}; color: ${secondary};
    border: 1px solid ${primary}33;
    padding: 5px 12px; border-radius: 999px;
    font-size: 12px; font-weight: 500; margin: 4px 4px 0 0;
  }
  .feature-pill::before { content: '✓'; color: ${primary}; font-weight: 700; margin-right: 5px; }

  /* ROADMAP */
  .roadmap { display: flex; gap: 0; }
  .phase {
    flex: 1; padding: 16px 14px; border-radius: 0; position: relative;
    background: #fafafa; border: 1px solid #e8e8e8; border-right: none;
  }
  .phase:first-child { border-radius: 12px 0 0 12px; }
  .phase:last-child { border-radius: 0 12px 12px 0; border-right: 1px solid #e8e8e8; }
  .phase-num { font-size: 10px; font-weight: 700; color: ${primary}; text-transform: uppercase; letter-spacing: 1px; }
  .phase-name { font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 4px 0; }
  .phase-weeks { font-size: 20px; font-weight: 800; color: ${secondary}; }
  .phase-weeks span { font-size: 12px; font-weight: 400; color: #888; }

  /* TIER TABLE */
  .tier-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .tier-table th { text-align: left; padding: 8px 12px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
  .tier-table td { padding: 8px 12px; border-top: 1px solid #eee; }
  .tier-table tr:last-child td { font-weight: 700; border-top: 2px solid #ddd; }

  /* ENTERPRISE */
  .enterprise-box {
    background: linear-gradient(135deg, ${secondary}12, ${primary}12);
    border: 1.5px solid ${primary}44;
    border-radius: 12px; padding: 20px 24px;
  }
  .enterprise-title { font-size: 15px; font-weight: 700; color: ${secondary}; margin-bottom: 4px; }
  .enterprise-fee { font-size: 28px; font-weight: 800; color: ${primary}; }
  .enterprise-includes { font-size: 12px; color: #666; margin-top: 8px; }
  .enterprise-includes li { margin-top: 3px; list-style: none; }
  .enterprise-includes li::before { content: '→ '; color: ${primary}; }

  /* MESSAGE */
  .message-box {
    background: #fafafa; border-left: 4px solid ${primary};
    border-radius: 0 8px 8px 0; padding: 16px 20px;
    font-size: 13px; line-height: 1.7; color: #444; white-space: pre-wrap;
  }

  /* FOOTER */
  .footer {
    background: ${secondary}; color: rgba(255,255,255,0.7);
    padding: 20px 60px; font-size: 12px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer strong { color: #fff; }

  @media print {
    body { background: #fff; }
    .page { max-width: 100%; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .plan-hero, .enterprise-box, .phase, .tier-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- COVER -->
  <div class="cover">
    ${logoSrc
      ? `<img src="${escHtml(logoSrc)}" alt="Logo ${escHtml(proposal.clientName)}" class="cover-logo" />`
      : `<div class="cover-logo-placeholder">🏢</div>`}
    <div class="cover-label">Propuesta comercial</div>
    <div class="cover-title">${escHtml(proposal.clientName || 'Empresa cliente')}</div>
    <div class="cover-client">${escHtml(proposal.name)}</div>
    <div class="cover-meta">
      ${proposal.clientContact ? `<span data-label="Contacto">${escHtml(proposal.clientContact)}</span>` : ''}
      ${proposal.clientSector ? `<span data-label="Sector">${escHtml(proposal.clientSector)}</span>` : ''}
      ${channels ? `<span data-label="Canales">${escHtml(channels)}</span>` : ''}
    </div>
  </div>

  <!-- PLAN RECOMENDADO -->
  <div class="section">
    <div class="section-title">Plan recomendado</div>
    <div class="plan-hero">
      <div>
        <div class="plan-name">${escHtml(plan?.name ?? result.recommendedPlanId)}</div>
        <div class="plan-desc">${num(result.activitiesPerMonth)} actividades/mes estimadas · ${num(plan?.included ?? 0)} incluidas en el plan</div>
      </div>
      <div class="plan-price-block">
        <div class="plan-price">${result.recommendedPlanId === 'enterprise' ? 'A medida' : eur(result.monthlyCost)}<sub>/mes</sub></div>
        ${result.recommendedPlanId !== 'enterprise' ? `<div class="plan-annual">${eur(result.annualCost)}/año</div>` : ''}
      </div>
    </div>
  </div>

  <!-- VOLUMEN -->
  <div class="section">
    <div class="section-title">Volumen estimado</div>
    <div class="grid-3">
      ${proposal.channelOnline ? `<div class="stat-card"><div class="stat-label">Pedidos online/mes</div><div class="stat-value">${num(proposal.ordersOnline)}</div></div>` : ''}
      ${proposal.channelStore ? `<div class="stat-card"><div class="stat-label">Pedidos físicos/mes</div><div class="stat-value">${num(proposal.ordersOffline)}</div><div class="stat-sub">${proposal.offlineRegPct}% registrados</div></div>` : ''}
      <div class="stat-card"><div class="stat-label">Actividades/mes</div><div class="stat-value">${num(result.activitiesPerMonth)}</div><div class="stat-sub">factor × ${proposal.activityFactor}</div></div>
    </div>
  </div>

  <!-- DESGLOSE DE PRECIO -->
  ${result.tieredBreakdown.length > 0 ? `
  <div class="section">
    <div class="section-title">Desglose de coste</div>
    <table class="tier-table">
      <thead><tr><th>Tramo</th><th>Actividades</th><th>€/actividad</th><th>Subtotal</th></tr></thead>
      <tbody>
        <tr><td>Cuota base ${escHtml(plan?.name ?? '')} (${num(plan?.included ?? 0)} incluidas)</td><td>—</td><td>—</td><td>${eur(plan?.base ?? 0)}</td></tr>
        ${result.tieredBreakdown.map((t) => `<tr><td>${escHtml(t.label)}</td><td>${num(t.units)}</td><td>${t.price.toFixed(2)} €</td><td>${eur(t.subtotal)}</td></tr>`).join('')}
        <tr><td colspan="3">Total mensual estimado</td><td>${eur(result.monthlyCost)}</td></tr>
      </tbody>
    </table>
  </div>` : ''}

  <!-- FUNCIONALIDADES -->
  <div class="section">
    <div class="section-title">Funcionalidades incluidas</div>
    <div>
      ${selectedFeatureLabels.map((f) => `<span class="feature-pill">${escHtml(f)}</span>`).join('')}
    </div>
  </div>

  <!-- ROADMAP -->
  <div class="section">
    <div class="section-title">Roadmap de implementación · ${PACE_LABELS[proposal.implPace] ?? proposal.implPace} · ${totalRoadmapWeeks} semanas totales</div>
    <div class="roadmap">
      ${result.roadmap.map((p, i) => `
        <div class="phase">
          <div class="phase-num">Fase ${i + 1}</div>
          <div class="phase-name">${escHtml(p.name)}</div>
          <div class="phase-weeks">${p.weeks}<span> sem</span></div>
        </div>`).join('')}
    </div>
  </div>

  <!-- ENTERPRISE (si aplica) -->
  ${proposal.enterpriseEnabled ? `
  <div class="section">
    <div class="section-title">Propuesta Enterprise</div>
    <div class="enterprise-box">
      <div class="enterprise-title">Cuota Enterprise personalizada</div>
      <div class="enterprise-fee">${proposal.enterpriseMonthlyFee ? eur(proposal.enterpriseMonthlyFee) : eur(result.suggestedEnterpriseFee)}<span style="font-size:14px;font-weight:400;color:#888">/mes · ${escHtml(proposal.enterpriseTerm)}</span></div>
      ${proposal.enterpriseIncludes.length > 0 ? `
      <ul class="enterprise-includes">
        ${proposal.enterpriseIncludes.map((inc) => `<li>${escHtml(inc)}</li>`).join('')}
      </ul>` : ''}
    </div>
  </div>` : ''}

  <!-- MENSAJE PERSONALIZADO -->
  ${proposal.message ? `
  <div class="section">
    <div class="section-title">Mensaje al cliente</div>
    <div class="message-box">${escHtml(proposal.message)}</div>
  </div>` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <div><strong>OmniWallet</strong> · Generador de Propuestas Comerciales</div>
    <div>${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

</div>
</body>
</html>`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
