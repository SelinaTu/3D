// #created 11/08/2026
import type { CargoItem,Container } from '../../types/packing'
import { validateRequest } from '../input-validation'
import { updateContainer } from '../packing-utils'
import { validateSolution } from '../validation'
import { createPackingSolution } from '../solution-builder'
import { validateHandling } from './access'
import { DOORS } from './doors'
import { validateVehicle } from './vehicles'
import type { RouteProblem } from './model'

const record=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v)
export function parseRouteProblem(value:unknown):RouteProblem {
  if(!record(value) || value.schema!=='cargoplan.route-problem/v1') throw new Error('题目格式应为 cargoplan.route-problem/v1')
  if(!Number.isSafeInteger(value.seed) || !DOORS.includes(value.door as RouteProblem['door'])) throw new Error('随机种子或车门方向无效')
  if(!record(value.initial) || !Array.isArray(value.initial.items) || !record(value.initial.dimensions)) throw new Error('题目缺少起点货舱及在车清单')
  if(!Array.isArray(value.stops) || !value.stops.length) throw new Error('至少需要一个站点')
  if(value.description!==undefined && typeof value.description!=='string') throw new Error('题目说明必须是文本')
  const units:CargoItem[]=[], expected=new Set<string>(),seen=new Set<string>(),destinations=new Map<string,number>()
  for(const p of value.initial.items) {
    if(!record(p) || !record(p.item) || !record(p.position) || !record(p.actualDimensions)) throw new Error('在车货物必须包含货物参数、坐标和实占尺寸')
    units.push(p.item as unknown as CargoItem);expected.add(String(p.item.id));seen.add(String(p.item.id))
  }
  for(const [index,stop] of value.stops.entries()) {
    if(!record(stop) || typeof stop.name!=='string' || !stop.name.trim() || !Array.isArray(stop.unloadIds) || !Array.isArray(stop.pickup)) throw new Error(`第 ${index+1} 站缺少名称、卸货 ID 或装货清单`)
    for(const id of stop.unloadIds) {
      if(typeof id!=='string' || !expected.delete(id)) throw new Error(`第 ${index+1} 站卸货任务 ${id} 不存在、尚未提货或被重复交付`)
      destinations.set(id,index+1)
    }
    for(const item of stop.pickup) {
      if(!record(item) || typeof item.id!=='string' || seen.has(item.id)) throw new Error(`第 ${index+1} 站提货 ID 重复或无效`)
      seen.add(item.id);expected.add(item.id);units.push(item as unknown as CargoItem)
    }
    if(stop.pickupPlacements!==undefined && !Array.isArray(stop.pickupPlacements)) throw new Error('装货候选位置必须为数组')
  }
  const initial=value.initial as unknown as Container
  for(const n of [...Object.values(initial.dimensions),initial.maxWeight]) if(!Number.isFinite(n) || n<=0) throw new Error('货舱尺寸和额定载重必须是有效正数')
  if(units.length) validateRequest({items:units})
  if(value.vehicle!==undefined)validateVehicle(value.vehicle)
  if(initial.routeDoors!==undefined && (!Array.isArray(initial.routeDoors) || !initial.routeDoors.length || initial.routeDoors.some(d=>!DOORS.includes(d))))throw new Error('起点装卸方向无效')
  const problem=structuredClone(value) as unknown as RouteProblem
  const bind=(item:CargoItem)=>({...item,unloadStop:destinations.get(item.id) ?? problem.stops.length+1})
  problem.initial.items=problem.initial.items.map(p=>({...p,item:bind(p.item)}))
  if(problem.initial.loadingRules) {
    const rules=problem.initial.loadingRules
    if(!record(rules.heightExceptions)) throw new Error('高度例外必须按货物 ID 声明')
    if(!Number.isFinite(rules.clearanceMm) || rules.clearanceMm<0 || ![0,5].includes(rules.supportGapMm) || !['none','5mm-spacer','pdf-clearance-projection'].includes(rules.supportMechanism) || rules.supportGapMm!==(rules.supportMechanism==='none'?0:5)) throw new Error('货舱间距与承托规则无效')
    const onboard=new Set(problem.initial.items.map(p=>p.item.id))
    problem.initial.loadingRules.heightExceptions=Object.fromEntries(Object.entries(problem.initial.loadingRules.heightExceptions).filter(([id])=>onboard.has(id)))
  }
  for(const stop of problem.stops) {
    stop.pickup=stop.pickup.map(bind)
    if(stop.pickupPlacements) stop.pickupPlacements=stop.pickupPlacements.map(p=>{
      if(!p || !p.item || !p.position || !p.actualDimensions || !stop.pickup.some(i=>i.id===p.item.id)) throw new Error('装货候选位置不属于本站装货清单')
      return {...p,item:stop.pickup.find(i=>i.id===p.item.id)!}
    })
  }
  if(problem.handling!==undefined) { validateHandling(problem.handling); problem.initial.handlingAccess=problem.handling }
  if(problem.initial.handlingAccess!==undefined) validateHandling(problem.initial.handlingAccess)
  const faces=problem.vehicle?.doors ?? problem.initial.routeDoors ?? [problem.door]
  if(faces.every(d=>d==='z-max') && problem.initial.handlingAccess?.mode!=='mechanical')throw new Error('顶部吊装需要设备抽取 / 吊装模式，请修改作业方式')
  updateContainer(problem.initial)
  if(problem.initial.items.length) {
    const validation=validateSolution(createPackingSolution([problem.initial],[],'ROUTE-INITIAL',0,0),problem.initial.items.map(p=>p.item))
    if(!validation.valid) throw new Error(`起点装载无效：${validation.errors.slice(0,3).join('；')}`)
  }
  return problem
}
