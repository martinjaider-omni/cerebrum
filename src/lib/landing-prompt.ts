export interface LandingProposal {
  clientName: string
  clientUrl: string
  clientSector: string
  clientContact: string
  channelOnline: boolean
  channelStore: boolean
  techEcommerce: string
  techPos: string
  techCrm: string
  features: string[]
  brandPrimary: string
  brandSecondary: string
  brandLogoUrl: string | null
  message: string
  enterpriseEnabled: boolean
  enterpriseMonthlyFee: number | null
}

const FEATURE_LABELS: Record<string, string> = {
  wallet: 'Tarjetas Wallet (Apple & Google)',
  loyalty: 'Sistema de puntos / loyalty',
  cdp: 'CDP (datos de cliente)',
  api: 'API REST + Webhooks',
  push: 'Notificaciones Push',
  tpv: 'Integración con TPV/POS',
  stamps: 'Sellos digitales (Stamp Cards)',
  gift_cards: 'Tarjetas regalo',
  referrals: 'Referidos',
  cashback: 'Cashback',
  levels: 'Niveles de usuario',
  gamification: 'Gamificación / Juegos',
  multi_brand: 'Multi-marca / Multi-programa',
  loyalty_market: 'Loyalty Market (catálogo de premios)',
  realtime_analytics: 'Análisis en tiempo real',
  campaign_automation: 'Automatización de campañas',
  workflows: 'Workflows automatizados',
  ropo: 'ROPO (Research Online, Purchase Offline)',
  omnicodex: 'OmniCodex (códigos únicos)',
  custom_integrations: 'Integraciones personalizadas',
  csm: 'Customer Success Manager dedicado',
}

const TECH_LABELS: Record<string, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  prestashop: 'PrestaShop',
  magento2: 'Magento 2',
  bigcommerce: 'BigCommerce',
  agora: 'Agora',
  stockagile: 'Stockagile',
  a3innuva: 'a3innuva',
  klaviyo: 'Klaviyo',
  brevo: 'Brevo',
  connectif: 'Connectif',
  salesmanago: 'SALESmanago',
}

const LOGO_URLS: Record<string, string> = {
  omniwallet: 'https://omniwallet.net/assets/images/logo.svg',
  a3innuva: 'https://omniwallet.net/uploads/images/2025/12/693fd5fca65b7_9415b91a.png',
  agora: 'https://omniwallet.net/uploads/images/2025/12/693fd566398b6_51f90fd8.svg',
  bigcommerce: 'https://omniwallet.net/uploads/images/2025/12/693fd62542360_9ce5e9f3.png',
  brevo: 'https://omniwallet.net/uploads/images/2025/12/693fd4dfa274e_0099c884.jpg',
  connectif: 'https://omniwallet.net/uploads/images/2025/12/693a7122214ef_bd42b8ca.jpg',
  klaviyo: 'https://omniwallet.net/uploads/images/2025/12/693fd54f8d973_236237e2.png',
  magento2: 'https://omniwallet.net/uploads/images/2025/12/693fd59edc831_97ee4611.png',
  make: 'https://omniwallet.net/uploads/images/2025/12/693fd53f75c48_2b26d094.png',
  prestashop: 'https://omniwallet.net/uploads/images/2025/12/693fd615deae8_fce7b168.png',
  salesmanago: 'https://omniwallet.net/uploads/images/2025/12/693fd517846c2_873872e0.png',
  shopify: 'https://omniwallet.net/uploads/images/2025/12/693fd58f912ea_84bcdb60.png',
  stockagile: 'https://omniwallet.net/uploads/images/2025/12/693fd5d951ed4_210274a0.webp',
  woocommerce: 'https://omniwallet.net/uploads/images/2025/12/693fd5be30789_8221bfe2.jpg',
  oct8ne: 'https://omniwallet.net/uploads/images/2025/12/693fd5eb82a4d_e3262235.png',
  dataslayer: 'https://omniwallet.net/uploads/images/2025/12/693fd4cc20720_56219d7f.png',
  status2: 'https://omniwallet.net/uploads/images/2026/02/6985e04ba4d0a_0829b37c.webp',
}

function buildChannelLabel(online: boolean, store: boolean): string {
  if (online && store) return 'omnicanal'
  if (online) return 'online'
  if (store) return 'offline'
  return 'omnicanal'
}

function buildTechStackDescription(proposal: LandingProposal): string {
  const parts: string[] = []
  if (proposal.techEcommerce && TECH_LABELS[proposal.techEcommerce]) {
    parts.push(TECH_LABELS[proposal.techEcommerce])
  }
  if (proposal.techPos && TECH_LABELS[proposal.techPos]) {
    parts.push(TECH_LABELS[proposal.techPos])
  }
  if (proposal.techCrm && TECH_LABELS[proposal.techCrm]) {
    parts.push(TECH_LABELS[proposal.techCrm])
  }
  return parts.join(' + ')
}

