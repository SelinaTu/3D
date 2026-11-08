// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { loadResearchCalibration } from './research-calibration'
import { createEmptyContainer } from './greedy-algorithm'
import { calculateActualDimensions, canPlaceAt, updateContainer } from './packing-utils'
import { createPackingSolution } from './solution-builder'
import { validateSolution } from './validation'
import { placeShortFrameCanopyMacro } from './research-short-frame-macro'
const calibration=loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const short=calibration.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===21).slice(0,8)
const doors=calibration.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===20).slice(0,18)
describe('short-frame canopy over doors',()=>{
 it('packs 18 W06 below 8 short frames without placing W01 weight on W06',()=>{
  const items=[...short,...doors],c=createEmptyContainer(0,calibration.config,items)
  for(const [i,item]of doors.entries()){
   const position={x:0,y:i<7?i*115:920+(i-7)*115,z:0}
   expect(canPlaceAt(item,position,'lying',0,c)).toBe(true)
   c.items.push({item,position,orientation:'lying',rotation:0,actualDimensions:calculateActualDimensions(item.dimensions,'lying',0,item.orientationVerticalAxes)});updateContainer(c)
  }
  const result=placeShortFrameCanopyMacro(c,short,{x:0,y:23,z:0})
  expect(result.accepted).toBe(true);expect(result.baseLoadKg).toBe(112);expect(c.items).toHaveLength(26)
  expect(validateSolution(createPackingSolution([c],[],'TEST-SHORT-CANOPY',0,0),items,calibration.config).valid).toBe(true)
  expect(Math.max(...c.items.map(p=>p.position.z+p.actualDimensions.height))).toBe(2479)
 })
 it('also independently validates a 90-degree canopy',()=>{
  const c=createEmptyContainer(0,calibration.config,short),result=placeShortFrameCanopyMacro(c,short,{x:0,y:0,z:0},90)
  expect(result.accepted).toBe(true);expect(result.baseLoadKg).toBe(112)
  expect(validateSolution(createPackingSolution([c],[],'TEST-SHORT-CANOPY-90',0,0),short,calibration.config).valid).toBe(true)
 })
 it('preserves the previous container if any macro item collides or leaves the box',()=>{
  const c=createEmptyContainer(0,calibration.config,short),result=placeShortFrameCanopyMacro(c,short,{x:10000,y:0,z:0})
  expect(result.accepted).toBe(false);expect(c.items).toHaveLength(0)
 })
})
