// #created 11/08/2026
import type { Container } from '../../types/packing'
import type { Simulation, StopResult } from './model'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, updateContainer } from '../packing-utils'
import { pathClear,doorsFor } from './doors'
import { accessIssue } from './access'
import { pairGeometryErrors } from '../solid-geometry'

export function replayStation(before: Container, stop: StopResult, steps: number): Container {
  const truck={...before,items:[...before.items]}
  for(const op of stop.operations.slice(0,steps)) {
    truck.items=truck.items.filter(p=>p.item.id!==op.itemId)
    if(op.action==='pickup' || op.action==='return') truck.items=[...truck.items,op.placement]
  }
  updateContainer(truck); return truck
}

/** Verify inventory, every operation prefix, path, support and final snapshots independently. */
export function auditSimulation(result: Simulation): string[] {
  const errors:string[]=[], truck=structuredClone(result.initial), failedOrigin=new Set<string>()
  if(result.problem?.handling && JSON.stringify(result.problem.handling)!==JSON.stringify(result.initial.handlingAccess)) errors.push('执行记录的作业方式与输入计划不一致')
  if(result.problem?.vehicle && JSON.stringify(result.problem.vehicle.doors)!==JSON.stringify(result.initial.routeDoors))errors.push('执行记录使用的装卸面与车型不一致')
  if(result.problem && JSON.stringify(result.problem.initial.items.map(p=>p.item.id).sort())!==JSON.stringify(result.initial.items.map(p=>p.item.id).sort()))errors.push('出发前重排货物不守恒')
  const known=new Map([...result.initial.items.map(p=>p.item),...result.stops.flatMap(s=>s.plannedPickup)].map(i=>[i.id,i]))
  if(known.size!==result.initial.items.length+result.stops.reduce((n,s)=>n+s.plannedPickup.length,0)) errors.push('货物 ID 重复')
  for(const [station,stop] of result.stops.entries()) {
    const aboard=new Set(truck.items.map(p=>p.item.id)), buffer=new Set<string>()
    if(stop.plannedUnload.some(id=>!aboard.has(id))) errors.push(`站 ${station+1} 下发了不存在的卸货任务`)
    if(stop.cancelledDelivery.some(id=>aboard.has(id) || stop.plannedUnload.includes(id) || !failedOrigin.has(id))) errors.push('上游未提货与在车清单矛盾')
    for(const op of stop.operations) {
      if(JSON.stringify(known.get(op.itemId))!==JSON.stringify(op.placement.item)) errors.push(`${op.itemId} 参数被操作记录改写`)
      const d=calculateActualDimensions(op.placement.item.dimensions,op.placement.orientation,op.placement.rotation,op.placement.item.orientationVerticalAxes)
      if((['length','width','height'] as const).some(k=>Math.abs(d[k]-op.placement.actualDimensions[k])>1e-6)) errors.push(`${op.itemId} 实占尺寸与原始规格和方向不一致`)
      const existing=truck.items.find(p=>p.item.id===op.itemId)
      if(op.action==='unload' || op.action==='temporary-out') {
        if(!existing || JSON.stringify(existing)!==JSON.stringify(op.placement)) {errors.push(`${op.itemId} 取出位置或货物不存在`); continue}
        if(op.action==='unload' && !stop.plannedUnload.includes(op.itemId)) errors.push(`${op.itemId} 未安排本站交付`)
        const face=op.door ?? result.door
        if(!doorsFor(truck,result.door).includes(face))errors.push(`${op.itemId} 使用未开放的装卸面`)
        if(!pathClear(existing,truck.items,face))errors.push(`${op.itemId} 直线取出路径受阻`)
        const access=accessIssue(truck,existing,face);if(access)errors.push(`${op.itemId} 人员不可达：${access}`)
        truck.items=truck.items.filter(p=>p.item.id!==op.itemId)
        if(op.action==='temporary-out') buffer.add(op.itemId)
      } else {
        if(existing || !canPlaceAt(op.placement.item,op.placement.position,op.placement.orientation,op.placement.rotation,truck)) errors.push(`${op.itemId} 装入位置不合法`)
        if(op.action==='return' && !buffer.delete(op.itemId)) errors.push(`${op.itemId} 未临时移出却执行放回`)
        if(op.action==='pickup' && !stop.plannedPickup.some(i=>i.id===op.itemId)) errors.push(`${op.itemId} 未安排本站提货`)
        const face=op.door ?? result.door
        if(!doorsFor(truck,result.door).includes(face))errors.push(`${op.itemId} 使用未开放的装卸面`)
        if(!pathClear(op.placement,truck.items,face))errors.push(`${op.itemId} 直线装入路径受阻`)
        const access=accessIssue({...truck,items:[...truck.items,op.placement]},op.placement,face);if(access)errors.push(`${op.itemId} 装入后人员不可达：${access}`)
        truck.items=[...truck.items,op.placement]
      }
      updateContainer(truck)
      if(analyzeStacking(truck.items,truck.loadingRules).errors.length) errors.push(`${op.itemId} 操作后承托失效`)
    }
    if(buffer.size) errors.push('临时移出货物未全部放回')
    for(let i=0;i<truck.items.length;i++) for(let j=i+1;j<truck.items.length;j++) if(pairGeometryErrors(truck.items[i],truck.items[j],truck).length) errors.push('站点快照碰撞或间距失效')
    const stable=(c:Container)=>JSON.stringify([...c.items].sort((a,b)=>a.item.id.localeCompare(b.item.id)))
    if(stable(truck)!==stable(stop.after)) errors.push('操作重放与站点快照不一致')
    if(stop.plannedUnload.length!==stop.unloaded.length+stop.blockedUnload.length || stop.scheduledUnload.length!==stop.plannedUnload.length+stop.cancelledDelivery.length) errors.push('卸货数量不守恒')
    if(stop.plannedPickup.length!==stop.loaded.length+stop.failedPickup.length) errors.push('提货数量不守恒')
    stop.failedPickup.forEach(i=>failedOrigin.add(i.id))
  }
  return [...new Set(errors)]
}
