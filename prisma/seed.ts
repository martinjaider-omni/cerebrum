import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_FEATURES = ['wallet', 'loyalty', 'cdp', 'api', 'push', 'tpv']

const CATALOG_PLANS = [
  { id: 'freemium', name: 'Freemium', base: 0, included: 100 },
  { id: 'starter', name: 'Starter', base: 39, included: 650 },
  { id: 'plus', name: 'Plus', base: 199, included: 1900 },
  { id: 'advanced', name: 'Advanced', base: 399, included: 3900 },
  { id: 'enterprise', name: 'Enterprise', base: 0, included: null },
]

const CATALOG_FEATURES = [
  { id: 'wallet', name: 'Tarjetas Wallet (Apple & Google)', plan: 'starter', category: 'CORE' },
  { id: 'loyalty', name: 'Sistema de puntos / loyalty', plan: 'starter', category: 'CORE' },
  { id: 'cdp', name: 'CDP (datos de cliente)', plan: 'starter', category: 'CORE' },
  { id: 'api', name: 'API REST + Webhooks', plan: 'starter', category: 'CORE' },
  { id: 'push', name: 'Notificaciones Push', plan: 'starter', category: 'CORE' },
  { id: 'tpv', name: 'Integración con TPV/POS', plan: 'starter', category: 'CORE' },
  { id: 'stamps', name: 'Sellos digitales (Stamp Cards)', plan: 'starter', category: 'CORE' },
  { id: 'points_expiry', name: 'Caducidad de puntos', plan: 'starter', category: 'CORE' },
  { id: 'blocked_points', name: 'Puntos bloqueados', plan: 'starter', category: 'CORE' },
  { id: 'gift_cards', name: 'Tarjetas regalo', plan: 'plus', category: 'CRECIMIENTO' },
  { id: 'referrals', name: 'Referidos', plan: 'plus', category: 'CRECIMIENTO' },
  { id: 'cashback', name: 'Cashback', plan: 'plus', category: 'CRECIMIENTO' },
  { id: 'levels', name: 'Niveles de usuario', plan: 'plus', category: 'CRECIMIENTO' },
  { id: 'loyalty_analytics', name: 'Loyalty Analytics', plan: 'plus', category: 'CRECIMIENTO' },
  { id: 'data_enrichment', name: 'Enriquecimiento de datos', plan: 'plus', category: 'CRECIMIENTO' },
  { id: 'segmentation', name: 'Segmentación de clientes', plan: 'plus', category: 'CRECIMIENTO' },
  { id: 'multi_brand', name: 'Multi-marca / Multi-programa', plan: 'advanced', category: 'AVANZADO' },
  { id: 'loyalty_market', name: 'Loyalty Market (catálogo de premios)', plan: 'advanced', category: 'AVANZADO' },
  { id: 'realtime_analytics', name: 'Análisis en tiempo real', plan: 'advanced', category: 'AVANZADO' },
  { id: 'campaign_automation', name: 'Automatización de campañas', plan: 'advanced', category: 'AVANZADO' },
  { id: 'workflows', name: 'Workflows (automatizaciones)', plan: 'advanced', category: 'AVANZADO' },
  { id: 'gamification', name: 'Gamificación / Juegos (ruletas)', plan: 'advanced', category: 'AVANZADO' },
  { id: 'ropo', name: 'ROPO (Research Online, Purchase Offline)', plan: 'advanced', category: 'AVANZADO' },
  { id: 'omnicodex', name: 'OmniCodex (códigos únicos, FMCG)', plan: 'advanced', category: 'AVANZADO' },
  { id: 'custom_integrations', name: 'Integraciones personalizadas', plan: 'enterprise', category: 'ENTERPRISE' },
  { id: 'strategic_consulting', name: 'Consultoría estratégica', plan: 'enterprise', category: 'ENTERPRISE' },
  { id: 'migration', name: 'Migración asistida a OmniWallet', plan: 'enterprise', category: 'ENTERPRISE' },
  { id: 'priority_support', name: 'Soporte técnico prioritario', plan: 'enterprise', category: 'ENTERPRISE' },
  { id: 'csm', name: 'Customer Success Manager dedicado', plan: 'enterprise', category: 'ENTERPRISE' },
  { id: 'annual_payment', name: 'Pago anual normalizado', plan: 'enterprise', category: 'ENTERPRISE' },
]

