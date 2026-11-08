// #created 11/08/2026
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CargoItem, Container, PlacedItem, Position3D } from '../types/packing'
import { canPlaceAt, findPlacementPoints, maxPlacementHeight, orientationsFor, updateContainer, volume } from '../core/packing-utils'
import { cavityFaceMargins, geometryFor, requiredClearance, supportGap } from '../core/solid-geometry'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { calculateSolutionScore } from '../core/evaluator'
import { assertResearchCalibration, compareResearchWithPdf, loadResearchCalibration, researchCalibrationProvenance, researchReallocation } from '../core/research-calibration'
import { assessResearchCandidate, canonicalResearchSolution, isResearchImprovement } from '../core/research-metrics'
import type { AssessedResearchCandidate } from '../core/research-metrics'

if (!process.send) throw new Error('Run research-consolidate.ts: this child requires an external wall-clock supervisor')
const writeSnapshot=(path:string,value:unknown)=>{const temporary=`${path}.${process.pid}.tmp`;writeFileSync(temporary,JSON.stringify(value,null,2));renameSync(temporary,path)}

const calibration=loadResearchCalibration('data/calibration/packing-contract.json')
const {items,config}=calibration
if(config.verticalSupport!=='pdf-clearance-projection')throw new Error('This experiment requires the calibrated PDF projection contract, without physical spacers.')
const sources=['delivery-output/research/pdf-projection-consolidate/best-complete.json','delivery-output/research/pdf-projection-order/best-current-order-research.json','delivery-output/research/pdf-projection-hybrid/result.json']
const output=process.argv[2]||'delivery-output/research/pdf-projection-consolidate'
const budget=Number(process.argv[3]||600000)
if(!Number.isFinite(budget)||budget<=0||budget>600000)throw new Error('Budget must be <=600000ms')
const started=Date.now(),deadline=started+budget
mkdirSync(output,{recursive:true})
const provenance=researchCalibrationProvenance(calibration)
const group=(item:CargoItem)=>`${item.rawData._sourceSheet}/${item.rawData._sourceRow}`
function metricBetter(a:AssessedResearchCandidate,b:AssessedResearchCandidate):boolean {
  return isResearchImprovement(a.metrics,b.metrics)||a.metrics.eligible&&b.metrics.eligible&&a.metrics.totalContainers===b.metrics.totalContainers&&a.metrics.tailSolidVolumeMm3<b.metrics.tailSolidVolumeMm3-1&&a.metrics.physicalLayoutSha256!==b.metrics.physicalLayoutSha256
}
function readBaseline():AssessedResearchCandidate|undefined {
  let selected:AssessedResearchCandidate|undefined
  for(const source of sources){if(!existsSync(source))continue;try{
    const saved=JSON.parse(readFileSync(source,'utf8'))
    if(saved.provenance?.calibrationHash!==calibration.calibrationHash)throw new Error('Calibration digest mismatch')
    const assessed=assessResearchCandidate(saved.solution,items,config)
    if(assessed.metrics.eligible&&(!selected||metricBetter(assessed,selected)))selected=assessed
  }catch(error){console.log(JSON.stringify({event:'baseline-rejected',source,error:String(error)}))}}
  return selected
}
const initial=readBaseline()
if(!initial)throw new Error('No complete, independently valid same-contract baseline; no legacy box dimensions are accepted.')
let best=initial
writeFileSync(join(output,'session.json'),JSON.stringify({provenance,config,budgetMs:budget,candidateBudgetMs:60000,startedAt:new Date().toISOString(),baseline:best.metrics,sourcePaths:sources,notes:['Each candidate is independently checked under the calibration config.','Tail changes above eleven bins are intermediate solver steps, not success against the PDF.','PDF projection support is an assumption model; actual site support is unproven.']},null,2))

