// #created 11/08/2026
import type { Container,PlacedItem } from '../../types/packing'
import type { Door,StopResult,Simulation,RouteProblem } from './model'
import { canRemove,pathClear } from './engine'
import { canPlaceAt,updateContainer,tryPlaceItem } from '../packing-utils'
import { auditSimulation } from './replay'
export type ScenarioOptions={stopCount:number;seed:number;door:Door;mode:'feasible'|'challenge'|'training'}
function random(seed: number) {
  let n = seed >>> 0
  return () => { n = (Math.imul(n,1664525) + 1013904223) >>> 0; return n / 4294967296 }
}
function shuffled<T>(input: T[], rand: () => number): T[] {
  const a = [...input]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i],a[j]] = [a[j],a[i]] }
  return a
}
function allocateId(base:string,used:Set<string>):string {
  let id=base,n=1
  while(used.has(id))id=`${base}-${n++}`
  used.add(id);return id
}

export function createTrainingContainer(source:Container):Container {
  const catalog=source.items.map(p=>p.item).filter(i=>!i.cavity && !i.constraints?.requiresManualReview?.length && Math.max(...Object.values(i.dimensions))<=1200)
  if(!catalog.length) throw new Error('当前货柜没有可用于练习的小件样本')
  const truck:Container={...structuredClone(source),items:[]}; updateContainer(truck)
  for(let i=0;i<6;i++) {
    const item={...structuredClone(catalog[i%catalog.length]),id:`training-${i+1}`,quantity:1}
    const placement=tryPlaceItem(item,truck)
    if(!placement) throw new Error('当前货舱无法建立六件练习场景，请选择更大的货舱')
    truck.items.push(placement); updateContainer(truck)
  }
  return truck
}

/** Construct a solvable random demonstration without changing the initial truck or any cargo size. */
function constructFeasibleStops(source:Container,seed:number,door:Door,onProgress:(stage:string)=>void,stopCount:number):Simulation {
  const truck=structuredClone(source), initial=structuredClone(source), rand=random(seed), stops:StopResult[]=[]
  const initialIds=new Set(source.items.map(p=>p.item.id)),usedIds=new Set(initialIds),probe=allocateId('route-new-probe',usedIds)
  let previousPickup:PlacedItem[]=[]
  for(let index=1;index<=stopCount;index++) {
    onProgress(`正在构造并求解第 ${index} 站的可行装卸任务`)
    const unloaded:PlacedItem[]=[], operations:StopResult['operations']=[]
    const remove=(p:PlacedItem)=>{
      if(!canRemove(truck,p,door)) throw new Error('可行任务构造失败：前站提货无法沿原路径卸出')
      truck.items=truck.items.filter(o=>o.item.id!==p.item.id); updateContainer(truck)
      unloaded.push(p);operations.push({action:'unload',itemId:p.item.id,name:p.item.name,placement:p})
    }
    for(const p of [...previousPickup].reverse()) remove(p)
    const originals:PlacedItem[]=[]
    for(let n=0;n<2;n++) {
      const candidate=shuffled(truck.items.filter(p=>initialIds.has(p.item.id)),rand).find(p=>{
        if(!canRemove(truck,p,door)) return false
        const remaining={...truck,items:truck.items.filter(o=>o.item.id!==p.item.id)};updateContainer(remaining)
        // A new item must qualify on its own; historical ID-specific W02 exceptions are never inherited.
        return canPlaceAt({...p.item,id:probe,unloadStop:index+1},p.position,p.orientation,p.rotation,remaining)
      })
      if(!candidate) {if(!stops.length && !originals.length) throw new Error('当前起点找不到可直接卸出的原货；请选择随机挑战或其他货柜');break}
      remove(candidate); originals.push(candidate)
    }
    const loaded:PlacedItem[]=[]
    // Fill the released spaces in reverse removal order. Reuse all physical restrictions, not just dimensions.
    for(const [n,p] of [...originals].reverse().entries()) {
      const item={...structuredClone(p.item),id:allocateId(`feasible-${seed}-${index}-${n+1}`,usedIds),quantity:1,unloadStop:index+1,rawData:{...p.item.rawData,_simulationOrigin:index,_simulationDestination:index+1}}
      const placement={...p,item}
      if(!pathClear(placement,truck.items,door) || !canPlaceAt(item,placement.position,placement.orientation,placement.rotation,truck)) throw new Error('原位回填未通过装载约束，不能生成可行任务')
      truck.items.push(placement); updateContainer(truck);loaded.push(placement)
      operations.push({action:'pickup',itemId:item.id,name:item.name,placement})
    }
    const ids=unloaded.map(p=>p.item.id)
    stops.push({name:`模拟站点 ${index}`,scheduledUnload:ids,plannedUnload:ids,unloaded,blockedUnload:[],cancelledDelivery:[],plannedPickup:loaded.map(p=>p.item),loaded,failedPickup:[],unloadIssues:{},pickupIssues:{},rehandled:[],operations,after:structuredClone(truck)})
    previousPickup=loaded
  }
  const result:Simulation={initial,stops,seed,door,method:'可行任务构造法：随机选取可直接卸出的原货，按空槽原位回填同规格新货；完整保留起点装载。该模式用于验证流程，不代表任意任务都可解或全局最优。'}
  const errors=auditSimulation(result)
  if(errors.length) throw new Error(`多站操作校验失败：${errors.slice(0,3).join('；')}`)
  result.audit={valid:true,errors:[]};return result
}


