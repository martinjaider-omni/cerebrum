export type UserRole = 'admin' | 'sales'

export type ProposalStatus = 'draft' | 'final'

export type ImplPace = 'rapida' | 'estandar' | 'holgada'

export interface ProposalFormData {
  id?: string
  ownerId: string
  name: string
  status: ProposalStatus
  clientName: string
  clientUrl: string
  clientSector: string
  clientContact: string
  clientDemoDate?: Date | null
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
  implPace: ImplPace
  enterpriseEnabled: boolean
  enterpriseMonthlyFee?: number | null
  enterpriseTerm: string
  enterpriseIncludes: string[]
  brandLogoUrl?: string | null
  brandPrimary: string
  brandSecondary: string
  brandPalette: string[]
  message: string
  overrides: Record<string, unknown>
  computed: Record<string, unknown>
  shareToken?: string | null
}

export type { ComputeResult } from '@/lib/pricing'
