// #created 11/08/2026
import {describe,it,expect} from 'vitest'
import type {CargoItem,Container,PlacedItem} from '../../types/packing'
import type {Door,RouteProblem} from './model'
import {solveRoute,canRemove} from './engine'
import {DEFAULT_HANDLING,accessIssue} from './access'
import {pathClear,doorAxis} from './doors'
import {auditSimulation} from './replay'
import {buildPlayback,playbackFrame} from './playback'
import {parseRouteProblem} from './problem'
import {VEHICLES} from './vehicles'
const box=(id:string,x:number,y=0,z=0):PlacedItem=>{
  const item:CargoItem={id,name:id,category:'木箱',dimensions:{length:800,width:800,height:800},weight:100,quantity:1,allowedOrientations:['standing'],constraints:{horizontalRotations:[0]},canStackOnTop:true,canOffsetStack:false,hasGlass:false,colorTag:'',rawData:{}}
  return {item,position:{x,y,z},orientation:'standing',rotation:0,actualDimensions:{...item.dimensions}}
}
function problem(doors:Door[],items=[box('delivery',500),box('later',5000)]):RouteProblem {
  const initial:Container={id:'vehicle',dimensions:{length:6000,width:2400,height:2600},maxWeight:10000,items,totalWeight:items.length*100,volumeUtilization:0,weightUtilization:0}
  return {schema:'cargoplan.route-problem/v1',seed:0,door:doors[0],initial,handling:{...DEFAULT_HANDLING,mode:'mechanical'},vehicle:{id:'test',name:'测试车辆',dimensions:{...initial.dimensions},maxWeight:initial.maxWeight,doors},stops:[{name:'交付',unloadIds:items.length?[items[0].item.id]:[],pickup:[]}]}
}
describe('车型真实影响装卸方向与求解',()=>{
  it('同一货物后门受阻但侧面畅通，侧帘车避免厢车需要的倒货',()=>{
    const rear=problem(['x-max']),side=problem(['y-min','y-max','x-max'])
    expect(pathClear(rear.initial.items[0],rear.initial.items,'x-max')).toBe(false)
    expect(pathClear(side.initial.items[0],side.initial.items,'y-min')).toBe(true)
    const a=solveRoute(rear),b=solveRoute(side)
    expect(a.stops[0].rehandled).toHaveLength(1)
    expect(b.stops[0].rehandled).toHaveLength(0)
    expect(b.stops[0].operations[0].door).toBe('y-min')
    expect(a.audit?.valid && b.audit?.valid).toBe(true)
  })
  it('左侧被挡自动选择开放的右侧，不凭车型标签跳过碰撞',()=>{
    const p=problem(['y-min','y-max'],[box('delivery',500,1200),box('left-wall',500,0)])
    const result=solveRoute(p)
    expect(result.stops[0].operations[0].door).toBe('y-max')
    expect(auditSimulation(result)).toEqual([])
  })
  it('人员侧向可达按真实横向深度检查，设备模式与工人模式分开',()=>{
    const p=box('target',0,0),c=problem(['y-max'],[p]).initial
    c.handlingAccess={...DEFAULT_HANDLING,mode:'door-only'}
    expect(accessIssue(c,p,'y-min')).toBeUndefined()
    expect(accessIssue(c,p,'y-max')).toContain('超过门外取货距离')
    expect(accessIssue(c,p,'z-max')).toContain('设备')
  })
  it('顶部吊装先处理上方货物，移出件可放回才提交事务',()=>{
    const p=problem(['z-max'],[box('lower',1000),box('upper',1000,0,800)])
    p.initial.routeDoors=['z-max'];p.initial.handlingAccess=p.handling
    expect(canRemove(p.initial,p.initial.items[0],'z-max')).toBe(false)
    const r=solveRoute(p)
    expect(r.stops[0].operations.map(o=>o.action)).toEqual(['temporary-out','unload','return'])
    expect(r.stops[0].operations.every(o=>o.door==='z-max')).toBe(true)
    expect(r.stops[0].rehandled[0].after.position.z).toBe(0)
    expect(r.audit?.valid).toBe(true)
  })
  for(const door of ['x-min','x-max','y-min','y-max','z-max'] as Door[])it(`${door} 操作方向进入动画，只有相应坐标发生变化`,()=>{
    const r=solveRoute(problem([door],[box('delivery',2500,1000)]))
    const step=buildPlayback(r).find(s=>s.operation)!,axis=doorAxis(door)
    const middle=playbackFrame(step,.5,r.door).items.find(p=>p.item.id==='delivery')!
    expect(playbackFrame(step,0,r.door)).toEqual(step.before)
    expect(playbackFrame(step,1,r.door)).toEqual(step.after)
    for(const other of ['x','y','z'] as const)if(other!==axis)expect(middle.position[other]).toBe(step.operation!.placement.position[other])
    expect(door.endsWith('max')?middle.position[axis]>step.operation!.placement.position[axis]:middle.position[axis]<step.operation!.placement.position[axis]).toBe(true)
  })
  it('更小车型放不下起点全批时明确拒绝，不丢弃起点货物',()=>{
    const p=problem(['x-max']),snapshot=structuredClone(p)
    p.vehicle!.dimensions={length:500,width:500,height:500}
    expect(()=>solveRoute(p)).toThrow('未找到起点 2 件的完整装载方案')
    expect(p.initial).toEqual(snapshot.initial)
  })
  it('换车型保留任务和原件，求解结果使用新尺寸和载重',()=>{
    const p=problem(['x-max'],[box('delivery',500)])
    p.vehicle!.dimensions={length:4200,width:2100,height:2100};p.vehicle!.maxWeight=2500
    const r=solveRoute(p)
    expect(r.initial.dimensions.length).toBe(4200)
    expect(r.initial.maxWeight).toBe(2500)
    expect(r.initial.items).toHaveLength(1)
    expect(r.stops[0].unloaded).toHaveLength(1)
    expect(p.initial.dimensions.length).toBe(6000)
  })
  it('未开放的顶部不能被篡改成可执行动作',()=>{
    const r=solveRoute(problem(['x-max'],[box('delivery',500)]))
    r.stops[0].operations[0].door='z-max'
    expect(auditSimulation(r)).toContain('delivery 使用未开放的装卸面')
  })
  it('全部车型模板均可校验、无效开口在计算前被拒绝',()=>{
    for(const vehicle of VEHICLES){const p=problem(vehicle.doors,[]);p.vehicle=vehicle;p.stops[0].unloadIds=[];expect(parseRouteProblem(p).vehicle?.id).toBe(vehicle.id)}
    const p=problem(['x-max']);p.vehicle!.doors=[]
    expect(()=>parseRouteProblem(p)).toThrow('车型规格无效')
  })
})