function buildRelevantLogos(proposal: LandingProposal): string {
  const techIds = new Set<string>()

  // Always include OmniWallet
  techIds.add('omniwallet')

  // Add tech stack
  if (proposal.techEcommerce && LOGO_URLS[proposal.techEcommerce]) {
    techIds.add(proposal.techEcommerce)
  }
  if (proposal.techPos && LOGO_URLS[proposal.techPos]) {
    techIds.add(proposal.techPos)
  }
  if (proposal.techCrm && LOGO_URLS[proposal.techCrm]) {
    techIds.add(proposal.techCrm)
  }

  const lines: string[] = []
  for (const id of techIds) {
    const label = TECH_LABELS[id] || (id === 'omniwallet' ? 'OmniWallet' : id)
    lines.push(`- ${label}: ${LOGO_URLS[id]}`)
  }

  return lines.join('\n')
}

function buildFeatureList(features: string[]): string {
  return features
    .filter((f) => FEATURE_LABELS[f])
    .map((f) => FEATURE_LABELS[f])
    .join(', ')
}

function buildObjective(proposal: LandingProposal): string {
  const channel = buildChannelLabel(proposal.channelOnline, proposal.channelStore)
  const techStack = buildTechStackDescription(proposal)

  let objective = `Presentar la solución OmniWallet a ${proposal.clientName} (${proposal.clientSector}), mostrando cómo la plataforma de fidelización y wallet digital`

  if (techStack) {
    objective += ` se integra con su stack tecnológico actual (${techStack})`
  }

  objective += ` para potenciar su programa de loyalty ${channel}.`

  return objective
}

function buildContent(proposal: LandingProposal): string {
  const lines: string[] = []

  lines.push('- Propuesta de valor: wallet digital + fidelización omnicanal')

  const featureList = buildFeatureList(proposal.features)
  if (featureList) {
    lines.push(`- Funcionalidades clave: ${featureList}`)
  }

  const techStack = buildTechStackDescription(proposal)
  if (techStack) {
    lines.push(`- Integraciones nativas con ${techStack}`)
  }

  const channelBenefits: string[] = []
  if (proposal.channelOnline) channelBenefits.push('online')
  if (proposal.channelStore) channelBenefits.push('offline')
  if (channelBenefits.length > 0) {
    lines.push(`- Beneficios por canal: ${channelBenefits.join('/')}`)
  }

  if (proposal.enterpriseEnabled) {
    const feeNote = proposal.enterpriseMonthlyFee
      ? ` (${proposal.enterpriseMonthlyFee} EUR/mes)`
      : ''
    lines.push(`- Incluir opción Enterprise con fee fijo${feeNote}`)
  }

  if (proposal.message && proposal.message.trim()) {
    lines.push(`- Resumen ejecutivo: ${proposal.message.trim()}`)
  }

  return lines.join('\n')
}

export function generateLandingPrompt(proposal: LandingProposal): string {
  const primary = proposal.brandPrimary || '#3E95B0'
  const secondary = proposal.brandSecondary || '#255664'
  const channel = buildChannelLabel(proposal.channelOnline, proposal.channelStore)

  const tema = `una propuesta de fidelización ${channel} para ${proposal.clientName} (sector ${proposal.clientSector})`

  return `Crea una landing page HTML completa y autocontenida para ${tema}.

REQUISITOS TÉCNICOS:
1. HTML completo con <!DOCTYPE html>, <head> y <body>
2. Todos los CSS dentro de etiquetas <style>
3. NO usar archivos CSS externos (excepto Google Fonts y FontAwesome)
4. Paleta de colores:
   - Primary: ${primary}
   - Primary Dark: ${secondary}
   - Dark: #232323
   - White: #ffffff
5. Fuente: Montserrat (Google Fonts)
6. FontAwesome 6 para iconos
7. JavaScript en <script> al final del body
8. 100% responsive
9. NO incluir header ni footer (el sistema los añade)
10. Usar scroll-behavior: smooth
11. AISLAMIENTO CSS (MUY IMPORTANTE):
    - Todas las clases CSS DEBEN usar el prefijo "lp-"
    - NUNCA uses clases genéricas sin prefijo
    - Los estilos se renderizan dentro de #lp-content

ESTRUCTURA RECOMENDADA:
- Hero Section (100vh, gradiente, animación de fondo)
- 3-5 secciones con animaciones al scroll
- Sección CTA final

ANIMACIONES:
- Intersection Observer para scroll animations
- Elementos con opacity:0 y transform inicial
- Clase .visible para estado animado
- Transiciones 0.6s-0.8s ease

LOGOS DE SOFTWARE DISPONIBLES (usa <img> con los que correspondan):
${buildRelevantLogos(proposal)}

NO INCLUIR:
- Menús de navegación
- Footer
- Enlaces a archivos externos propios
- Console.log ni código debug

OBJETIVO DE LA LANDING:
${buildObjective(proposal)}

CONTENIDO A INCLUIR:
${buildContent(proposal)}`
}
