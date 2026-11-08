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
const output='data/optimization/v3-tail-aux-roof';mkdirSync(output,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--child'],execArgv:['--import','tsx'],budgetMs:60000,candidateWallLimitMs:20000,inheritOutput:true});writeFileSync(`${output}/supervision.json`,JSON.stringify(supervision,null,2))}else{
 const started=Date.now(),deadline=started+57000,cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),{items,config}=cal,input='data/optimization/v3-floor-orientation-repair-high/best-partial.json'
 let best=JSON.parse(readFileSync(input,'utf8')).solution as PackingSolution,bestLoaded=best.containers.reduce((s,c)=>s+c.items.length,0)
 const provenance={...researchCalibrationProvenance(cal),inputSha256:researchFileHash(input),scriptSha256:researchFileHash('src/scripts/research-v3-tail-aux-roof.ts'),engineFiles:['src/core/research-placement.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts'].map(path=>({path,sha256:researchFileHash(path)})),command:'node --import tsx src/scripts/research-v3-tail-aux-roof.ts',startedAt:new Date().toISOString()}
 writeFileSync(`${output}/source-snapshot.json`,JSON.stringify({input,provenance,solution:best}));writeFileSync(`${output}/executed-script.ts.txt`,readFileSync('src/scripts/research-v3-tail-aux-roof.ts'))
 const probeOriginal=structuredClone(best),probeAttempts:unknown[]=[],probeMoves:unknown[]=[]
 let probeError:string|undefined
 try{
  const tail=best.containers.find(c=>c.id==='repair-v3-11')!,windows=['门窗:W12:r15:u45','门窗:W12:r15:u46'],aux=tail.items.filter(p=>p.item.rawData._sourceSheet==='辅材'&&p.item.rawData._sourceRow===8).map(p=>p.item)
  if(aux.length!==16)throw Error('Expected 16 tail source-3 cartons')
  const sashIds=[35,36,37,38,39,40].map(n=>`门窗:W01:r22:u${n}`),sashes=best.containers.flatMap(c=>c.items).filter(p=>sashIds.includes(p.item.id)).map(p=>p.item)
  if(sashes.length!==6)throw Error('Expected three complete floor W01 sash pairs')
  const removed=new Set([...windows,...aux.map(i=>i.id),...sashIds])
  for(const c of best.containers){const before=c.items.filter(p=>removed.has(p.item.id));for(const p of before)probeMoves.push({id:p.item.id,from:c.id,before:{position:p.position,orientation:p.orientation,rotation:p.rotation}});c.items=c.items.filter(p=>!removed.has(p.item.id));updateContainer(c)}
  const put=(item:typeof items[number],position:{x:number;y:number;z:number},orientation:Orientation,rotation:number)=>{const accepted=canPlaceAt(item,position,orientation,rotation,tail);probeAttempts.push({id:item.id,position,orientation,rotation,accepted});if(!accepted)throw Error(`Canopy relocation rejected ${item.id}`);tail.items.push({item,position,orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)});updateContainer(tail)}
  for(const [j,id]of windows.entries())put(items.find(i=>i.id===id)!,{x:8389+j*155,y:0,z:1048},'lying',90)
  let n=0;for(const [y,count]of[[0,6],[615,6],[1230,4]])for(let j=0;j<count;j++)put(aux[n++],{x:8699,y,z:1048+j*215},'standing',0)
  sashes.forEach((item,j)=>put(item,{x:9459,y:0,z:1726+j*115},'flat',0))
  const assessed=assessResearchCandidate(best,items,config);if(!assessed.validation.valid)throw Error(JSON.stringify(assessed.validation.errors))
 }catch(error){probeError=String(error);best=probeOriginal}
 const probeAssessment=assessResearchCandidate(best,items,config)
 writeFileSync(`${output}/probe.json`,JSON.stringify({provenance,config,solution:best,metrics:probeAssessment.metrics,validation:probeAssessment.validation,probeAttempts,probeMoves,probeError,accepted:!probeError},null,2))
 console.log(JSON.stringify({event:'tail-aux-roof-probe',accepted:!probeError,error:probeError,loaded:bestLoaded,valid:probeAssessment.validation.valid}))
 if(probeError){process.send?.({type:'research-finished',status:'macro-rejected'});process.exit(0)}
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
 for(let trial=0;trial<3&&Date.now()<deadline;trial++){
  process.send?.({type:'candidate-start',trial});const start=Date.now(),until=Math.min(deadline,start+17500),moves:unknown[]=[],attempts:unknown[]=[];let working=structuredClone(best),added=0
  const missing=[...working.unpackedItems].sort((a,b)=>trial===1?Number(a.rawData._sourceRow===9)-Number(b.rawData._sourceRow===9):Number(a.rawData._sourceRow!==9)-Number(b.rawData._sourceRow!==9))
  for(const item of missing){if(Date.now()>=until)break;let accepted=false
   const order=trial===0?[5,6,7,...working.containers.map((_,i)=>i).filter(i=>![5,6,7].includes(i))]:trial===1?[6,3,...working.containers.map((_,i)=>i).filter(i=>i!==3&&i!==6)]:working.containers.map((_,i)=>i).reverse()
   for(const index of order){if(Date.now()>=until)break;const source=working.containers[index],orientation:Orientation=[9,16].includes(Number(item.rawData._sourceRow))?'lying':'standing',rotations=orientation==='lying'?[0]:[0,90]
    for(const rotation of rotations){const points=candidates(source,item,orientation,rotation)
    for(const anchor of points){if(Date.now()>=until)break;const containers=structuredClone(working.containers),c=containers[index],evicted=anchor.blocked.map(i=>c.items[i].item);c.items=c.items.filter((_,i)=>!anchor.blocked.includes(i));updateContainer(c)
     const position={x:anchor.x,y:anchor.y,z:0};if(!canPlaceAt(item,position,orientation,rotation,c))continue;c.items.push({item,position,orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)});updateContainer(c)
     const failures:string[]=[],reinsertion:unknown[]=[]
     for(const displaced of [...evicted].sort((a,b)=>b.weight-a.weight)){let placed=false;for(const target of [...containers].sort((a,b)=>trial%2?a.volumeUtilization-b.volumeUtilization:b.volumeUtilization-a.volumeUtilization)){const p=placeResearchItem(displaced,target,trial+3,Math.min(until,Date.now()+90));if(p){target.items.push(p);updateContainer(target);reinsertion.push({id:displaced.id,target:target.id,position:p.position,orientation:p.orientation,rotation:p.rotation});placed=true;break}}if(!placed)failures.push(displaced.id)}
     const record={item:item.id,target:c.id,position,orientation,rotation,evicted:evicted.map(i=>i.id),failedReinsertions:failures,reinsertion,accepted:!failures.length};attempts.push(record)
     if(!failures.length){working=createPackingSolution(containers,working.unpackedItems.filter(i=>i.id!==item.id),`V3-TAIL-AUX-ROOF-REPAIR-${trial}`,0,Date.now()-start);moves.push(record);added++;accepted=true;break}
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
