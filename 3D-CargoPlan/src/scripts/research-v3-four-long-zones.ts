// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { CargoItem, PackingSolution, PlacedItem } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { placeTwentyThreeLongFrameMacro } from '../core/research-23-long-frame-macro'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { analyzeStacking, canPlaceAt, updateContainer, volume } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { createPackingSolution } from '../core/solution-builder'
import { assessResearchCandidate } from '../core/research-metrics'
import { placeResearchItem } from '../core/research-placement'
import { superviseResearch } from './research-supervisor'
const out='data/optimization/v3-four-long-zones';mkdirSync(out,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--child'],execArgv:['--import','tsx'],budgetMs:40000,candidateWallLimitMs:35000,inheritOutput:true});writeFileSync(`${out}/supervision.json`,JSON.stringify(supervision,null,2))}else{
 process.send?.({type:'candidate-start',trial:0});const start=Date.now(),deadline=start+30000,cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),input='data/optimization/v3-window-cpsat/round-4/result.json',source=JSON.parse(readFileSync(input,'utf8')),original=structuredClone(source.solution) as PackingSolution,containers=structuredClone(original.containers),provenance={...researchCalibrationProvenance(cal),input:{path:input,sha256:researchFileHash(input)},engineFiles:['src/scripts/research-v3-four-long-zones.ts','src/core/research-23-long-frame-macro.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts'].map(path=>({path,sha256:researchFileHash(path)})),command:'node --import tsx src/scripts/research-v3-four-long-zones.ts'}
 const isLong=(i:CargoItem)=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===23,isThin=(i:CargoItem)=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===25
 const donor=original.containers[4].items.filter(p=>isLong(p.item)).map(p=>p.item),groups=original.containers.slice(0,4).map(c=>c.items.filter(p=>isLong(p.item)).map(p=>p.item)),takes=[3,1,1,5];let next=0
 groups.forEach((g,i)=>{g.push(...donor.slice(next,next+takes[i]));next+=takes[i];if(g.length!==23)throw Error(`Unexpected long allocation ${i}/${g.length}`)})
 const thin=original.containers.slice(0,4).flatMap(c=>c.items.filter(p=>isThin(p.item)).map(p=>p.item));if(thin.length!==40||donor.length!==10)throw Error('Expected 40 transferable profiles and 10 donor frames')
 const removed=new Set([...groups.flat().map(i=>i.id),...thin.map(i=>i.id)]),removalReasons:unknown[]=[],plans:PlacedItem[][]=[]
 for(let i=0;i<4;i++){const empty=createEmptyContainer(i,cal.config,cal.items),r=placeTwentyThreeLongFrameMacro(empty,groups[i],thin.slice(i*10,i*10+10),{x:i===0?4469:0,y:0,z:0});if(!r.accepted)throw Error(r.rejection);plans.push(empty.items)}
 function dependencyClosure(){let changed=true;while(changed){changed=false;for(const c of original.containers){const analysis=analyzeStacking(c.items,c.loadingRules);for(let i=0;i<c.items.length;i++)if(!removed.has(c.items[i].item.id)&&analysis.supports[i].some(s=>removed.has(c.items[s.index].item.id))){removed.add(c.items[i].item.id);removalReasons.push({id:c.items[i].item.id,reason:'Supported by a removed/rebuilt component'});changed=true}}}}
 dependencyClosure()
 for(let bi=0;bi<4;bi++)for(const existing of original.containers[bi].items){if(removed.has(existing.item.id))continue;const hits=plans[bi].flatMap(p=>pairGeometryErrors(p,existing,original.containers[bi]));if(hits.length){removed.add(existing.item.id);removalReasons.push({id:existing.item.id,bin:bi+1,reason:'New four-zone macro physically intersects existing placement',examples:hits.slice(0,3)})}}
 dependencyClosure()
 containers.forEach(c=>{c.items=c.items.filter(p=>!removed.has(p.item.id));updateContainer(c)})
 for(let bi=0;bi<4;bi++){const r=placeTwentyThreeLongFrameMacro(containers[bi],groups[bi],thin.slice(bi*10,bi*10+10),{x:bi===0?4469:0,y:0,z:0});if(!r.accepted)throw Error(`Assembled macro ${bi+1} rejected: ${r.rejection}`)}
 const moves:unknown[]=[],ids=()=>new Set(containers.flatMap(c=>c.items.map(p=>p.item.id))),pool=()=>{const used=ids();return cal.items.filter(i=>!used.has(i.id))}
 const save=(name:string)=>{const solution=createPackingSolution(containers,pool(),'V3-FOUR-23-LONG-ZONES',0,Date.now()-start),a=assessResearchCandidate(solution,cal.items,cal.config),r={provenance,config:cal.config,solution,metrics:a.metrics,validation:a.validation,removalReasons,moves,elapsedMs:Date.now()-start};writeFileSync(`${out}/${name}.json`,JSON.stringify(r,null,2));if(!a.validation.valid)throw Error(JSON.stringify(a.validation.errors));return r}
 const structure=save('structure-seed');console.log(JSON.stringify({event:'four-long-zone-seed',loaded:structure.metrics.placedItems,missing:structure.solution.unpackedItems.length,valid:structure.validation.valid,elapsedMs:Date.now()-start}))
 // Preserve both 8-high W09 profile columns from bin 1; move them into the released bin-5 zone.
 const displacedW09=original.containers[0].items.filter(p=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===12&&removed.has(p.item.id)),columnGroups=new Map<string,PlacedItem[]>()
 for(const p of displacedW09){const key=`${p.position.x}/${p.position.y}`;columnGroups.set(key,[...(columnGroups.get(key)??[]),p])}
 let col=0;for(const stack of columnGroups.values()){const target=containers[4],placements=stack.sort((a,b)=>a.position.z-b.position.z),x=3164,y=1425+col*225,staged={...target,items:[...target.items]};let good=true;for(const p of placements){const position={x,y,z:p.position.z};if(!canPlaceAt(p.item,position,p.orientation,p.rotation,staged)){good=false;break}staged.items.push({...p,position});updateContainer(staged)}if(good){target.items=staged.items;updateContainer(target);moves.push({kind:'whole-source-W09-column',ids:placements.map(p=>p.item.id),target:target.id,origin:{x,y,z:0}})}col++}
 // First fit the four long pieces and displaced tall doors, using source-permitted orientations.
 let pending=pool();const priority=(i:CargoItem)=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===16?0:i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===9?1:i.rawData._sourceSheet==='门窗'&&[14,15,17].includes(Number(i.rawData._sourceRow))?2:3
 for(let pass=0;pass<2&&Date.now()<deadline;pass++){
  for(const item of [...pending].sort((a,b)=>priority(a)-priority(b)||volume(b.dimensions)-volume(a.dimensions))){if(Date.now()>=deadline)break;for(const c of [containers[4],...containers.filter((_,i)=>i!==4)]){const p=placeResearchItem(item,c,pass+3,Math.min(deadline,Date.now()+100));if(p){c.items.push(p);updateContainer(c);moves.push({id:item.id,target:c.id,position:p.position,orientation:p.orientation,rotation:p.rotation,pass});break}}}
  pending=pool();const r=save(`pass-${pass}`);appendFileSync(`${out}/ledger.jsonl`,JSON.stringify({pass,loaded:r.metrics.placedItems,missing:r.solution.unpackedItems.map(i=>i.id),elapsedMs:r.elapsedMs})+'\n');console.log(JSON.stringify({event:'four-long-zone-fill',pass,loaded:r.metrics.placedItems,missing:pending.length,valid:r.validation.valid,elapsedMs:r.elapsedMs}));if(!pending.length)break
 }
 const final=save('result');console.log(JSON.stringify({event:'four-long-zone-final',loaded:final.metrics.placedItems,missing:final.solution.unpackedItems.map(i=>i.id),valid:final.validation.valid,elapsedMs:final.elapsedMs}));process.send?.({type:'candidate-finish',trial:0});process.send?.({type:'research-finished',status:'bounded-four-long-zones-complete'})
}
