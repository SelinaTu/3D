// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Container, Orientation, PackingSolution, PlacedItem } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate } from '../core/research-metrics'
import { calculateActualDimensions, canPlaceAt, analyzeStacking, updateContainer } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { placeResearchItem } from '../core/research-placement'
import { createPackingSolution } from '../core/solution-builder'
import { superviseResearch } from './research-supervisor'
const output='data/optimization/v3-floor-orientation-repair-high';mkdirSync(output,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--child'],execArgv:['--import','tsx'],budgetMs:18000,candidateWallLimitMs:8000,inheritOutput:true});writeFileSync(`${output}/supervision.json`,JSON.stringify(supervision,null,2))}else{
 const started=Date.now(),deadline=started+15500,cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),{items,config}=cal,input='data/optimization/v3-floor-orientation-repair/best-partial.json'
 let best=JSON.parse(readFileSync(input,'utf8')).solution as PackingSolution,bestLoaded=best.containers.reduce((s,c)=>s+c.items.length,0)
 const provenance={...researchCalibrationProvenance(cal),inputSha256:researchFileHash(input),scriptSha256:researchFileHash('src/scripts/research-v3-floor-orientation-repair-high.ts'),engineFiles:['src/core/research-placement.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts'].map(path=>({path,sha256:researchFileHash(path)})),command:'node --import tsx src/scripts/research-v3-floor-orientation-repair-high.ts',startedAt:new Date().toISOString()}
 writeFileSync(`${output}/source-snapshot.json`,JSON.stringify({input,provenance,solution:best}));writeFileSync(`${output}/executed-script.ts.txt`,readFileSync('src/scripts/research-v3-floor-orientation-repair-high.ts'))
 const conversions:unknown[]=[]
 for(let bi=0;bi<best.containers.length;bi++){
  const c=best.containers[bi],analysis=analyzeStacking(c.items,c.loadingRules)
  for(let pi=0;pi<c.items.length;pi++){
   const old=c.items[pi],r=Number(old.item.rawData._sourceRow)
   if(old.position.z!==0||old.orientation!=='lying'||old.item.rawData._sourceSheet!=='门窗'||![17,7,22].includes(r)||analysis.supports.some((links,i)=>i!==pi&&links.some(s=>s.index===pi)))continue
   const d=calculateActualDimensions(old.item.dimensions,'standing',old.rotation,old.item.orientationVerticalAxes),oldBounds=old.actualDimensions
   const anchors=[old.position,{...old.position,x:old.position.x+oldBounds.length-d.length},{...old.position,x:old.position.x+(oldBounds.length-d.length)/2}]
   let accepted=false
   for(const position of anchors){const staged={...c,items:c.items.filter((_,i)=>i!==pi)};updateContainer(staged)
    if(!canPlaceAt(old.item,position,'standing',old.rotation,staged))continue
    const before=c.items[pi];c.items[pi]={...old,position,orientation:'standing',actualDimensions:d};updateContainer(c)
    const assessed=assessResearchCandidate(best,items,config)
    if(assessed.validation.valid){conversions.push({id:old.item.id,container:c.id,before:{position:old.position,orientation:old.orientation,rotation:old.rotation,dimensions:old.actualDimensions},after:{position,orientation:'standing',rotation:old.rotation,dimensions:d},valid:true});accepted=true;break}
    c.items[pi]=before;updateContainer(c)
   }
   if(!accepted)conversions.push({id:old.item.id,container:c.id,accepted:false,reason:'Standing anchors violate real geometry, loading, or dependent support; prior pose retained'})
  }
 }
 const conversionAssessment=assessResearchCandidate(best,items,config)
 writeFileSync(`${output}/converted-seed.json`,JSON.stringify({provenance,config,solution:best,metrics:conversionAssessment.metrics,validation:conversionAssessment.validation,conversions},null,2))
 console.log(JSON.stringify({event:'floor-orientation-conversions',accepted:conversions.filter((r)=>Boolean((r as {valid?:boolean}).valid)).length,attempted:conversions.length,loaded:bestLoaded,valid:conversionAssessment.validation.valid}))
 const fixed=(p:PlacedItem)=>p.item.rawData._sourceSheet==='玻璃架'||p.item.rawData._sourceSheet==='门窗'&&[16,23,25].includes(Number(p.item.rawData._sourceRow))||p.item.weight>600
 function candidates(c:Container,item:typeof items[number],orientation:Orientation,rotation:number){
  const d=calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes),xs=new Set([0,c.dimensions.length-d.length]),ys=new Set([0,c.dimensions.width-d.width])
  for(const p of c.items){if(p.position.z>d.height+5)continue;const q=p.position,a=p.actualDimensions;for(const x of[q.x,q.x+a.length+5,q.x-d.length-5])if(x>=0&&x+d.length<=11600)xs.add(x);for(const y of[q.y,q.y+a.width+5,q.y-d.width-5])if(y>=0&&y+d.width<=2250)ys.add(y)}
  const stack=analyzeStacking(c.items,c.loadingRules),ranked:{x:number;y:number;blocked:number[];cost:number}[]=[]
  for(const x of xs)for(const y of ys){if(Date.now()>=deadline)return ranked;const p={item,position:{x,y,z:0},orientation,rotation,actualDimensions:d},blocked:number[]=[];let impossible=false
   for(let i=0;i<c.items.length;i++){const a=c.items[i],b=a.position,e=a.actualDimensions;if(b.z>=d.height+5||x+d.length+5<b.x||b.x+e.length+5<x||y+d.width+5<b.y||b.y+e.width+5<y)continue;if(pairGeometryErrors(p,a,c).length){if(fixed(a)){impossible=true;break}blocked.push(i);if(blocked.length>4){impossible=true;break}}}
   if(impossible)continue;let changed=true;while(changed){changed=false;for(let i=0;i<c.items.length;i++)if(!blocked.includes(i)&&stack.supports[i]?.some(s=>blocked.includes(s.index))){if(fixed(c.items[i])){impossible=true;break}blocked.push(i);changed=true}if(blocked.length>6){impossible=true;break}}
   if(!impossible)ranked.push({x,y,blocked,cost:blocked.length+blocked.reduce((s,i)=>s+c.items[i].item.weight/1000,0)})
  }return ranked.sort((a,b)=>a.cost-b.cost||a.x-b.x||a.y-b.y).slice(0,120)
 }
 for(let trial=0;trial<2&&Date.now()<deadline;trial++){
  process.send?.({type:'candidate-start',trial});const start=Date.now(),until=Math.min(deadline,start+6500),moves:unknown[]=[],attempts:unknown[]=[];let working=structuredClone(best),added=0
  const missing=[...working.unpackedItems].sort((a,b)=>Number(a.rawData._sourceRow===9)-Number(b.rawData._sourceRow===9))
  for(const item of missing){if(Date.now()>=until)break;let accepted=false
   const order=trial===0?[5,6,7,...working.containers.map((_,i)=>i).filter(i=>![5,6,7].includes(i))]:trial===1?[6,3,...working.containers.map((_,i)=>i).filter(i=>i!==3&&i!==6)]:working.containers.map((_,i)=>i).reverse()
   for(const index of order){if(Date.now()>=until)break;const source=working.containers[index],orientation:Orientation=[9,16].includes(Number(item.rawData._sourceRow))?'lying':'standing',rotations=orientation==='lying'?[0]:[0,90]
    for(const rotation of rotations){const points=candidates(source,item,orientation,rotation)
    for(const anchor of points){if(Date.now()>=until)break;const containers=structuredClone(working.containers),c=containers[index],evicted=anchor.blocked.map(i=>c.items[i].item);c.items=c.items.filter((_,i)=>!anchor.blocked.includes(i));updateContainer(c)
     const position={x:anchor.x,y:anchor.y,z:0};if(!canPlaceAt(item,position,orientation,rotation,c))continue;c.items.push({item,position,orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)});updateContainer(c)
     const failures:string[]=[],reinsertion:unknown[]=[]
     for(const displaced of [...evicted].sort((a,b)=>b.weight-a.weight)){let placed=false;for(const target of [...containers].sort((a,b)=>trial%2?a.volumeUtilization-b.volumeUtilization:b.volumeUtilization-a.volumeUtilization)){const p=placeResearchItem(displaced,target,trial+3,Math.min(until,Date.now()+90));if(p){target.items.push(p);updateContainer(target);reinsertion.push({id:displaced.id,target:target.id,position:p.position,orientation:p.orientation,rotation:p.rotation});placed=true;break}}if(!placed)failures.push(displaced.id)}
     const record={item:item.id,target:c.id,position,orientation,rotation,evicted:evicted.map(i=>i.id),failedReinsertions:failures,reinsertion,accepted:!failures.length};attempts.push(record)
     if(!failures.length){working=createPackingSolution(containers,working.unpackedItems.filter(i=>i.id!==item.id),`V3-FLOOR-ORIENTATION-REPAIR-${trial}`,0,Date.now()-start);moves.push(record);added++;accepted=true;break}
    }if(accepted)break
    }if(accepted)break
   }
  }
  const assessed=assessResearchCandidate(working,items,config),record={trial,added,metrics:assessed.metrics,validation:assessed.validation,elapsedMs:Date.now()-start,moves,attempts,accepted:assessed.validation.valid&&assessed.metrics.placedItems>bestLoaded}
  appendFileSync(`${output}/ledger.jsonl`,JSON.stringify({provenance,...record})+'\n');writeFileSync(`${output}/candidate-${trial}.json`,JSON.stringify({provenance,config,solution:working,...record},null,2));if(record.accepted){best=working;bestLoaded=assessed.metrics.placedItems;writeFileSync(`${output}/best-partial.json`,JSON.stringify({provenance,config,solution:best,...record},null,2))}
  console.log(JSON.stringify({trial,added,loaded:assessed.metrics.placedItems,valid:assessed.validation.valid,accepted:record.accepted,attempts:attempts.length,elapsedMs:record.elapsedMs}));process.send?.({type:'candidate-finish',trial});if(!working.unpackedItems.length)break
 }
 process.send?.({type:'research-finished',status:'bounded-local-floor-ejection-complete'})
}
