// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { simulateThreeStops,simulateFeasibleThreeStops } from './multistop-simulation'
import { auditSimulation,replayStation } from './simulation-audit'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { DEFAULT_CONFIG } from '../core/optimizer'
import { analyzeStacking, canPlaceAt, updateContainer } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import type { CargoItem } from '../types/packing'

const cargo = (id: string): CargoItem => ({ id, name: id, category: '箱', dimensions: { length: 10, width: 10, height: 10 }, weight: 1, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: false, canOffsetStack: false, hasGlass: false, colorTag: '', rawData: {} })
function truck() {
  const c = createEmptyContainer(0, { ...DEFAULT_CONFIG, containerDimensions: { length: 80, width: 10, height: 10 } })
  c.items = Array.from({ length: 5 },(_,i) => ({ item: cargo(`box-${i}`), position: { x: i*10, y: 0, z: 0 }, orientation: 'standing' as const, rotation: 0, actualDimensions: { length: 10, width: 10, height: 10 } }))
  updateContainer(c); return c
}
describe('三站动态装卸', () => {
  it('上一站未装上的货只列未完成交付，绝不生成不存在的卸货操作',()=>{
    const impossible={...cargo('oversized'),dimensions:{length:1000,width:1000,height:1000}}
    const result=simulateThreeStops(truck(),42,'x-max',()=>{},[
      {name:'A',unloadIds:[],pickup:[impossible]},
      {name:'B',unloadIds:['oversized'],pickup:[]},
      {name:'C',unloadIds:[],pickup:[]},
    ])
    expect(result.stops[0].failedPickup.map(i=>i.id)).toEqual(['oversized'])
    expect(result.stops[1].cancelledDelivery).toEqual(['oversized'])
    expect(result.stops[1].plannedUnload).toEqual([])
    expect(result.stops.flatMap(s=>s.operations).some(o=>o.itemId==='oversized')).toBe(false)
    expect(result.audit?.valid).toBe(true)
  })
  it('拒绝题目中凭空出现或重复交付的货物',()=>{
    expect(()=>simulateThreeStops(truck(),42,'x-max',()=>{},[{name:'A',unloadIds:['ghost'],pickup:[]},{name:'B',unloadIds:[],pickup:[]},{name:'C',unloadIds:[],pickup:[]}])).toThrow('不存在')
  })
  it('可行任务完成三站，逐步快照和完整记录可重放，篡改记录会被拒绝',()=>{
    for(const door of ['x-min','x-max'] as const) for(const seed of [0,42,20261030]) {
      const result=simulateFeasibleThreeStops(truck(),seed,door)
      expect(result.stops.every(s=>!s.blockedUnload.length && !s.failedPickup.length && !s.cancelledDelivery.length)).toBe(true)
      expect(auditSimulation(result)).toEqual([])
      expect(replayStation(result.initial,result.stops[0],result.stops[0].operations.length).items.map(p=>p.item.id).sort()).toEqual(result.stops[0].after.items.map(p=>p.item.id).sort())
      const corrupted=structuredClone(result);corrupted.stops[0].operations[0].itemId='ghost'
      expect(auditSimulation(corrupted).length).toBeGreaterThan(0)
    }
  })
  it('每站逐件记账，不移动留车货物，新增货的目的站延续到下一站', () => {
    const source = truck(), result = simulateThreeStops(source, 42)
    expect(result.stops).toHaveLength(3)
    let before = source
    for (const [index, stop] of result.stops.entries()) {
      expect(stop.after.items.length).toBe(before.items.length - stop.unloaded.length + stop.loaded.length)
      expect(stop.plannedUnload.length).toBe(stop.unloaded.length + stop.blockedUnload.length)
      expect(stop.plannedPickup.length).toBe(stop.loaded.length + stop.failedPickup.length)
      for (const old of before.items.filter(p => !stop.unloaded.some(u => u.item.id === p.item.id) && !stop.rehandled.some(m=>m.before.item.id === p.item.id))) expect(stop.after.items.find(p => p.item.id === old.item.id)?.position).toEqual(old.position)
      for (const moved of stop.rehandled) expect(stop.after.items.some(p => p.item.id === moved.after.item.id)).toBe(true)
      const replay = structuredClone(before)
      for (const step of stop.operations) {
        if (step.action === 'unload' || step.action === 'temporary-out') {
          expect(replay.items.find(p=>p.item.id === step.itemId)?.position).toEqual(step.placement.position)
          replay.items = replay.items.filter(p=>p.item.id !== step.itemId)
        } else {
          expect(replay.items.some(p=>p.item.id === step.itemId)).toBe(false)
          expect(canPlaceAt(step.placement.item,step.placement.position,step.placement.orientation,step.placement.rotation,replay)).toBe(true)
          replay.items.push(step.placement)
        }
        updateContainer(replay)
        expect(analyzeStacking(replay.items,replay.loadingRules).errors).toEqual([])
      }
      expect(replay.items.map(p=>[p.item.id,p.position]).sort()).toEqual(stop.after.items.map(p=>[p.item.id,p.position]).sort())
      for (const added of stop.loaded) expect(added.item.rawData._simulationDestination).toBe(index + 2)
      expect(analyzeStacking(stop.after.items, stop.after.loadingRules).errors).toEqual([])
      for (let a = 0; a < stop.after.items.length; a++) for (let b = a + 1; b < stop.after.items.length; b++) expect(pairGeometryErrors(stop.after.items[a],stop.after.items[b],stop.after)).toEqual([])
      before = stop.after
    }
    expect(result.stops[0].unloaded.length).toBeGreaterThan(0)
    expect(result.stops[0].loaded.length).toBeGreaterThan(0)
    expect(result.stops[1].plannedUnload.some(id => id.startsWith('simulation-42-1-'))).toBe(true)
    expect(source.items).toHaveLength(5)
  })
  it('任务先固定生成，执行过程无法卸出时保留受阻结果', () => {
    const source = truck()
    source.dimensions.length = 200
    source.items = Array.from({ length: 15 },(_,i) => ({ item: cargo(`deep-${i}`), position: { x: i*10, y: 0, z: 0 }, orientation: 'standing' as const, rotation: 0, actualDimensions: { length: 10, width: 10, height: 10 } }))
    updateContainer(source)
    const first = simulateThreeStops(source,42), second = simulateThreeStops(source,42)
    expect(first.stops.map(s => s.plannedPickup.map(i => i.id))).toEqual(second.stops.map(s => s.plannedPickup.map(i => i.id)))
    expect(first.stops.every(s=>s.scheduledUnload.length === s.plannedUnload.length + s.cancelledDelivery.length)).toBe(true)
    for (const stop of first.stops) for (const id of stop.blockedUnload) expect(stop.after.items.some(p=>p.item.id === id)).toBe(true)
    for (const stop of first.stops) expect(stop.plannedUnload.some(id=>stop.cancelledDelivery.includes(id))).toBe(false)
  })
  it('针对深处目标可倒货超过四件，且所有临时移出的货都被放回', () => {
    const source = truck(); source.dimensions.length = 200
    source.items = Array.from({ length: 15 },(_,i) => ({ item: cargo(`deep-${i}`), position: { x: i*10, y: 0, z: 0 }, orientation: 'standing' as const, rotation: 0, actualDimensions: { length: 10, width: 10, height: 10 } }))
    updateContainer(source)
    const stop = simulateThreeStops(source,0).stops[0]
    expect(stop.unloaded.length).toBeGreaterThan(0)
    expect(stop.rehandled.length).toBeGreaterThan(4)
    for (const move of stop.rehandled) expect(stop.after.items.some(p=>p.item.id === move.before.item.id)).toBe(true)
    expect(analyzeStacking(stop.after.items,stop.after.loadingRules).errors).toEqual([])
  })
})