function orientationRank(item:CargoItem,mode:number){
  const variants=orientationsFor(item)
  variants.sort((a,b)=>{
    const rank=(v:typeof a)=>mode%3===0?v.dimensions.length*v.dimensions.width:mode%3===1?v.dimensions.height:(item.dimensions.length>5000&&v.orientation==='flat'?-1e12:v.dimensions.length*v.dimensions.width)
    return rank(a)-rank(b)
  })
  return variants
}
function placeExpanded(item:CargoItem,c:Container,mode:number,until:number):PlacedItem|null {
  if(c.totalWeight+item.weight>c.maxWeight)return null
  const variants=orientationRank(item,mode),base=findPlacementPoints(c)
  type Entry={position:Position3D;variant:typeof variants[number];rank:number;order:number}
  const entries:Entry[]=[]
  const stackFirst=mode>=3
  for(const [order,variant]of variants.entries()){
    const d=variant.dimensions,seen=new Map<string,Entry>()
    const add=(x:number,y:number,z:number,same=false)=>{
      if(x<0||y<0||z<0||x+d.length>c.dimensions.length||y+d.width>c.dimensions.width||z+d.height>maxPlacementHeight(item,c))return
      const key=`${x}/${y}/${z}`,rank=stackFirst?(same?0:z===0?1:2):z===0?0:1,prior=seen.get(key)
      if(prior){prior.rank=Math.min(prior.rank,rank);return}
      const entry={position:{x,y,z},variant,order,rank};seen.set(key,entry);entries.push(entry)
    }
    for(const p of base)add(p.x,p.y,p.z)
    add(c.dimensions.length-d.length,0,0);add(0,c.dimensions.width-d.width,0);add(c.dimensions.length-d.length,c.dimensions.width-d.width,0)
    for(const host of c.items){
      const p=host.position,q=host.actualDimensions,gap=requiredClearance(item,host.item,c)
      const x2=p.x+q.length,y2=p.y+q.width
      for(const [x,y]of[[x2+gap,p.y],[p.x-d.length-gap,p.y],[p.x,y2+gap],[p.x,p.y-d.width-gap],[x2+gap,c.dimensions.width-d.width],[c.dimensions.length-d.length,y2+gap],[x2-d.length,y2+gap],[x2+gap,y2-d.width]])add(x,y,0)
      const geometry=geometryFor(host),same=group(host.item)===group(item),support=supportGap(item,host.item,c)
      if(host.item.canStackOnTop||host.item.cavity)for(const face of geometry.top){
        if(!host.item.canStackOnTop&&Math.abs(face.z-(p.z+q.height))<1e-6)continue
        for(const x of[face.minX,face.maxX-d.length])for(const y of[face.minY,face.maxY-d.width])add(x,y,face.z+support,same)
      }
      if(geometry.cavity&&host.item.cavity?.allowedSourceSheets?.includes(String(item.rawData._sourceSheet))&&(!host.item.cavity.doorOrientation||item.rawData._sourceSheet!=='门窗'||variant.orientation===host.item.cavity.doorOrientation)){
        const inner=geometry.cavity,margin=cavityFaceMargins(host,gap)!
        for(const x of[inner.min.x+margin.min.x,inner.max.x-margin.max.x-d.length])for(const y of[inner.min.y+margin.min.y,inner.max.y-margin.max.y-d.width])add(x,y,inner.min.z+margin.min.z)
      }
    }
  }
  // Packing same-source columns before consuming new floor strips leaves usable
  // floor for large items with incompatible top-stack permissions.
  entries.sort((a,b)=>a.rank-b.rank||(stackFirst&&a.rank===0?a.position.x-b.position.x||a.position.y-b.position.y||a.position.z-b.position.z:a.position.z-b.position.z||a.order-b.order||a.position.x-b.position.x||a.position.y-b.position.y))
  for(const e of entries){if(Date.now()>=until)return null;if(canPlaceAt(item,e.position,e.variant.orientation,e.variant.rotation,c))return{item,position:e.position,orientation:e.variant.orientation,rotation:e.variant.rotation,actualDimensions:e.variant.dimensions}}
  return null
}
function ordered(pool:CargoItem[],mode:number):CargoItem[]{
  const count=new Map<string,number>();for(const i of pool)count.set(group(i),(count.get(group(i))??0)+1)
  const feature=(i:CargoItem)=>{const legal=orientationsFor(i).filter(v=>v.dimensions.height<=maxPlacementHeight(i,createEmptyContainer(0,config,items))&&v.dimensions.length<=config.containerDimensions.length&&v.dimensions.width<=config.containerDimensions.width);return{rigid:legal.length,area:Math.min(...legal.map(v=>v.dimensions.length*v.dimensions.width)),v:volume(i.dimensions),n:count.get(group(i))??1}}
  const cached=new Map(pool.map(i=>[i.id,feature(i)]))
  return[...pool].sort((a,b)=>{const x=cached.get(a.id)!,y=cached.get(b.id)!;return mode%3===0?x.rigid-y.rigid||y.v-x.v:mode%3===1?y.area-x.area||y.v-x.v:y.n-x.n||y.v-x.v})
}
function persist(assessed:AssessedResearchCandidate,event:Record<string,unknown>){
  const solution=canonicalResearchSolution(assessed)
  writeSnapshot(join(output,'best-complete.json'),{provenance,config,event,solution,validation:assessed.validation,metrics:assessed.metrics,pdfComparison:compareResearchWithPdf(assessed.metrics,calibration),reallocation:researchReallocation(solution,calibration),note:'Research under PDF clearance projection; actual physical support is not established.'})
}
persist(best,{kind:'baseline-import'})
for(let trial=0;trial<40&&Date.now()<deadline;trial++){
  process.send?.({type:'candidate-start',trial})
  assertResearchCalibration(calibration,items,config)
  if(trial%4===0){const external=readBaseline();if(external&&metricBetter(external,best)){best=external;persist(best,{kind:'external-baseline-update',trial})}}
  const source=canonicalResearchSolution(best),n=source.containers.length,removeCount=trial<6?3:trial<12?2:3
  const mode=[3,0,4,1,5,2][trial%6]
  const longBins=source.containers.map((c,index)=>({index,count:c.items.filter(p=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===23).length,volume:c.volumeUtilization})).filter(c=>c.count>0).sort((a,b)=>a.count-b.count||a.volume-b.volume)
  let removed:number[]
  if(removeCount===2)removed=longBins.length>=2?[longBins[0].index,longBins[1].index]:[n-1,n-2]
  else if(longBins.length>=3)removed=[longBins[0].index,longBins[1].index,longBins[2+(Math.floor(trial/12)%Math.max(1,longBins.length-2))].index]
  else removed=[n-1,n-2,n-3]
  const targets=source.containers.filter((_,i)=>!removed.includes(i)).map(c=>({...c,items:[...c.items]}))
  const pool=removed.flatMap(index=>source.containers[index].items.map(p=>p.item)),unpacked:CargoItem[]=[]
  const targetNew=Math.max(0,removeCount-1),candidateStart=Date.now(),until=Math.min(deadline,candidateStart+55000)
  for(let i=0;i<targetNew;i++)targets.push(createEmptyContainer(1000+trial*3+i,config,items))
  for(const item of ordered(pool,mode)){
    let placed=false
    const bins=[...targets].sort((a,b)=>mode%2?a.volumeUtilization-b.volumeUtilization:b.volumeUtilization-a.volumeUtilization)
    for(const c of bins){if(Date.now()>=until)break;const p=placeExpanded(item,c,mode,Math.min(until,Date.now()+900));if(p){c.items.push(p);updateContainer(c);placed=true;break}}
    if(!placed)unpacked.push(item)
  }
  const partial=createPackingSolution(targets,unpacked,`CONSOLIDATE-${trial}`,calculateSolutionScore(targets,unpacked,config.containerDimensions,config.weights),Date.now()-candidateStart)
  partial.searchMode='heuristic';partial.terminationReason=Date.now()>=until?'time-limit':'completed';partial.notes=['PDF 5mm几何预留投影模型；未新增实物隔垫，现场实际承托未证实。']
  const assessed=assessResearchCandidate(partial,items,config)
  process.send?.({type:'candidate-finish',trial})
  const record={event:'candidate',trial,mode,removedSourceIndices:removed,poolItems:pool.length,candidateMs:Date.now()-candidateStart,totalMs:Date.now()-started,metrics:assessed.metrics,validation:assessed.validation,provenance,accepted:assessed.metrics.eligible&&metricBetter(assessed,best)}
  appendFileSync(join(output,'ledger.jsonl'),JSON.stringify(record)+'\n')
  console.log(JSON.stringify({trial,mode,removed,pool:pool.length,containers:assessed.metrics.totalContainers,loaded:assessed.metrics.placedItems,unpacked:assessed.metrics.unpackedItems,valid:assessed.validation.valid,accepted:record.accepted,ms:record.candidateMs,tailM3:assessed.metrics.tailSolidVolumeMm3/1e9}))
  if(record.accepted){best=assessed;persist(best,record);writeFileSync(join(output,`improvement-${trial}-${best.metrics.totalContainers}-containers.json`),JSON.stringify({provenance,config,solution:canonicalResearchSolution(best),metrics:best.metrics,validation:best.validation,record},null,2))}
  else if(assessed.validation.valid&&unpacked.length<20)writeFileSync(join(output,'nearest-partial.json'),JSON.stringify({provenance,config,solution:partial,metrics:assessed.metrics,validation:assessed.validation,record,note:'Incomplete research candidate; never a delivery result.'},null,2))
}
writeFileSync(join(output,'summary.json'),JSON.stringify({provenance,config,elapsedMs:Date.now()-started,bestMetrics:best.metrics,validation:best.validation,pdfComparison:compareResearchWithPdf(best.metrics,calibration),resultPath:join(output,'best-complete.json')},null,2))

process.send?.({type:'research-finished',status:Date.now()>=deadline?'budget-exhausted':'trial-limit'})
