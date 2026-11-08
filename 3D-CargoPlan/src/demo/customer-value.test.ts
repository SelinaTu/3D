// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { buildPlan, scenarios } from './scenarios'
import { annualSeatUsd, buyers, competitorSeat, demoLoad, seatPoolUsd } from './customer-value'

describe('customer value evidence', () => {
  it('uses the measured block counts from the 29-piece demo', () => {
    const land = scenarios.find((item) => item.id === 'land')!
    const sea = scenarios.find((item) => item.id === 'sea')!
    expect(land.pieces).toHaveLength(demoLoad.pieces)
    const landPriority = buildPlan(land, 'priority')
    const seaPriority = buildPlan(sea, 'priority')
    expect(landPriority.placed).toHaveLength(demoLoad.pieces)
    expect(landPriority.unpacked).toHaveLength(0)
    expect(seaPriority.placed).toHaveLength(demoLoad.pieces)
    expect(seaPriority.unpacked).toHaveLength(0)
    expect(landPriority.crossStopBlocks).toBe(demoLoad.blocksWhenUnloadOrderKept)
    expect(buildPlan(land, 'bulk').crossStopBlocks).toBe(demoLoad.landBlocksWhenOrderIgnored)
    expect(seaPriority.crossStopBlocks).toBe(demoLoad.blocksWhenUnloadOrderKept)
    expect(buildPlan(sea, 'bulk').crossStopBlocks).toBe(demoLoad.seaBlocksWhenOrderIgnored)
    const weight = land.pieces.reduce((sum, piece) => sum + piece.item.weight, 0)
    expect(weight).toBe(demoLoad.weightKg)
  })

  it('prices one competitor seat against the named filing counts', () => {
    expect(annualSeatUsd(competitorSeat.cubeMasterStandardMonthlyUsd)).toBe(588)
    expect(seatPoolUsd(buyers.guangzhouLegalPersons, competitorSeat.easyCargoAnnualUsd)).toBe(3_608_284)
    expect(seatPoolUsd(buyers.guangzhouLegalPersons, 588)).toBe(2_655_408)
    expect(seatPoolUsd(buyers.nationalLegalPersonsEnd2022, competitorSeat.easyCargoAnnualUsd)).toBe(61_816_233)
  })
})