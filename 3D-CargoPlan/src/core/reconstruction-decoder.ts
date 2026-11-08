// #created 11/08/2026
import type { CargoItem, Container, OptimizationConfig, Orientation, PackingSolution, PlacedItem } from '../types/packing'
import { createEmptyContainer } from './greedy-algorithm'
import { canPlaceAt, calculateActualDimensions, findPlacementPoints, orientationsFor, updateContainer, volume } from './packing-utils'
import { createPackingSolution } from './solution-builder'
import { isGlassRack, solidVolume } from './solid-geometry'
import { validateSolution } from './validation'

export interface ReconstructionPolicy { seed: number; order: 'pdf'|'volume'|'length'|'rigidity'|'rack-first'|'random'; columnMode: 'mixed'|'flat'|'height'|'single'; rackYaw: 0|90; rackChain: boolean; reversePoints?: boolean }
interface Column { units: CargoItem[]; orientation: Orientation; rotation: number; dimensions: CargoItem['dimensions']; unitHeight: number }
export const reconstructionSourceKey = (i: CargoItem) => `${i.rawData._sourceSheet}/${i.rawData._sourceRow}`
function randomGenerator(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
function optionsFor(source: CargoItem, n: number, config: OptimizationConfig, mode: ReconstructionPolicy['columnMode']) {
  const gap = config.verticalSupport === 'none' || !config.verticalSupport ? 0 : 5
  return orientationsFor(source).filter(v => v.dimensions.length <= config.containerDimensions.length && v.dimensions.width <= config.containerDimensions.width && v.dimensions.height <= (source.rawData._sourceSheet === '门窗' && source.rawData._sourceRow === 16 ? 2560 : config.containerDimensions.height)).map(v => {
    const limits = { maxStackCount: source.maxStackCount, maxStackWeight: source.maxStackWeight, ...source.constraints?.orientationRules?.[v.orientation] }
    let count = Math.min(n, Math.floor((config.containerDimensions.height + gap) / (v.dimensions.height + gap)))
    if (mode === 'single' || !source.canStackOnTop || source.constraints?.mustBeOnFloor || isGlassRack(source) || source.stackableWith?.includes('@not-self')) count = 1
    if (limits.maxSupportedItemWeight !== undefined && source.weight > limits.maxSupportedItemWeight) count = 1
    const d = source.dimensions
    if (source.constraints?.supportedItemsLargestFaceDown && v.dimensions.length*v.dimensions.width < Math.max(d.length*d.width,d.length*d.height,d.width*d.height)-1e-6) count = 1
    if (limits.maxStackCount !== undefined) count = Math.min(count, limits.maxStackCount+1)
    if (limits.maxStackWeight !== undefined) while (count>1 && (limits.strictMaxStackWeight ? (count-1)*source.weight >= limits.maxStackWeight : (count-1)*source.weight > limits.maxStackWeight)) count--
    return { ...v, count: Math.max(1,count) }
  })
}
/** A source's remainder may use another allowed orientation; every column is later expanded. */
export function reconstructionColumns(units: CargoItem[], config: OptimizationConfig, mode: ReconstructionPolicy['columnMode']): Column[] {
  let options = optionsFor(units[0],units.length,config,mode)
  if(mode==='flat'&&units[0].rawData._sourceSheet==='门窗'&&[5,6,7,8,22].includes(Number(units[0].rawData._sourceRow))){const flat=options.filter(o=>o.orientation==='flat'&&o.count>1).map(o=>({...o,count:Math.min(o.count,Math.floor(600/units[0].weight)||1)}));if(flat.length)options=flat}
  const n = units.length, gap = config.verticalSupport === 'none' || !config.verticalSupport ? 0 : 5
  if (!options.length) return []
  const costs = Array<number>(n+1).fill(Infinity), choices: ({ option: typeof options[number]; count: number }|undefined)[] = Array(n+1)
  costs[0] = 0
  for (let q=1;q<=n;q++) for (const o of options) for (let c=1;c<=Math.min(q,o.count);c++) {
    const flatBias = mode === 'flat' && o.orientation === 'flat' ? 0.85 : 1
    const h = c*o.dimensions.height+(c-1)*gap
    const heightBias = mode === 'height' ? config.containerDimensions.height / Math.max(h,1) : 1
    const cost = costs[q-c]+o.dimensions.length*o.dimensions.width*flatBias*heightBias
    if (cost < costs[q]-1e-6) { costs[q]=cost; choices[q]={option:o,count:c} }
  }
  const result: Column[]=[]; let q=n, index=0
  while(q>0) { const choice=choices[q]; if(!choice)break; const {option:o,count:c}=choice; result.push({units:units.slice(index,index+c),orientation:o.orientation,rotation:o.rotation,dimensions:{...o.dimensions,height:c*o.dimensions.height+(c-1)*gap},unitHeight:o.dimensions.height});index+=c;q-=c }
  // Largest batches precede the thin, differently oriented remainder.
  return result.sort((a,b)=>volume(b.dimensions)-volume(a.dimensions))
}
function placeColumn(column: Column, container: Container, deadline: number, reversePoints: boolean): boolean {
  const gap = container.loadingRules?.supportGapMm ?? 0
  let points = findPlacementPoints(container)
  if(reversePoints)points=[...points].sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x)
  for(const position of points) for(const yaw of [0,90]) {
    if(Date.now()>=deadline)return false
    const rotation=(column.rotation+yaw)%360, d=calculateActualDimensions(column.units[0].dimensions,column.orientation,rotation,column.units[0].orientationVerticalAxes)
    if(position.x+d.length>container.dimensions.length+1e-6||position.y+d.width>container.dimensions.width+1e-6)continue
    const trial:Container={...container,items:[...container.items]}
    let good=true
    for(let j=0;j<column.units.length;j++) {
      const item=column.units[j], p={x:position.x,y:position.y,z:position.z+j*(column.unitHeight+gap)}
      if(!canPlaceAt(item,p,column.orientation,rotation,trial)){good=false;break}
      trial.items.push({item,position:p,orientation:column.orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,column.orientation,rotation,item.orientationVerticalAxes)})
    }
    if(good){container.items=trial.items;updateContainer(container);return true}
  }
  return false
}
function placeSingle(item:CargoItem,container:Container,deadline:number):boolean {
  for(const position of findPlacementPoints(container))for(const v of orientationsFor(item)){
    if(Date.now()>=deadline)return false
    if(canPlaceAt(item,position,v.orientation,v.rotation,container)){container.items.push({item,position:{...position},orientation:v.orientation,rotation:v.rotation,actualDimensions:v.dimensions});updateContainer(container);return true}
  }
  return false
}
export function reconstructOneContainer(items:CargoItem[],config:OptimizationConfig,policy:ReconstructionPolicy,deadline:number,initialContainer?:Container):PackingSolution {
  const started=Date.now(),container=initialContainer?structuredClone(initialContainer):createEmptyContainer(0,config,items),groups=new Map<string,CargoItem[]>(),random=randomGenerator(policy.seed),initialIds=new Set(container.items.map(p=>p.item.id))
  if(initialIds.size!==container.items.length||container.items.some(p=>!items.some(i=>i.id===p.item.id)))throw new Error('Seed contains foreign or duplicate units')
  for(const item of items.filter(i=>!initialIds.has(i.id)))groups.set(reconstructionSourceKey(item),[...(groups.get(reconstructionSourceKey(item))??[]),item])
  const groupList=[...groups.values()].map((units,index)=>({units,index,noise:random(),columns:reconstructionColumns(units,config,policy.columnMode)}))
  groupList.sort((a,b)=>{
    const x=a.units[0],y=b.units[0]
    if(policy.order==='rack-first'){const rank=Number(isGlassRack(y))-Number(isGlassRack(x));if(rank)return rank;const longest=Math.max(...Object.values(y.dimensions))-Math.max(...Object.values(x.dimensions));if(longest)return longest}
    if(policy.order==='random')return a.noise-b.noise
    if(policy.order==='pdf')return a.index-b.index
    if(policy.order==='rigidity'){const rank=optionsFor(x,a.units.length,config,policy.columnMode).length-optionsFor(y,b.units.length,config,policy.columnMode).length;if(rank)return rank}
    if(policy.order==='length'){const rank=Math.max(...Object.values(y.dimensions))-Math.max(...Object.values(x.dimensions));if(rank)return rank}
    return b.units.reduce((s,i)=>s+solidVolume(i),0)-a.units.reduce((s,i)=>s+solidVolume(i),0)
  })
  const seeded=new Set<string>()
  if(policy.rackChain&&!initialContainer){
    const racks=items.filter(isGlassRack).filter(i=>i.dimensions.length<=container.dimensions.width)
    const sum=racks.reduce((s,i)=>s+i.dimensions.width,0)
    if(racks.length&&sum<=container.dimensions.length){let x=0;for(const item of racks){const p={x,y:0,z:0},d=calculateActualDimensions(item.dimensions,'standing',90,item.orientationVerticalAxes);if(!canPlaceAt(item,p,'standing',90,container))break;container.items.push({item,position:p,orientation:'standing',rotation:90,actualDimensions:d});updateContainer(container);seeded.add(item.id);x+=d.length}}
  }
  const remaining:CargoItem[]=[]
  for(const group of groupList){
    if(isGlassRack(group.units[0]))for(const column of group.columns){if(seeded.has(column.units[0].id))continue;column.rotation=policy.rackYaw;if(!placeColumn(column,container,deadline,!!policy.reversePoints))remaining.push(...column.units)}
    else if(!group.columns.length)remaining.push(...group.units)
    else for(const column of group.columns){if(!placeColumn(column,container,deadline,!!policy.reversePoints))remaining.push(...column.units)}
  }
  // Actual hollow frames are already present, so this pass can safely use their cavities.
  const unpacked:CargoItem[]=[]
  for(const item of remaining){if(!placeSingle(item,container,deadline))unpacked.push(item)}
  const solution=createPackingSolution([container],unpacked,'PDF-FIXED-ALLOCATION-RECONSTRUCTION',0,Date.now()-started)
  solution.searchMode='heuristic';solution.terminationReason=Date.now()>=deadline?'time-limit':'completed'
  solution.notes=['原 PDF 单柜固定配货重建；未跨柜移动货物；宏列均展开为原始单件后逐件检查。']
  return solution
}
export function reconstructionPolicies(seed=20261017):ReconstructionPolicy[]{
  const result:ReconstructionPolicy[]=[]
  for(const columnMode of ['mixed','flat','height','single'] as const)for(const order of ['rack-first','length','rigidity','volume','pdf','random'] as const)for(const rackYaw of [90,0] as const)result.push({seed:seed+result.length,order,columnMode,rackYaw,rackChain:order==='rack-first',reversePoints:result.length%2===0})
  return result
}
/** Concrete rejected examples, not a proof that this allocation is infeasible. */
export function reconstructionDiagnostics(solution:PackingSolution,items:CargoItem[],config:OptimizationConfig){
  const container=solution.containers[0],examples:unknown[]=[]
  if(container)for(const item of solution.unpackedItems.slice(0,4)){
    const variants=orientationsFor(item),candidate=variants.find(v=>v.dimensions.length<=container.dimensions.length&&v.dimensions.width<=container.dimensions.width)
    if(candidate){const placement:PlacedItem={item,position:{x:0,y:0,z:0},orientation:candidate.orientation,rotation:candidate.rotation,actualDimensions:candidate.dimensions};const trial=createPackingSolution([{...container,items:[...container.items,placement]}],solution.unpackedItems.filter(i=>i.id!==item.id),solution.algorithm,0,0);examples.push({itemId:item.id,source:reconstructionSourceKey(item),candidate:placement,errors:validateSolution(trial,items,config).errors.slice(0,8)})}
  }
  return {kind:'bounded-heuristic-shortfall',notAnInfeasibilityProof:true,unpackedIds:solution.unpackedItems.map(i=>i.id),unpackedSources:[...new Set(solution.unpackedItems.map(reconstructionSourceKey))],rejectedOriginExamples:examples}
}
