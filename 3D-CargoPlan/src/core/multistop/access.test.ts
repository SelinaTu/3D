// #created 11/08/2026
import { describe,it,expect } from 'vitest'
import type { CargoItem,Container,PlacedItem } from '../../types/packing'
import { createEmptyContainer } from '../greedy-algorithm'
import { DEFAULT_CONFIG } from '../optimizer'
import { updateContainer } from '../packing-utils'
import { DEFAULT_HANDLING,accessIssue } from './access'
import { canRemove,pathClear,solveRoute } from './engine'
import { auditSimulation } from './replay'
import { parseRouteProblem } from './problem'
import { inventoryBefore } from './planning'
import type { RouteProblem } from './model'
function placed(id:string,x:number,y:number,z:number,l:number,w:number,h:number):PlacedItem {
  const item:CargoItem={id,name:id,category:'箱',dimensions:{length:l,width:w,height:h},weight:10,quantity:1,allowedOrientations:['standing'],constraints:{horizontalRotations:[0]},canStackOnTop:true,canOffsetStack:false,hasGlass:false,colorTag:'',rawData:{}}
  return {item,position:{x,y,z},actualDimensions:{...item.dimensions},orientation:'standing',rotation:0}
}
function truck(items:PlacedItem[]):Container {
  const c=createEmptyContainer(0,{...DEFAULT_CONFIG,containerDimensions:{length:6000,width:2400,height:2400}})
  c.items=items;c.handlingAccess={...DEFAULT_HANDLING};updateContainer(c);return c
}
describe('人员可达性与靠门规划',()=>{
  it('库存原数组追加地面障碍后，不能沿用旧的人员通道缓存',()=>{
    const target=placed('target',0,0,800,800,800,500),c=truck([placed('base',0,0,0,1000,2400,800),target])
    expect(accessIssue(c,target,'x-max')).toBeUndefined()
    c.items.push(placed('new-wall',2000,0,0,800,2400,700))
    expect(accessIssue(c,target,'x-max')).toContain('工人不可达')
  })
  it('货物上方抽取线无阻挡，地面的矮货墙仍阻止工人深入',()=>{
    const target=placed('target',0,0,800,800,800,500)
    const c=truck([placed('support',0,0,0,1000,2400,800),target,placed('wall',2000,0,0,800,2400,700)])
    expect(pathClear(target,c.items,'x-max')).toBe(true)
    expect(accessIssue(c,target,'x-max')).toContain('工人不可达')
    expect(canRemove(c,target,'x-max')).toBe(false)
    c.handlingAccess={...DEFAULT_HANDLING,mode:'mechanical'}
    expect(canRemove(c,target,'x-max')).toBe(true)
  })
  it('400 mm 狭缝不可通行；800 mm 连通走道允许工人到达并越过较低承托面取货',()=>{
    const target=placed('target',0,0,800,800,800,500),support=placed('base',0,0,0,1000,2400,800)
    expect(accessIssue(truck([support,target,placed('wall',2000,0,0,800,2000,700)]),target,'x-max')).toContain('工人不可达')
    expect(accessIssue(truck([support,target,placed('wall',2000,0,0,800,1600,700)]),target,'x-max')).toBeUndefined()
  })
  for(const door of ['x-min','x-max'] as const) it(`${door} 门外模式拒绝远处货物，而工人可沿空地走近`,()=>{
    const target=placed('far',2500,0,0,600,800,500),c=truck([target])
    c.handlingAccess={...DEFAULT_HANDLING,mode:'door-only'}
    expect(accessIssue(c,target,door)).toContain('超过门外取货距离')
    c.handlingAccess={...DEFAULT_HANDLING}
    expect(accessIssue(c,target,door)).toBeUndefined()
  })
  it('不能在低净高通道中穿过，不能取超出设定触及高度的货物',()=>{
    const target=placed('far',0,0,0,600,2400,500),c=truck([target]);c.dimensions.height=1500
    expect(accessIssue(c,target,'x-max')).toContain('工人不可达')
    expect(accessIssue(truck([target]),placed('high',0,0,2200,600,800,100),'x-max')).toContain('触及高度')
  })
  for(const door of ['x-min','x-max'] as const) it(`${door} 重新布置起点，早卸货物水平靠门且不增加车辆或丢货`,()=>{
    const c=truck([placed('early',door==='x-max'?0:5400,0,0,600,1000,500),placed('late',door==='x-max'?600:4800,0,0,600,1000,500)])
    const p:RouteProblem={schema:'cargoplan.route-problem/v1',seed:0,door,initial:c,handling:{...DEFAULT_HANDLING,mode:'door-only'},stops:[{name:'先卸',unloadIds:['early'],pickup:[]},{name:'后卸',unloadIds:['late'],pickup:[]}]}
    const r=solveRoute(p,()=>{},{repackInitial:true})
    expect(r.initialPlanning!.changedItems).toBeGreaterThan(0)
    const early=r.initial.items.find(p=>p.item.id==='early')!,late=r.initial.items.find(p=>p.item.id==='late')!
    expect(door==='x-max'?early.position.x>late.position.x:early.position.x<late.position.x).toBe(true)
    expect(r.stops.every(s=>!s.blockedUnload.length)).toBe(true)
    expect(r.initial.items).toHaveLength(2);expect(r.audit?.valid).toBe(true)
    expect(p.initial.items[0].position.x).toBe(door==='x-max'?0:5400)
  })
  it('独立重放会拒绝将机械抽取冒充人员可执行的记录',()=>{
    const c=truck([placed('far',0,0,0,600,2400,500)])
    const r=solveRoute({schema:'cargoplan.route-problem/v1',seed:0,door:'x-max',initial:c,handling:{...DEFAULT_HANDLING,mode:'mechanical'},stops:[{name:'卸货',unloadIds:['far'],pickup:[]}]})
    r.initial.handlingAccess={...DEFAULT_HANDLING,mode:'door-only'}
    expect(auditSimulation(r).some(s=>s.includes('人员不可达'))).toBe(true)
  })
  it('手工计划支持空车多站取送、库存守恒，未来货物不能提前卸',()=>{
    const c=truck([]),a=placed('a',0,0,0,600,1000,500).item,b=placed('b',0,0,0,600,1000,500).item
    const p:RouteProblem={schema:'cargoplan.route-problem/v1',seed:0,door:'x-max',initial:c,handling:{...DEFAULT_HANDLING},stops:[{name:'提货',unloadIds:[],pickup:[a,b]},{name:'交付 A',unloadIds:['a'],pickup:[]},{name:'交付 B',unloadIds:['b'],pickup:[]}]}
    expect(inventoryBefore(p,1).map(i=>i.id)).toEqual(['a','b'])
    expect(inventoryBefore(p,2).map(i=>i.id)).toEqual(['b'])
    const r=solveRoute(p)
    expect(r.stops.map(s=>s.after.items.length)).toEqual([2,1,0])
    expect(r.stops.every(s=>!s.blockedUnload.length && !s.failedPickup.length)).toBe(true)
    expect(auditSimulation(r)).toEqual([])
    p.stops[0].unloadIds=['a'];expect(()=>parseRouteProblem(p)).toThrow('尚未提货')
  })
  it('人员参数不能通过导入 JSON 绕过校验',()=>{
    const p:RouteProblem={schema:'cargoplan.route-problem/v1',seed:0,door:'x-max',initial:truck([]),handling:{...DEFAULT_HANDLING,reachMm:NaN},stops:[{name:'站点',unloadIds:[],pickup:[]}]}
    expect(()=>parseRouteProblem(p)).toThrow('作业参数')
  })
})
