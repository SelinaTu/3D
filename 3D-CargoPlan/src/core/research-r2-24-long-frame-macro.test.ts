// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { loadResearchCalibration } from './research-calibration'
import { createEmptyContainer } from './greedy-algorithm'
import { createPackingSolution } from './solution-builder'
import { validateSolution } from './validation'
import { placeTwentyFourLongFrameMacro } from './research-r2-24-long-frame-macro'

const cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const items = cal.items.filter(i => i.rawData._sourceSheet === '门窗' && i.rawData._sourceRow === 23).slice(0, 24)
describe('24 long-frame cross-section construction', () => {
  it('validates twenty-four frames and each strict base load', () => {
    const c = createEmptyContainer(0, cal.config, items), result = placeTwentyFourLongFrameMacro(c, items)
    expect(result.accepted).toBe(true)
    expect(c.items).toHaveLength(24)
    expect(result.baseLoadsKg!.every(w => w < 120)).toBe(true)
    expect(Math.max(...result.baseLoadsKg!)).toBeCloseTo(119.72121212121212, 6)
    expect(validateSolution(createPackingSolution([c], [], 'TEST-24-LONG', 0, 0), items, cal.config).valid).toBe(true)
  })
  it('commits no pieces when the proposed origin crosses the container boundary', () => {
    const c = createEmptyContainer(0, cal.config, items), result = placeTwentyFourLongFrameMacro(c, items, { x: 5005, y: 0, z: 0 })
    expect(result.accepted).toBe(false)
    expect(c.items).toHaveLength(0)
  })
})
