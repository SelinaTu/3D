// #created 11/08/2026
import {mkdirSync,readFileSync,writeFileSync,appendFileSync} from 'node:fs'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {loadingRulesFor} from '../core/loading-profile'
import {canPlaceAt,updateContainer,volume} from '../core/packing-utils'
import {placeResearchItem} from '../core/research-placement'
import {contactRectangles,unionArea,supportGap} from '../core/solid-geometry'
import {createPackingSolution} from '../core/solution-builder'
import {validateSolution} from '../core/validation'
import {researchHash} from '../core/research-metrics'
import {superviseResearch} from './research-supervisor'
import type {Container,CargoItem} from '../types/packing'
const output='data/optimization/v3-repair-11';mkdirSync(output,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--child'],execArgv:['--import','tsx'],budgetMs:120000,inheritOutput:true});writeFileSync(`${output}/supervision.json`,JSON.stringify(supervision,null,2))}else{
const cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),start=Date.now(),deadline=start+116000,originals=new Map(cal.items.map(i=>[i.id,i])),engineFiles=['src/scripts/repair-v3-eleven.ts','src/core/research-placement.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts','src/core/loading-profile.ts'].map(path=>({path,sha256:researchFileHash(path)})),provenance={...researchCalibrationProvenance(cal),engineFiles,engineSha256:researchHash(engineFiles),startedAt:new Date().toISOString(),seed:20261018,budgetMs:120000}
const sourcePaths=Array.from({length:11},(_,i)=>i+1).map(n=>n===9?'data/reconstruction/pdf-container-nine-seed/result.json':`data/reconstruction/v3/container-${n}/result.json`)
const base:Container[]=sourcePaths.map((path,i)=>{const r=JSON.parse(readFileSync(path,'utf8')),c:Container=structuredClone(r.solution.containers[0]);c.id=`repair-v3-${i+1}`;c.loadingRules=loadingRulesFor(cal.items,cal.config);c.items=c.items.map(p=>({...p,item:originals.get(p.item.id)!}));updateContainer(c);return c})
let bestMissing=Infinity
for(let trial=0;trial<5&&Date.now()<deadline;trial++){
  const trialStart=Date.now(),until=Math.min(deadline,trialStart+35000),containers=structuredClone(base),moves:unknown[]=[],ejected:string[]=[]
  if(trial>0)for(let bi=0;bi<containers.length;bi++){
    const c=containers[bi],remove=new Set<string>()
    for(const p of c.items){const row=Number(p.item.rawData._sourceRow),door=p.item.rawData._sourceSheet==='门窗';if(door&&(trial===1?[5,6,7,8,22].includes(row):trial===2?[5,6,7,8,10,22].includes(row):[5,6,7,8,10,11,12,13,21,22,24,25].includes(row))&&p.position.z===0)remove.add(p.item.id);if(trial>=2&&bi===8&&door&&[5,6].includes(row))remove.add(p.item.id)}
    let changed=true;while(changed){changed=false;for(const upper of c.items)if(!remove.has(upper.item.id)&&upper.position.z>0&&c.items.some(lower=>remove.has(lower.item.id)&&unionArea(contactRectangles(upper,lower,supportGap(upper.item,lower.item,c)))>1e-6)){remove.add(upper.item.id);changed=true}}
    ejected.push(...remove);c.items=c.items.filter(p=>!remove.has(p.item.id));updateContainer(c)
  }
  const used=new Set(containers.flatMap(c=>c.items.map(p=>p.item.id)));let pool=cal.items.filter(i=>!used.has(i.id));const initialPool=pool.length,mode=3+trial%3
  const rank=(i:CargoItem)=>i.rawData._sourceSheet==='辅材'?(i.weight>100?1:5):[9,14,15].includes(Number(i.rawData._sourceRow))?0:Number(i.rawData._sourceRow)===20?1:2
  const attempts:Record<string,number>={}
  for(let pass=0;pass<2&&pool.length&&Date.now()<until;pass++){
    const remaining:CargoItem[]=[]
    for(const item of [...pool].sort((a,b)=>rank(a)-rank(b)||(trial%2?volume(b.dimensions)-volume(a.dimensions):b.weight-a.weight))){if(Date.now()>=until){remaining.push(item);continue}let placed=false;const bins=[...containers].sort((a,b)=>trial%2?a.volumeUtilization-b.volumeUtilization:b.volumeUtilization-a.volumeUtilization);for(const c of bins){if(Date.now()>=until)break;const p=placeResearchItem(item,c,mode,Math.min(until,Date.now()+90));attempts[item.id]=(attempts[item.id]??0)+1;if(p&&canPlaceAt(item,p.position,p.orientation,p.rotation,c)){c.items.push(p);updateContainer(c);moves.push({id:item.id,target:c.id,position:p.position,orientation:p.orientation,rotation:p.rotation,pass});placed=true;break}}if(!placed)remaining.push(item)}pool=remaining
  }
  const solution=createPackingSolution(containers,pool,`V3-ALL-RACKS-REPAIR-${trial}`,0,Date.now()-trialStart),validation=validateSolution(solution,cal.items,cal.config),complete=pool.length===0&&validation.valid,record={trial,mode,initialPool,ejected,placed:cal.items.length-pool.length,missing:pool.map(i=>({id:i.id,name:i.name})),attempts,elapsedMs:Date.now()-trialStart,validation:{valid:validation.valid,errors:validation.errors},complete,moves}
  appendFileSync(`${output}/ledger.jsonl`,JSON.stringify(record)+'\n');if(validation.valid){writeFileSync(`${output}/candidate-${trial}.json`,JSON.stringify({provenance,config:cal.config,sourcePaths:sourcePaths.map(path=>({path,sha256:researchFileHash(path)})),solution,validation,complete,record},null,2));if(pool.length<bestMissing){bestMissing=pool.length;writeFileSync(`${output}/best-partial.json`,JSON.stringify({provenance,config:cal.config,solution,validation,complete,record},null,2))}}
  console.log(JSON.stringify({trial,initialPool,loaded:cal.items.length-pool.length,missing:pool.length,complete,valid:validation.valid,elapsedMs:Date.now()-trialStart,errors:validation.errors.slice(0,3)}));if(complete)break
}
writeFileSync(`${output}/summary.json`,JSON.stringify({provenance,bestMissing,elapsedMs:Date.now()-start},null,2));process.send?.({type:'research-finished',status:Date.now()>=deadline?'budget-exhausted':'trial-limit'})
}
