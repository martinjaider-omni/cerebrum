import { describe, it, expect } from 'vitest'
import {
  calcActivities,
  calcTieredCost,
  calcMonthlyCost,
  recommendPlan,
  calcRoadmap,
  compute,
  suggestEnterpriseFee,
  PLANS,
} from './pricing'

describe('calcMonthlyCost', () => {
  it('Advanced plan with 4300 activities should cost 439', () => {
    expect(calcMonthlyCost('advanced', 4300)).toBe(439)
  })

  it('Starter plan with 1650 activities should cost 139', () => {
    expect(calcMonthlyCost('starter', 1650)).toBe(139)
  })

  it('returns base price when activities within included quota', () => {
    expect(calcMonthlyCost('starter', 100)).toBe(39)
  })

  it('returns 0 for freemium within quota', () => {
    expect(calcMonthlyCost('freemium', 50)).toBe(0)
  })

  it('charges tiered cost when freemium exceeds 100 included', () => {
    // 50 extra activities × 0.10 = 5
    expect(calcMonthlyCost('freemium', 150)).toBe(5)
  })

  it('Plus plan at exactly included limit costs base only', () => {
    expect(calcMonthlyCost('plus', 1900)).toBe(199)
  })
})

describe('calcTieredCost', () => {
  it('13000 additional activities should cost 840', () => {
    expect(calcTieredCost(13000)).toBe(840)
  })

  it('0 additional activities costs 0', () => {
    expect(calcTieredCost(0)).toBe(0)
  })

  it('exactly 1000 additional activities costs 100 (tier 1 only)', () => {
    // 1000 × 0.10 = 100
    expect(calcTieredCost(1000)).toBe(100)
  })

  it('exactly 5000 additional activities fills tier 1 + tier 2', () => {
    // 1000×0.10 + 4000×0.08 = 100 + 320 = 420
    expect(calcTieredCost(5000)).toBe(420)
  })

  it('handles very large volumes (>50000) using tier 5', () => {
    // 1000×0.10 + 4000×0.08 + 5000×0.06 + 40000×0.04 + 10000×0.02
    // = 100 + 320 + 300 + 1600 + 200 = 2520
    expect(calcTieredCost(60000)).toBe(2520)
  })
})

