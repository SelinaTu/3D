// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { loadResearchCalibration } from './research-calibration'
import { createEmptyContainer } from './greedy-algorithm'
import { createPackingSolution } from './solution-builder'
import { validateSolution } from './validation'
import { placeTwentyThreeLongFrameMacro } from './research-23-long-frame-macro'
const cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),long=cal.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===23).slice(0,23),thin=cal.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===25).slice(0,10)
describe('23 long-frame load-balanced macro',()=>{
 it('independently validates all 33 source pieces and strict base loads',()=>{
  const items=[...long,...thin],c=createEmptyContainer(0,cal.config,items),r=placeTwentyThreeLongFrameMacro(c,long,thin)
  expect(r.accepted).toBe(true);expect(c.items).toHaveLength(33);expect(r.baseLoadsKg!.every(w=>w<120)).toBe(true)
  expect(Math.max(...r.baseLoadsKg!)).toBeCloseTo(119.952,6)
  expect(validateSolution(createPackingSolution([c],[],'TEST-23-LONG-MACRO',0,0),items,cal.config).valid).toBe(true)
 })
 it('preserves the previous container when the macro extends past the door',()=>{
  const c=createEmptyContainer(0,cal.config,long),r=placeTwentyThreeLongFrameMacro(c,long,[],{x:5005,y:0,z:0})
  expect(r.accepted).toBe(false);expect(c.items).toHaveLength(0)
 })
})
