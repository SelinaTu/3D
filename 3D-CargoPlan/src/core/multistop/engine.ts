// #created 11/08/2026
import type { CargoItem,Container,PlacedItem } from '../../types/packing'
import { analyzeStacking,canPlaceAt,findPlacementPoints,orientationsFor,updateContainer,mixingPermitted,maxPlacementHeight } from '../packing-utils'
import type { Door,StopResult,RouteProblem,Simulation,SolveOptions } from './model'
import { auditSimulation } from './replay'
import { parseRouteProblem } from './problem'
import { accessIssue } from './access'
import { planDeparture } from './planning'
import { pairGeometryErrors } from '../solid-geometry'
import { doorsFor,pathClear,doorAxis,dimensionAxis,isMax,doorDepth,doorLabel } from './doors'
export {pathClear} from './doors'
type Operation=StopResult['operations'][number]
type Move=StopResult['rehandled'][number]
export function accessDoor(c:Container,p:PlacedItem,fallback:Door):Door|undefined {
  return doorsFor(c,fallback).find(d=>pathClear(p,c.items,d) && !accessIssue(c,p,d))
}
export function canRemove(c:Container,p:PlacedItem,door:Door):boolean {
  return accessDoor(c,p,door)!==undefined && analyzeStacking(c.items.filter(o=>o.item.id!==p.item.id),c.loadingRules).errors.length===0
}
function insertable(c:Container,p:PlacedItem,door:Door):boolean {
  return canPlaceAt(p.item,p.position,p.orientation,p.rotation,c) && accessDoor({...c,items:[...c.items,p]},p,door)!==undefined
}
function op(c:Container,p:PlacedItem,action:Operation['action'],fallback:Door):Operation {
  const door=accessDoor(c,p,fallback)
  if(!door)throw new Error(`${p.item.name} 没有可执行的装卸方向`)
  return {action,itemId:p.item.id,name:p.item.name,placement:p,door}
}
const removalOrder=(c:Container,door:Door)=>(a:PlacedItem,b:PlacedItem)=>Math.min(...doorsFor(c,door).map(d=>doorDepth(c,a,d)))-Math.min(...doorsFor(c,door).map(d=>doorDepth(c,b,d))) || b.position.z-a.position.z
function findInsertion(c:Container,item:CargoItem,door:Door,until:number,reserved:PlacedItem[]=[],nearOverride?:boolean):PlacedItem|null {
  const deadline=Math.min(Date.now()+2000,until),points=findPlacementPoints(c),gap=c.loadingRules?.clearanceMm ?? 0
  const near=nearOverride ?? !c.items.some(p=>(p.item.unloadStop ?? Infinity)<(item.unloadStop ?? Infinity))
  for(const face of doorsFor(c,door))for(const v of orientationsFor(item)) {
    if(Date.now()>=deadline)return null
    const axis=doorAxis(face),dim=dimensionAxis(face)
    const extra=points.flatMap(p=>[
      {...p,[axis]:isMax(face)?c.dimensions[dim]-v.dimensions[dim]:0},
      ...[...c.items,...reserved].flatMap(o=>[0,gap].map(g=>({...p,[axis]:isMax(face)?o.position[axis]-v.dimensions[dim]-g:o.position[axis]+o.actualDimensions[dim]+g})))
    ])
    const seen=new Set<string>()
    const candidates=[...points,...extra].filter(p=>{const key=`${p.x}/${p.y}/${p.z}`;if(seen.has(key) || p[axis]<0 || p[axis]+v.dimensions[dim]>c.dimensions[dim])return false;seen.add(key);return true})
      .sort((a,b)=>a.z-b.z || (near?1:-1)*(isMax(face)?b[axis]-a[axis]:a[axis]-b[axis]) || a.y-b.y)
    for(const position of candidates) {
      if(Date.now()>=deadline)return null
      const candidate:PlacedItem={item,position:{...position},orientation:v.orientation,rotation:v.rotation,actualDimensions:v.dimensions}
      if(!reserved.some(p=>pairGeometryErrors(candidate,p,c).length) && insertable(c,candidate,door))return candidate
    }
  }
  return null
}
/** A transaction records each chosen face before removing cargo; no inferred directions later. */
function unloadTogether(c:Container,targets:PlacedItem[],door:Door,deadline:number):{unloaded:PlacedItem[];moves:Move[];operations:Operation[]}|null {
  const original=[...c.items],pending=new Set(targets.map(p=>p.item.id)),removed:{piece:PlacedItem;door:Door}[]=[],unloaded:PlacedItem[]=[],operations:Operation[]=[]
  const rollback=()=>{c.items=original;updateContainer(c);return null}
  while(pending.size && Date.now()<deadline) {
    const ordered=[...c.items].sort((a,b)=>Number(!pending.has(a.item.id))-Number(!pending.has(b.item.id)) || removalOrder(c,door)(a,b))
    const next=ordered.find(p=>canRemove(c,p,door));if(!next)return rollback()
    const due=pending.has(next.item.id),operation=op(c,next,due?'unload':'temporary-out',door)
    c.items=c.items.filter(p=>p.item.id!==next.item.id);updateContainer(c);operations.push(operation)
    if(pending.delete(next.item.id))unloaded.push(next);else removed.push({piece:next,door:operation.door!})
  }
  if(pending.size)return rollback()
  const moves:Move[]=[]
  for(const {piece:old,door:outDoor} of removed.reverse()) {
    const placed=insertable(c,old,door)?old:findInsertion(c,old.item,door,deadline)
    if(!placed)return rollback()
    c.items=[...c.items,placed];updateContainer(c)
    const operation=op(c,placed,'return',door);operations.push(operation);moves.push({before:old,after:placed,outDoor,returnDoor:operation.door})
  }
  return {unloaded,moves,operations}
}
function pickupWithRehandling(c:Container,item:CargoItem,door:Door,until:number):{placement:PlacedItem;moves:Move[];operations:Operation[]}|null {
  const initial=[...c.items],removed:{piece:PlacedItem;door:Door}[]=[],out:Operation[]=[],deadline=Math.min(Date.now()+4000,until)
  const rollback=()=>{c.items=initial;updateContainer(c);return null}
  while(removed.length<12 && Date.now()<deadline) {
    const next=[...c.items].sort(removalOrder(c,door)).find(p=>canRemove(c,p,door));if(!next)return rollback()
    const extraction=op(c,next,'temporary-out',door);out.push(extraction);removed.push({piece:next,door:extraction.door!})
    c.items=c.items.filter(p=>p.item.id!==next.item.id);updateContainer(c)
    const placement=findInsertion(c,item,door,deadline,removed.map(r=>r.piece)) ?? findInsertion(c,item,door,deadline)
    if(!placement)continue
    const before=[...c.items];c.items=[...c.items,placement];updateContainer(c)
    const operations=[...out,op(c,placement,'pickup',door)],moves:Move[]=[]
    for(const {piece:old,door:outDoor} of [...removed].reverse()) {
      const restored=insertable(c,old,door)?old:findInsertion(c,old.item,door,deadline)
      if(!restored)break
      c.items=[...c.items,restored];updateContainer(c);const operation=op(c,restored,'return',door);operations.push(operation);moves.push({before:old,after:restored,outDoor,returnDoor:operation.door})
    }
    if(moves.length===removed.length)return {placement,moves,operations}
    c.items=before;updateContainer(c)
  }
  return rollback()
}
export function solveRoute(input:RouteProblem,onProgress:(stage:string)=>void=()=>{},options:SolveOptions={}):Simulation {
  onProgress('正在校验计划与起点装载')
  const problem=parseRouteProblem(input),{door,seed,stops:tasks}=problem,perStop=options.perStopTimeLimitMs ?? 8000
  if(!Number.isFinite(perStop) || perStop<1 || perStop>120000)throw new Error('每站搜索时限应在 1–120000 ms 之间')
  let source=structuredClone(problem.initial),geometryChanged=false
  if(problem.vehicle) {
    const v=problem.vehicle,changed=(['length','width','height'] as const).some(k=>source.dimensions[k]!==v.dimensions[k]) || source.maxWeight!==v.maxWeight
    geometryChanged=changed
    source={...source,dimensions:{...v.dimensions},maxWeight:v.maxWeight,routeDoors:[...v.doors]}
    if(changed && source.loadingRules)source.loadingRules.heightExceptions={}
  }
  if(options.repackInitial || geometryChanged)onProgress('正在按站序检查出发前摆放')
  const departure=options.repackInitial || geometryChanged?planDeparture({...problem,initial:source},Date.now()+Math.min(12000,perStop)):undefined
  const initial=structuredClone(departure?.container ?? source),truck=structuredClone(initial),stops:StopResult[]=[]
  for(let index=0;index<tasks.length;index++) {
    onProgress(`正在计算第 ${index+1} 站 · ${tasks[index].name}`)
    const deadline=Date.now()+perStop,scheduledUnload=tasks[index].unloadIds,aboard=new Map(truck.items.map(p=>[p.item.id,p]))
    const plannedIds=scheduledUnload.filter(id=>aboard.has(id)),cancelledDelivery=scheduledUnload.filter(id=>!aboard.has(id)),pending=plannedIds.map(id=>aboard.get(id)!)
    const unloaded:PlacedItem[]=[],operations:Operation[]=[],rehandled:Move[]=[]
    let progress=true
    while(pending.length && progress && Date.now()<deadline) {
      progress=false
      for(let i=pending.length-1;i>=0 && Date.now()<deadline;i--)if(canRemove(truck,pending[i],door)) {
        const p=pending.splice(i,1)[0];operations.push(op(truck,p,'unload',door));truck.items=truck.items.filter(o=>o.item.id!==p.item.id);updateContainer(truck);unloaded.push(p);progress=true
      }
    }
    if(pending.length) {
      const transaction=unloadTogether(truck,pending,door,Math.min(deadline,Date.now()+3000))
      if(transaction){unloaded.push(...transaction.unloaded);operations.push(...transaction.operations);rehandled.push(...transaction.moves);pending.length=0}
      else for(let i=pending.length-1;i>=0 && Date.now()<deadline;i--) {
        const single=unloadTogether(truck,[pending[i]],door,deadline)
        if(single){unloaded.push(...single.unloaded);operations.push(...single.operations);rehandled.push(...single.moves);pending.splice(i,1)}
      }
    }
    const unloadIssues:Record<string,string>={}
    for(const p of pending)unloadIssues[p.item.id]=doorsFor(truck,door).map(d=>`${doorLabel[d]}：${!pathClear(p,truck.items,d)?'抽取路径被货物挡住':accessIssue(truck,p,d) ?? '移除后承托不满足或本轮倒货未找到完整恢复方案'}`).join('；')+(Date.now()>=deadline?'；达到本站计算时限':'')
    const plannedPickup=[...tasks[index].pickup].sort((a,b)=>(b.unloadStop ?? Infinity)-(a.unloadStop ?? Infinity)),loaded:PlacedItem[]=[],failedPickup:CargoItem[]=[],pickupIssues:Record<string,string>={}
    for(const item of plannedPickup) {
      const preferred=tasks[index].pickupPlacements?.find(p=>p.item.id===item.id)
      const placement=preferred && insertable(truck,preferred,door)?{...preferred,item}:findInsertion(truck,item,door,deadline,[],!plannedPickup.some(p=>(p.unloadStop ?? Infinity)<(item.unloadStop ?? Infinity)))
      if(placement){truck.items=[...truck.items,placement];updateContainer(truck);loaded.push(placement);operations.push(op(truck,placement,'pickup',door));continue}
      const retry=pickupWithRehandling(truck,item,door,deadline)
      if(retry){loaded.push(retry.placement);operations.push(...retry.operations);rehandled.push(...retry.moves);continue}
      failedPickup.push(item)
      const fits=orientationsFor(item).some(v=>v.dimensions.length<=truck.dimensions.length && v.dimensions.width<=truck.dimensions.width && v.dimensions.height<=maxPlacementHeight(item,truck))
      pickupIssues[item.id]=!fits?'允许方向均超出所选货舱净空':truck.totalWeight+item.weight>truck.maxWeight?'超过所选车辆载重':truck.items.some(p=>!mixingPermitted(item,p.item))?'与在车货物混装约束冲突':Date.now()>=deadline?'达到本站计算时限，尚未找到位置':'未找到满足已选装卸面、可达、承托及倒货恢复的位置；不代表一定无解'
    }
    stops.push({name:tasks[index].name,scheduledUnload,plannedUnload:plannedIds,unloaded,blockedUnload:pending.map(p=>p.item.id),cancelledDelivery,plannedPickup,loaded,failedPickup,unloadIssues,pickupIssues,rehandled,operations,after:structuredClone(truck)})
  }
  onProgress('正在逐步重放校验装卸方向、人员可达与库存')
  const result:Simulation={initial,stops,seed,door,problem,method:problem.description,initialPlanning:departure?{changedItems:departure.changedItems,note:departure.note}:undefined}
  const errors=auditSimulation(result)
  if(errors.length)throw new Error(`多站操作校验失败：${errors.slice(0,3).join('；')}`)
  result.audit={valid:true,errors:[]};return result
}