const CATALOG_TECHNOLOGIES = {
  ecommerce: [
    { id: 'shopify', name: 'Shopify', native: true },
    { id: 'woocommerce', name: 'WooCommerce', native: true },
    { id: 'prestashop', name: 'PrestaShop', native: true },
    { id: 'magento2', name: 'Magento 2', native: true },
    { id: 'bigcommerce', name: 'BigCommerce', native: true },
    { id: 'other', name: 'Otra/a medida', native: false },
    { id: 'none', name: 'No tiene', native: false },
  ],
  pos: [
    { id: 'agora', name: 'Agora', native: true },
    { id: 'stockagile', name: 'Stockagile', native: true },
    { id: 'csv', name: 'Fichero/CSV', native: true },
    { id: 'a3innuva', name: 'a3innuva ERP', native: true },
    { id: 'stm', name: 'stm ERP', native: true },
    { id: 'other', name: 'Otro', native: false },
    { id: 'none', name: 'No tiene', native: false },
  ],
  crm: [
    { id: 'hubspot', name: 'HubSpot', native: false, note: 'via API/Make' },
    { id: 'klaviyo', name: 'Klaviyo', native: true },
    { id: 'brevo', name: 'Brevo', native: true },
    { id: 'connectif', name: 'Connectif', native: true },
    { id: 'salesmanago', name: 'Sales Manago', native: true },
    { id: 'other', name: 'Otro', native: false },
    { id: 'none', name: 'No tiene', native: false },
  ],
}

const CATALOG_DEFAULT_TEXTS = {
  executiveSummary: 'Gracias por vuestra confianza. A continuacion os presentamos la propuesta comercial personalizada para {clientName}, disenada para potenciar vuestro programa de fidelizacion omnicanal con OmniWallet.',
  nextSteps: ['Validacion y aprobacion de la propuesta', 'Firma del contrato y kick-off', 'Inicio del proceso de onboarding'],
  enterpriseIncludes: ['CSM dedicado', 'SLA y soporte prioritario', 'Integraciones personalizadas y migracion asistida', 'Consultoria estrategica', 'Actividades ilimitadas dentro del volumen acordado'],
}

async function main() {
  console.log('Seeding database...')

  const adminHash = await bcrypt.hash('admin123', 10)
  const salesHash = await bcrypt.hash('sales123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@omniwallet.com' },
    update: {},
    create: { email: 'admin@omniwallet.com', passwordHash: adminHash, name: 'Admin', role: 'admin' },
  })

  const sales = await prisma.user.upsert({
    where: { email: 'sales@omniwallet.com' },
    update: {},
    create: { email: 'sales@omniwallet.com', passwordHash: salesHash, name: 'Comercial Demo', role: 'sales' },
  })

  console.log('Users:', admin.email, sales.email)

  for (const [key, data] of Object.entries({ plans: CATALOG_PLANS, features: CATALOG_FEATURES, technologies: CATALOG_TECHNOLOGIES, defaultTexts: CATALOG_DEFAULT_TEXTS })) {
    await prisma.catalog.upsert({ where: { key }, update: { data }, create: { key, data } })
  }

  console.log('Catalogs seeded')

  await prisma.proposal.upsert({
    where: { id: 'demo-proposal-1' },
    update: {},
    create: {
      id: 'demo-proposal-1',
      ownerId: sales.id,
      name: 'Propuesta Demo - Moda Iberica',
      status: 'draft',
      clientName: 'Moda Iberica S.L.',
      clientUrl: 'https://modaiberica.com',
      clientSector: 'Moda y textil',
      clientContact: 'Maria Garcia',
      channelOnline: true,
      channelStore: true,
      ordersOnline: 3000,
      ordersOffline: 1500,
      offlineRegPct: 30,
      activityFactor: 1.3,
      techEcommerce: 'shopify',
      techPos: 'agora',
      techCrm: 'klaviyo',
      features: DEFAULT_FEATURES,
      implPace: 'estandar',
      enterpriseEnabled: false,
      brandPrimary: '#C8403A',
      brandSecondary: '#8B2D2A',
      brandPalette: ['#C8403A', '#8B2D2A', '#F5E6D3'],
      message: 'Propuesta personalizada para potenciar la fidelizacion omnicanal de Moda Iberica.',
    },
  })

  console.log('Sample proposal created')
  console.log('Seed complete!')
  console.log('  Admin: admin@omniwallet.com / admin123')
  console.log('  Sales: sales@omniwallet.com / sales123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
