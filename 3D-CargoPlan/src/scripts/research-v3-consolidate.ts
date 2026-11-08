// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import type { CargoItem, Container, Orientation, PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate } from '../core/research-metrics'
import { loadingRulesFor } from '../core/loading-profile'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { calculateActualDimensions, canPlaceAt, updateContainer, volume } from '../core/packing-utils'
import { placeResearchItem } from '../core/research-placement'
import { superviseResearch } from './research-supervisor'
const output='data/optimization/v3-consolidate';mkdirSync(output,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--child'],execArgv:['--import','tsx'],budgetMs:120000,candidateWallLimitMs:38000,inheritOutput:true});writeFileSync(`${output}/supervision.json`,JSON.stringify(supervision,null,2))}else{
 const start=Date.now(),deadline=start+116000,cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),{items,config}=cal,input='data/optimization/v3/best-complete.json',base=JSON.parse(readFileSync(input,'utf8')).solution, source=structuredClone(base) as PackingSolution
 writeFileSync(`${output}/source-snapshot.json`,JSON.stringify({input,sha256:researchFileHash(input),solution:source}))
 const provenance={...researchCalibrationProvenance(cal),inputSha256:researchFileHash(input),scriptSha256:researchFileHash('src/scripts/research-v3-consolidate.ts'),engineFiles:['src/core/research-placement.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts'].map(path=>({path,sha256:researchFileHash(path)})),cpu:cpus()[0]?.model,command:'node --import tsx src/scripts/research-v3-consolidate.ts',startedAt:new Date().toISOString()}
 const isLong=(i:CargoItem)=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===23
 const group4=source.containers.find((c:Container)=>c.items.filter(p=>isLong(p.item)).length===4)!,group16=source.containers.find((c:Container)=>c.items.filter(p=>isLong(p.item)).length===16)!
 const longUnits=[...group4.items,...group16.items].filter(p=>isLong(p.item)).map(p=>p.item)
 for(let trial=0;trial<3&&Date.now()<deadline;trial++){
  process.send?.({type:'candidate-start',trial});const t=Date.now(),until=Math.min(deadline,t+35000),mode=trial+3
  const containers:Container[]=source.containers.filter((c:Container)=>c.id!==group4.id&&c.id!==group16.id).map((c:Container)=>{const x=structuredClone(c);x.loadingRules=loadingRulesFor(items,config);updateContainer(x);return x})
  const merged=createEmptyContainer(990+trial,config,items);containers.push(merged)
  const lyingCount=[20,18,16][trial],columns=lyingCount/2,placedIds=new Set<string>(),moves:unknown[]=[];let macroError:string|undefined
  const put=(item:CargoItem,x:number,y:number,z:number,orientation:Orientation)=>{if(!canPlaceAt(item,{x,y,z},orientation,0,merged))throw Error(`macro rejected ${item.id} at ${x}/${y}/${z}`);merged.items.push({item,position:{x,y,z},orientation,rotation:0,actualDimensions:calculateActualDimensions(item.dimensions,orientation,0,item.orientationVerticalAxes)});placedIds.add(item.id);updateContainer(merged)}
  try{for(let i=0;i<lyingCount;i++)put(longUnits[i],0,(i%columns)*215,Math.floor(i/columns)*995,'lying');for(let i=lyingCount;i<20;i++){const j=i-lyingCount;put(longUnits[i],0,(j%2)*995,1990+Math.floor(j/2)*215,'flat')}}catch(e){macroError=String(e)}
  let pool=[...group4.items,...group16.items].map(p=>p.item).filter(i=>!placedIds.has(i.id));const initialPool=pool.length
  if(!macroError)for(let pass=0;pass<2&&pool.length&&Date.now()<until;pass++){
   const rest:CargoItem[]=[];const ordered=[...pool].sort((a,b)=>Number(isLong(b))-Number(isLong(a))||(trial%2?Math.max(...Object.values(b.dimensions))-Math.max(...Object.values(a.dimensions)):volume(b.dimensions)-volume(a.dimensions))||b.weight-a.weight)
   for(const item of ordered){let found=false;if(Date.now()<until)for(const c of [...containers].sort((a,b)=>trial%2?a.volumeUtilization-b.volumeUtilization:b.volumeUtilization-a.volumeUtilization)){const p=placeResearchItem(item,c,mode,Math.min(until,Date.now()+100));if(p){c.items.push(p);updateContainer(c);moves.push({id:item.id,target:c.id,position:p.position,orientation:p.orientation,rotation:p.rotation});found=true;break}}if(!found)rest.push(item)}pool=rest
  }
  const solution=createPackingSolution(containers,pool,`V3-CONSOLIDATE-LONG-${trial}`,0,Date.now()-t),assessment=assessResearchCandidate(solution,items,config),record={trial,lyingCount,initialPool,remaining:pool.map(i=>i.id),moves,macroError,metrics:assessment.metrics,validation:assessment.validation,accepted:assessment.metrics.eligible&&assessment.metrics.totalContainers<=11,elapsedMs:Date.now()-t}
  appendFileSync(`${output}/ledger.jsonl`,JSON.stringify({provenance,...record})+'\n');writeFileSync(`${output}/candidate-${trial}.json`,JSON.stringify({provenance,config,solution,...record},null,2));console.log(JSON.stringify({trial,loaded:assessment.metrics.placedItems,missing:pool.length,valid:assessment.validation.valid,accepted:record.accepted,elapsedMs:record.elapsedMs}));process.send?.({type:'candidate-finish',trial});if(record.accepted){writeFileSync(`${output}/best-complete.json`,JSON.stringify({provenance,config,solution,...record},null,2));break}
 }
 process.send?.({type:'research-finished',status:'bounded-candidates-complete'})
}