describe('calcActivities', () => {
  it('calculates activities correctly with online and offline', () => {
    const result = calcActivities({
      ordersOnline: 1000,
      ordersOffline: 500,
      offlineRegPct: 30,
      activityFactor: 1.3,
    })
    // effective = 1000 + 500 * 0.30 = 1150, * 1.3 = 1495
    expect(result).toBe(1495)
  })

  it('works with only online orders', () => {
    const result = calcActivities({
      ordersOnline: 1000,
      ordersOffline: 0,
      offlineRegPct: 30,
      activityFactor: 1.0,
    })
    expect(result).toBe(1000)
  })

  it('returns 0 when all inputs are 0', () => {
    expect(calcActivities({ ordersOnline: 0, ordersOffline: 0, offlineRegPct: 0, activityFactor: 1 })).toBe(0)
  })

  it('rounds the result to an integer', () => {
    const result = calcActivities({ ordersOnline: 1, ordersOffline: 0, offlineRegPct: 0, activityFactor: 1.3 })
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('recommendPlan', () => {
  it('recommends starter for basic features', () => {
    const { planId, enterpriseRequired } = recommendPlan(['wallet', 'loyalty'])
    expect(planId).toBe('starter')
    expect(enterpriseRequired).toBe(false)
  })

  it('recommends advanced for advanced features', () => {
    const { planId } = recommendPlan(['wallet', 'workflows', 'gamification'])
    expect(planId).toBe('advanced')
  })

  it('sets enterpriseRequired for enterprise features', () => {
    const { enterpriseRequired } = recommendPlan(['wallet', 'custom_integrations'])
    expect(enterpriseRequired).toBe(true)
  })

  it('recommends plus for plus features', () => {
    const { planId } = recommendPlan(['gift_cards', 'referrals'])
    expect(planId).toBe('plus')
  })

  it('returns starter for empty feature list', () => {
    const { planId } = recommendPlan([])
    expect(planId).toBe('starter')
  })
})

describe('calcRoadmap', () => {
  it('applies estandar pace multiplier correctly', () => {
    const roadmap = calcRoadmap({
      channelOnline: true,
      channelStore: false,
      techCrm: '',
      features: [],
      implPace: 'estandar',
    })
    const phase2 = roadmap.find(p => p.phase === 2)
    expect(phase2?.weeks).toBe(2)
  })

  it('applies rapida pace multiplier (0.6)', () => {
    const roadmap = calcRoadmap({
      channelOnline: true,
      channelStore: false,
      techCrm: '',
      features: [],
      implPace: 'rapida',
    })
    const phase2 = roadmap.find(p => p.phase === 2)
    // 2 * 0.6 = 1.2, rounded = 1, max(1,1) = 1
    expect(phase2?.weeks).toBe(1)
  })

  it('applies holgada pace multiplier (1.6)', () => {
    const roadmap = calcRoadmap({
      channelOnline: true,
      channelStore: false,
      techCrm: '',
      features: [],
      implPace: 'holgada',
    })
    const phase2 = roadmap.find(p => p.phase === 2)
    // 2 * 1.6 = 3.2, rounded = 3
    expect(phase2?.weeks).toBe(3)
  })

  it('includes store phase when channelStore is true', () => {
    const roadmap = calcRoadmap({
      channelOnline: false,
      channelStore: true,
      techCrm: '',
      features: [],
      implPace: 'estandar',
    })
    expect(roadmap.some(p => p.phase === 4)).toBe(true)
  })

  it('excludes store phase when channelStore is false', () => {
    const roadmap = calcRoadmap({
      channelOnline: true,
      channelStore: false,
      techCrm: '',
      features: [],
      implPace: 'estandar',
    })
    expect(roadmap.some(p => p.phase === 4)).toBe(false)
  })

  it('all weeks are positive integers', () => {
    const roadmap = calcRoadmap({ channelOnline: true, channelStore: true, techCrm: 'salesforce', features: ['workflows'], implPace: 'holgada' })
    for (const phase of roadmap) {
      expect(phase.weeks).toBeGreaterThan(0)
      expect(Number.isInteger(phase.weeks)).toBe(true)
    }
  })
})

describe('suggestEnterpriseFee', () => {
  it('returns at least the plan base price', () => {
    const fee = suggestEnterpriseFee(0, 199)
    expect(fee).toBeGreaterThanOrEqual(199)
  })

  it('rounds up to the next multiple of 50', () => {
    // 510 → ceil(510/50)*50 = 11*50 = 550
    const fee = suggestEnterpriseFee(510, 199)
    expect(fee).toBe(550)
  })

  it('returns a multiple of 50', () => {
    const fee = suggestEnterpriseFee(320, 199)
    expect(fee % 50).toBe(0)
  })
})

describe('compute (integration)', () => {
  const base = {
    ordersOnline: 1000,
    ordersOffline: 0,
    offlineRegPct: 30,
    activityFactor: 1.3,
    channelOnline: true,
    channelStore: false,
    techCrm: '',
    features: ['wallet', 'loyalty'],
    implPace: 'estandar' as const,
  }

  it('returns consistent activitiesPerMonth', () => {
    const result = compute(base)
    expect(result.activitiesPerMonth).toBe(calcActivities(base))
  })

  it('annualCost is exactly 12× monthlyCost', () => {
    const result = compute(base)
    expect(result.annualCost).toBe(result.monthlyCost * 12)
  })

  it('tieredBreakdown subtotals sum to variable cost', () => {
    const result = compute({ ...base, ordersOnline: 5000 })
    const plan = PLANS[result.recommendedPlanId as keyof typeof PLANS]
    const variableCost = result.monthlyCost - (plan?.base ?? 0)
    const breakdownSum = Math.round(result.tieredBreakdown.reduce((s, t) => s + t.subtotal, 0) * 100) / 100
    expect(breakdownSum).toBeCloseTo(variableCost, 1)
  })

  it('warns freemium_eligible when activities <= 100', () => {
    const result = compute({ ...base, ordersOnline: 50, activityFactor: 1 })
    expect(result.warnings).toContain('freemium_eligible')
  })

  it('warns enterprise_required for enterprise features', () => {
    const result = compute({ ...base, features: ['wallet', 'custom_integrations'] })
    expect(result.warnings).toContain('enterprise_required')
  })

  it('roadmap has at least 3 phases', () => {
    const result = compute(base)
    expect(result.roadmap.length).toBeGreaterThanOrEqual(3)
  })
})
