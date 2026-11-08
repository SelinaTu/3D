// #created 11/08/2026
import type { CargoItem, Container, PlacedItem } from '../../types/packing'
import type { RouteProblem } from './model'
import { findPlacementPoints, orientationsFor, canPlaceAt, updateContainer, volume } from '../packing-utils'
import { validateSolution } from '../validation'
import { createPackingSolution } from '../solution-builder'
import { doorAxis,dimensionAxis,isMax,doorDepth,doorLabel } from './doors'
import { accessIssue } from './access'

/** Expected inventory before a stop, independent of whether a previous solve succeeded. */
export function inventoryBefore(problem:RouteProblem,index:number):CargoItem[] {
  const items=new Map(problem.initial.items.map(p=>[p.item.id,p.item]))
  for(const stop of problem.stops.slice(0,index)) {
    stop.unloadIds.forEach(id=>items.delete(id));stop.pickup.forEach(item=>items.set(item.id,item))
  }
  return [...items.values()]
}

/** A conservative departure candidate: later deliveries in deeper longitudinal bands.
 * Keep the complete original layout if zoning would require another truck or violate rules.
 */
export function planDeparture(problem:RouteProblem,until:number):{container:Container;changedItems:number;note:string} {
  const source=problem.initial,truck:Container={...structuredClone(source),items:[]}
  const face=problem.vehicle?.doors[0] ?? problem.door,bandFace=face==='z-max'?'x-max':face,axis=doorAxis(bandFace),dim=dimensionAxis(bandFace)
  const baselineValid=!source.items.length || validateSolution(createPackingSolution([source],[],'ROUTE-BASE',0,0),source.items.map(p=>p.item)).valid
  const stopOf=(p:PlacedItem)=>p.item.unloadStop ?? problem.stops.length+1
  const groups=[...new Set(source.items.map(stopOf))].sort((a,b)=>b-a)
  let edge=isMax(bandFace)?0:truck.dimensions[dim],failed=false
  for(const stop of groups) {
    const units=source.items.filter(p=>stopOf(p)===stop).sort((a,b)=>volume(b.actualDimensions)-volume(a.actualDimensions))
    for(const old of units) {
      if(Date.now()>=until){failed=true;break}
      const points=findPlacementPoints(truck),gap=truck.loadingRules?.clearanceMm ?? 0
      let placed:PlacedItem | undefined
      for(const v of orientationsFor(old.item)) {
        const boundary=isMax(bandFace)?edge:edge-v.dimensions[dim]
        const extra=points.flatMap(p=>[{...p,[axis]:boundary},...truck.items.map(o=>({...p,[axis]:o.position[axis]-v.dimensions[dim]-gap}))])
        const candidates=[...points,...extra].filter(p=>isMax(bandFace)?p[axis]>=edge-1e-6:p[axis]+v.dimensions[dim]<=edge+1e-6)
          .sort((a,b)=>(isMax(bandFace)?a[axis]-b[axis]:b[axis]-a[axis]) || a.z-b.z || a.y-b.y)
        for(const p of candidates) {
          if(Date.now()>=until)break
          if(truck.handlingAccess?.mode!=='mechanical' && truck.handlingAccess && p.z>truck.handlingAccess.maxReachHeightMm)continue
          if(canPlaceAt(old.item,p,v.orientation,v.rotation,truck)) {placed={item:old.item,position:{...p},orientation:v.orientation,rotation:v.rotation,actualDimensions:v.dimensions};break}
        }
        if(placed)break
      }
      if(!placed){failed=true;break}
      truck.items.push(placed);updateContainer(truck)
    }
    if(failed)break
    const gap=truck.loadingRules?.clearanceMm ?? 0
    edge=isMax(bandFace)?Math.max(...truck.items.map(p=>p.position[axis]+p.actualDimensions[dim]))+gap:Math.min(...truck.items.map(p=>p.position[axis]))-gap
  }
  const keep=(note:string)=>{if(!baselineValid)throw new Error(`所选车型本轮未找到起点 ${source.items.length} 件的完整装载方案；货物未删除。请调大货舱、增加计算时间，或回装配拆分车辆。${note}`);return {container:source,changedItems:0,note}}
  if(failed || truck.items.length!==source.items.length)return keep('按站分区候选未能在同一货舱完整装载；保留原方案和全部货物，继续计算实际倒货及不可达原因。')
  if(!truck.items.length)return keep('起点为空车，按各站需求装入。')
  // Compact the zoned arrangement against the door, not the nose of an almost empty truck.
  const shift=isMax(bandFace)?truck.dimensions[dim]-Math.max(...truck.items.map(p=>p.position[axis]+p.actualDimensions[dim])):-Math.min(...truck.items.map(p=>p.position[axis]))
  truck.items.forEach(p=>p.position[axis]+=shift);updateContainer(truck)
  const validation=validateSolution(createPackingSolution([truck],[],'ROUTE-DEPARTURE',0,0),source.items.map(p=>p.item))
  if(!validation.valid)return keep('按站分区候选未通过原始约束校验，保留原方案。')
  const score=(c:Container)=>c.items.reduce((sum,p)=>{
    const stop=stopOf(p),depth=doorDepth(c,p,face)
    return sum+(accessIssue(c,p,face)?c.dimensions.length:0)/stop+depth/stop
  },0)
  if(baselineValid && score(truck)>score(source)+1e-6)return keep('原布局的靠门与可达评分更好，保留原布局。')
  const changedItems=truck.items.filter(p=>{const old=source.items.find(o=>o.item.id===p.item.id)!;return JSON.stringify([p.position,p.orientation,p.rotation])!==JSON.stringify([old.position,old.orientation,old.rotation])}).length
  return {container:truck,changedItems,note:`出发前调整 ${changedItems} 件：${face==='z-max'?'顶部逐层吊装校核':`晚卸靠深处、早卸水平靠${doorLabel[face]}`}；不增加车辆、不丢弃货物。`}
}
