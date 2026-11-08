// #created 11/08/2026
import fs from 'node:fs'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate } from '../core/research-metrics'
import { calculateActualDimensions, updateContainer } from '../core/packing-utils'
import { nestedInside } from '../core/solid-geometry'
import { placeTwentyFourLongFrameMacro } from '../core/research-r2-24-long-frame-macro'
import { placeTallLongFrameMacro } from '../core/research-long-frame-macro'
import type { PackingSolution, PlacedItem } from '../types/packing'

const input=process.argv[2]??'data/optimization/v3-tail-independent/frozen-complete.json',out='data/optimization/v3-r2-eight-seed',cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),source=JSON.parse(fs.readFileSync(input,'utf8')),started=Date.now()
const isLong=(p:PlacedItem)=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===23
const isThin=(p:PlacedItem)=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===25
const solution=structuredClone(source.solution) as PackingSolution,target=solution.containers.find(c=>c.id==='repair-v3-3')!,tail=solution.containers.find(c=>c.id==='repair-v3-1')!,thinDest=solution.containers.find(c=>c.id==='repair-v3-7')!,oldLong=target.items.filter(isLong),oldTailLong=tail.items.filter(isLong),thin=target.items.filter(isThin),tailThin=tail.items.filter(isThin),thinDestOld=thinDest.items.filter(isThin),exported=oldTailLong.find(p=>p.orientation==='lying'&&p.position.y===860)!
const nested=[{c:target,hosts:oldLong},{c:tail,hosts:oldTailLong}].flatMap(({c,hosts})=>c.items.filter(p=>!isLong(p)&&!isThin(p)).map(p=>({p,host:hosts.find(l=>nestedInside(p,l))})).filter(a=>a.host))
for(const c of [target,tail]){c.items=c.items.filter(p=>!isLong(p)&&!isThin(p)&&!nested.some(n=>n.p.item.id===p.item.id));updateContainer(c)}
const bases=oldLong.filter(p=>p.orientation==='lying').sort((a,b)=>a.position.y-b.position.y),upper=oldLong.filter(p=>p.orientation==='flat').sort((a,b)=>a.position.z-b.position.z||a.position.y-b.position.y)
const targetMacro=placeTwentyFourLongFrameMacro(target,[...bases.map(p=>p.item),exported.item,...upper.map(p=>p.item)])
const tailBases=oldTailLong.filter(p=>p.orientation==='lying'&&p.item.id!==exported.item.id).sort((a,b)=>a.position.y-b.position.y),tailUpper=oldTailLong.filter(p=>p.orientation==='flat').sort((a,b)=>a.position.z-b.position.z||a.position.y-b.position.y)
const tailMacro=placeTallLongFrameMacro(tail,[...tailBases,...tailUpper].map(p=>p.item),[...tailThin,...thin.slice(4)].map(p=>p.item),{x:4469,y:0,z:0})
const diag={targetMacro:{accepted:targetMacro.accepted,rejection:targetMacro.rejection},tailMacro:{accepted:tailMacro.accepted,rejection:tailMacro.rejection}}
if(targetMacro.accepted&&tailMacro.accepted){
 for(const {p,host}of nested){const dest=[target,tail].find(c=>c.items.some(q=>q.item.id===host!.item.id))!,moved=dest.items.find(q=>q.item.id===host!.item.id)!;p.position={x:p.position.x+moved.position.x-host!.position.x,y:p.position.y+moved.position.y-host!.position.y,z:p.position.z+moved.position.z-host!.position.z};dest.items.push(p)}
 thinDest.items=thinDest.items.filter(p=>!isThin(p));for(const [i,p]of [...thinDestOld,...thin.slice(0,4)].entries())thinDest.items.push({...p,position:{x:0,y:1289,z:i*115},orientation:'flat',rotation:0,actualDimensions:calculateActualDimensions(p.item.dimensions,'flat',0,p.item.orientationVerticalAxes)})
 for(const c of [target,tail,thinDest])updateContainer(c)
}
const assessment=assessResearchCandidate(solution,cal.items,cal.config),result={provenance:{...researchCalibrationProvenance(cal),input:{path:input,sha256:researchFileHash(input)},scriptSha256:researchFileHash('src/scripts/research-r2-24-22-macro-exchange.ts')},config:cal.config,solution,validation:assessment.validation,metrics:assessment.metrics,diagnostic:diag,move:{exported:exported.item.id,thinToTail:thin.slice(4).map(p=>p.item.id),thinToFront:thin.slice(0,4).map(p=>p.item.id),translatedChildren:nested.length},elapsedMs:Date.now()-started}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/${assessment.validation.valid&&assessment.metrics.complete?'complete-macro-exchange':'macro-exchange-diagnostic'}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({valid:assessment.validation.valid,complete:assessment.metrics.complete,diagnostic:diag,errors:assessment.validation.errors.slice(0,30),metrics:assessment.metrics,elapsedMs:Date.now()-started}))