/** A generator creates data only. Every mode is solved by solveRoute, without changing code per question. */
export function generateRouteProblem(source:Container,{stopCount,seed,door,mode}:ScenarioOptions,onProgress:(stage:string)=>void=()=>{}):RouteProblem {
  if(!Number.isSafeInteger(stopCount) || stopCount<1) throw new Error('站点数量必须为正整数')
  if(!source.items.length) throw new Error('当前货柜没有可用于出题的货物；可导入自定义题目从空车开始')
  const initial=mode==='training' ? createTrainingContainer(source) : structuredClone(source)
  let stops:RouteProblem['stops']
  if(mode!=='challenge') {
    const witness=constructFeasibleStops(initial,seed,door,onProgress,stopCount)
    stops=witness.stops.map(s=>({name:s.name,unloadIds:s.scheduledUnload,pickup:s.plannedPickup,pickupPlacements:s.loaded}))
  } else {
    const rand=random(seed), originals=shuffled(initial.items,rand).slice(0,stopCount*2)
    const usedIds=new Set(initial.items.map(p=>p.item.id))
    const catalog=initial.items.map(p=>p.item).filter(i=>!i.cavity && !i.constraints?.requiresManualReview?.length && Math.max(...Object.values(i.dimensions))<=1200)
    if(!catalog.length) throw new Error('没有适合生成随机补货的小件样本，可导入自定义任务')
    stops=Array.from({length:stopCount},(_,n)=>({name:`模拟站点 ${n+1}`,unloadIds:originals.slice(n*2,n*2+2).map(p=>p.item.id),pickup:Array.from({length:2},(_,i)=>{
      const template=catalog[Math.floor(rand()*catalog.length)]
      return {...structuredClone(template),id:allocateId(`simulation-${seed}-${n+1}-${i+1}`,usedIds),quantity:1,unloadStop:n+2,rawData:{...template.rawData,_simulationDestination:n+2,_simulationOrigin:n+1}}
    })}))
    for(let i=1;i<stops.length;i++) stops[i].unloadIds.push(...stops[i-1].pickup.map(p=>p.id))
  }
  return {schema:'cargoplan.route-problem/v1',seed,door,initial,stops,description:mode==='challenge'?'任意随机题：先固定任务，再限时求解；任务可能不可行，搜索不保证完备。':'可行示例：保留起点货物，随机挑选可卸货物并以同规格补货填入空槽，再交给通用引擎求解与独立校验。不能证明任意任务可解或全局最优。'}
}
