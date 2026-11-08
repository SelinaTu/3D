// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { loadResearchCalibration } from './research-calibration'
import { createEmptyContainer } from './greedy-algorithm'
import { createPackingSolution } from './solution-builder'
import { validateSolution } from './validation'
import { placeTallLongFrameMacro } from './research-long-frame-macro'
const calibration=loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const long=calibration.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===23).slice(0,22)
const thin=calibration.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===25).slice(0,20)
describe('real-rail long frame macro',()=>{
 it('packs all 42 source units with strict 120 kg bases and independent validation',()=>{
  const items=[...long,...thin],c=createEmptyContainer(0,calibration.config,items),result=placeTallLongFrameMacro(c,long,thin)
  expect(result.accepted).toBe(true);expect(c.items).toHaveLength(42)
  expect(Math.max(...result.baseLoadsKg!)).toBeCloseTo(119.952,6)
  expect(result.baseLoadsKg!.every(w=>w<120)).toBe(true)
  expect(validateSolution(createPackingSolution([c],[],'TEST-REAL-RAIL-MACRO',0,0),items,calibration.config).valid).toBe(true)
  expect(Math.max(...c.items.map(p=>p.position.z+p.actualDimensions.height))).toBe(2495)
 })
 it('does not silently relax legacy 80 percent support',()=>{
  const config={...calibration.config,supportCriterion:'area-80-centroid' as const}
  const c=createEmptyContainer(0,config,long),result=placeTallLongFrameMacro(c,long)
  expect(result.accepted).toBe(false);expect(c.items).toHaveLength(0)
 })
 it('rejects a translated out-of-bounds macro atomically',()=>{
  const c=createEmptyContainer(0,calibration.config,long),result=placeTallLongFrameMacro(c,long,[],{x:5005,y:0,z:0})
  expect(result.accepted).toBe(false);expect(c.items).toHaveLength(0)
 })
})
