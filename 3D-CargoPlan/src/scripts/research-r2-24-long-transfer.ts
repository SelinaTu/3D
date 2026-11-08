// #created 11/08/2026
import fs from 'node:fs'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate } from '../core/research-metrics'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, updateContainer } from '../core/packing-utils'
import { nestedInside } from '../core/solid-geometry'
import { placeTwentyFourLongFrameMacro } from '../core/research-r2-24-long-frame-macro'
import type { PackingSolution, PlacedItem } from '../types/packing'

const input='data/optimization/v3-tail-independent/frozen-complete.json',out='data/optimization/v3-r2-eight-seed',cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),source=JSON.parse(fs.readFileSync(input,'utf8')),started=Date.now(),attempts:unknown[]=[]
fs.mkdirSync(out,{recursive:true})
const isLong=(p:PlacedItem)=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===23
const isThin=(p:PlacedItem)=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===25
for(const targetId of ['repair-v3-3','repair-v3-2','repair-v3-4'])for(const sourceLong of (source.solution as PackingSolution).containers.find(c=>c.id==='repair-v3-1')!.items.filter(isLong).filter(p=>p.orientation==='flat').sort((a,b)=>b.position.z-a.position.z)){
 if(Date.now()-started>110000)break
 const solution=structuredClone(source.solution) as PackingSolution,target=solution.containers.find(c=>c.id===targetId)!,tail=solution.containers.find(c=>c.id==='repair-v3-1')!,oldLong=target.items.filter(isLong),thin=target.items.filter(isThin),nested=target.items.filter(p=>!isLong(p)&&!isThin(p)).map(p=>({p,host:oldLong.find(l=>nestedInside(p,l))})).filter(a=>a.host)
 if(tail.items.some(p=>p.item.id!==sourceLong.item.id&&nestedInside(p,sourceLong)))continue
 target.items=target.items.filter(p=>!isLong(p)&&!isThin(p)&&!nested.some(n=>n.p.item.id===p.item.id));tail.items=tail.items.filter(p=>p.item.id!==sourceLong.item.id);updateContainer(target);updateContainer(tail)
 const oldBases=oldLong.filter(p=>p.orientation==='lying').sort((a,b)=>a.position.y-b.position.y),oldUpper=oldLong.filter(p=>p.orientation==='flat').sort((a,b)=>a.position.z-b.position.z||a.position.y-b.position.y)
 const macro=placeTwentyFourLongFrameMacro(target,[...oldBases.map(p=>p.item),sourceLong.item,...oldUpper.map(p=>p.item)])
 if(!macro.accepted){attempts.push({targetId,sourceLong:sourceLong.item.id,stage:'macro',rejection:macro.rejection});continue}
 for(const {p,host}of nested){const moved=target.items.find(q=>q.item.id===host!.item.id)!;p.position={x:p.position.x+moved.position.x-host!.position.x,y:p.position.y+moved.position.y-host!.position.y,z:p.position.z+moved.position.z-host!.position.z};target.items.push(p)}updateContainer(target)
 const transferErrors:string[]=[]
 for(const p of thin){let accepted=false;for(const destId of ['repair-v3-7','repair-v3-6']){const dest=solution.containers.find(c=>c.id===destId)!,col=dest.items.filter(isThin).sort((a,b)=>b.position.z-a.position.z)[0];if(!col)continue;const position={...col.position,z:col.position.z+col.actualDimensions.height+5};if(canPlaceAt(p.item,position,col.orientation,col.rotation,dest)){dest.items.push({...p,position,orientation:col.orientation,rotation:col.rotation,actualDimensions:calculateActualDimensions(p.item.dimensions,col.orientation,col.rotation,p.item.orientationVerticalAxes)});updateContainer(dest);accepted=true;break}}
  if(!accepted){transferErrors.push(p.item.id);break}}
 if(transferErrors.length){attempts.push({targetId,sourceLong:sourceLong.item.id,stage:'thin',unplaced:transferErrors,stack:solution.containers.filter(c=>['repair-v3-6','repair-v3-7'].includes(c.id)).map(c=>({id:c.id,errors:analyzeStacking(c.items,c.loadingRules).errors}))});continue}
 const assessment=assessResearchCandidate(solution,cal.items,cal.config),result={provenance:{...researchCalibrationProvenance(cal),input:{path:input,sha256:researchFileHash(input)},scriptSha256:researchFileHash('src/scripts/research-r2-24-long-transfer.ts')},config:cal.config,solution,validation:assessment.validation,metrics:assessment.metrics,move:{targetId,sourceLong:sourceLong.item.id,thinIds:thin.map(p=>p.item.id),translatedChildren:nested.length},elapsedMs:Date.now()-started}
 attempts.push({targetId,sourceLong:sourceLong.item.id,stage:'validation',valid:assessment.validation.valid,eligible:assessment.metrics.eligible,errors:assessment.validation.errors.slice(0,20),metrics:assessment.metrics})
 if(assessment.validation.valid&&assessment.metrics.complete){fs.writeFileSync(`${out}/complete-24-transfer.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({accepted:true,...result.move,metrics:assessment.metrics}));fs.writeFileSync(`${out}/transfer-attempts.json`,JSON.stringify(attempts,null,2));process.exit(0)}
}
fs.writeFileSync(`${out}/transfer-attempts.json`,JSON.stringify(attempts,null,2));console.log(JSON.stringify({accepted:false,attempts:attempts.length,elapsedMs:Date.now()-started,last:attempts.at(-1)}))
