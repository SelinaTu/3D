// #created 11/08/2026
import {createHash} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import type {Container} from '../types/packing'
import {loadResearchCalibration,researchCalibrationProvenance} from '../core/research-calibration'
import {loadingRulesFor} from '../core/loading-profile'
import {calculateActualDimensions,canPlaceAt,updateContainer} from '../core/packing-utils'
import {placeShortFrameCanopyMacro} from '../core/research-short-frame-macro'
import {placeResearchItem} from '../core/research-placement'
import {createPackingSolution} from '../core/solution-builder'
import {validateSolution} from '../core/validation'
const input='data/optimization/v3-macro-repack/best-partial.json',bytes=readFileSync(input),base=JSON.parse(bytes.toString()),cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),started=Date.now(),deadline=started+30000,output='data/optimization/v3-short-roof-exchange';mkdirSync(output,{recursive:true})
const containers:Container[]=structuredClone(base.solution.containers);for(const c of containers){c.loadingRules=loadingRulesFor(cal.items,cal.config);updateContainer(c)}
const shorts=containers[4].items.filter(p=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===21&&p.position.z>0).map(p=>p.item),shortIds=new Set(shorts.map(i=>i.id));containers[4].items=containers[4].items.filter(p=>!shortIds.has(p.item.id));updateContainer(containers[4])
const movedW06=containers[9].items.filter(p=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===20&&p.position.z===0).slice(0,4);const movedIds=new Set(movedW06.map(p=>p.item.id));containers[9].items=containers[9].items.filter(p=>!movedIds.has(p.item.id));updateContainer(containers[9])
const roofAttempts:unknown[]=[],macroAttempts:unknown[]=[]
for(const [j,old] of movedW06.entries()){const item=old.item,position={x:0,y:0,z:1089+j*115},d=calculateActualDimensions(item.dimensions,'flat',0,item.orientationVerticalAxes),accepted=canPlaceAt(item,position,'flat',0,containers[4]);roofAttempts.push({id:item.id,position,accepted});if(accepted){containers[4].items.push({item,position,orientation:'flat',rotation:0,actualDimensions:d});updateContainer(containers[4])}}
let acceptedMacro:unknown=null
for(const bi of [9,4,3,5,6,7,0,1,2,8,10]){
  const c=containers[bi], points: {x:number;y:number;rotation:0|90}[]=[],seen=new Set<string>()
  for(const rotation of [0,90] as const){const length=rotation?1674:2094,width=rotation?2094:1674;const add=(x:number,y:number)=>{if(x<0||y<0||x+length>11600||y+width>2250||bi===7&&x>=8740)return;const k=`${x}/${y}/${rotation}`;if(seen.has(k))return;seen.add(k);points.push({x,y,rotation})};for(const x of [0,11600-length])for(const y of [0,2250-width])add(x,y);for(const p of c.items){const q=p.actualDimensions;if(p.position.z===0&&q.height<1679)for(const x of [p.position.x,p.position.x+q.length-length,p.position.x+q.length+5-(rotation?782:0),p.position.x-115-(rotation?782:0)])for(const y of [0,2250-width,p.position.y-782,p.position.y+q.width+5-(rotation?0:782),p.position.y-115-(rotation?0:782)])add(x,y)}}
  for(const p of points){if(Date.now()>=deadline)break;const result=placeShortFrameCanopyMacro(c,shorts.slice(0,8),{x:p.x,y:p.y,z:0},p.rotation);macroAttempts.push({target:bi+1,...p,accepted:result.accepted,attempts:result.attempts,rejection:result.rejection});if(result.accepted){acceptedMacro={target:bi+1,...p,placements:result.placements.map(q=>({id:q.item.id,position:q.position,orientation:q.orientation,rotation:q.rotation})),baseLoadKg:result.baseLoadKg};break}}
  if(acceptedMacro||Date.now()>=deadline)break
}
let used=new Set(containers.flatMap(c=>c.items.map(p=>p.item.id)));const allMoves:unknown[]=[]
if(acceptedMacro)for(const item of cal.items.filter(i=>!used.has(i.id)).sort((a,b)=>Number(b.rawData._sourceRow===21)-Number(a.rawData._sourceRow===21))){if(Date.now()>=deadline)break;for(let bi=0;bi<11;bi++){const p=placeResearchItem(item,containers[bi],3,Math.min(deadline,Date.now()+100));if(p){containers[bi].items.push(p);updateContainer(containers[bi]);used.add(item.id);allMoves.push({id:item.id,target:bi+1,position:p.position,orientation:p.orientation,rotation:p.rotation});break}}}
used=new Set(containers.flatMap(c=>c.items.map(p=>p.item.id)));const solution=createPackingSolution(containers,cal.items.filter(i=>!used.has(i.id)),'V3-SHORT-FRAME-ROOF-EXCHANGE',0,Date.now()-started),validation=validateSolution(solution,cal.items,cal.config)
const provenance={...researchCalibrationProvenance(cal),input,inputSha256:createHash('sha256').update(bytes).digest('hex'),engineFiles:['src/scripts/research-v3-short-roof-exchange.ts','src/core/research-short-frame-macro.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))}
writeFileSync(`${output}/result.json`,JSON.stringify({provenance,config:cal.config,solution,validation,complete:!solution.unpackedItems.length,roofAttempts,acceptedMacro,macroAttempts,allMoves,elapsedMs:Date.now()-started},null,2));console.log(JSON.stringify({loaded:used.size,valid:validation.valid,errors:validation.errors.slice(0,2),macroAccepted:!!acceptedMacro,macroTrials:macroAttempts.length,elapsedMs:Date.now()-started}))
