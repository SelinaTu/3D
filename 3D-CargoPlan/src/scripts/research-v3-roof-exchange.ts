// #created 11/08/2026
import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { CargoItem, Container, PlacedItem } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { canPlaceAt, calculateActualDimensions, updateContainer } from '../core/packing-utils'
import { loadingRulesFor } from '../core/loading-profile'
import { pairGeometryErrors, contactRectangles, unionArea, supportGap } from '../core/solid-geometry'
import { createPackingSolution } from '../core/solution-builder'
import { validateSolution } from '../core/validation'
import { placeResearchItem } from '../core/research-placement'
const input = 'data/optimization/v3-repair-11/best-partial.json', bytes = readFileSync(input), original = JSON.parse(bytes.toString()), cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json'), output = 'data/optimization/v3-roof-exchange', started = Date.now(), deadline = started + 25000
mkdirSync(output, { recursive: true })
const base: Container[] = structuredClone(original.solution.containers)
for (const c of base) { c.loadingRules = loadingRulesFor(cal.items, cal.config); updateContainer(c) }
const rackCount = base.flatMap(c => c.items).filter(p => p.item.rawData._sourceSheet === '玻璃架').length
if (rackCount !== 30) throw new Error(`Expected all 30 racks, got ${rackCount}`)
let bestLoaded = base.reduce((n,c) => n+c.items.length,0)
const provenance = { ...researchCalibrationProvenance(cal), input, inputSha256: createHash('sha256').update(bytes).digest('hex'), sourceEngineSha256: createHash('sha256').update(readFileSync('src/scripts/research-v3-roof-exchange.ts')).digest('hex'), budgetMs: 115000 }
for (let trial = 0; trial < 2 && Date.now() < deadline; trial++) {
  const t0 = Date.now(), until = Math.min(deadline, t0 + 11000), containers = structuredClone(base), tail = containers[10], removed: {id:string; source:number; reason:string}[] = [], moves: unknown[] = [], rejected: unknown[] = []
  const remove = (bi:number,p:PlacedItem,reason:string) => { containers[bi].items = containers[bi].items.filter(q=>q.item.id!==p.item.id); removed.push({id:p.item.id,source:bi+1,reason}); updateContainer(containers[bi]) }
  const roofs = trial < 2 ? [{ x:2768,y:0,z:1598 }] : [{x:0,y:0,z:1328},{x:2768,y:0,z:1598}]
  const floorUnits = containers.flatMap((c,bi)=>c.items.filter(p=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===20&&p.position.z===0&&!c.items.some(u=>u.position.z>0&&unionArea(contactRectangles(u,p,supportGap(u.item,p.item,c)))>1e-6)).map(p=>({bi,p}))).sort((a,b)=> ([9,6,5,7,3].indexOf(a.bi)+5)%5-([9,6,5,7,3].indexOf(b.bi)+5)%5)
  const missingW06 = cal.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===20&&!containers.some(c=>c.items.some(p=>p.item.id===i.id)))
  let floorIndex=0,missingIndex=0
  for (const roof of roofs) {
    const batch: CargoItem[]=[]
    for(let j=0;j<4;j++) {
      if(j<trial%3&&missingW06[missingIndex])batch.push(missingW06[missingIndex++]);else{const e=floorUnits[floorIndex++];if(e){batch.push(e.p.item);remove(e.bi,e.p,'relocate narrow floor W06 sash to newly freed glass-rack roof')}}
    }
    if(batch.length!==4)break
    const d=calculateActualDimensions(batch[0].dimensions,'flat',0,batch[0].orientationVerticalAxes)
    const examples=batch.map((item,j)=>({item,position:{...roof,z:roof.z+j*115},orientation:'flat' as const,rotation:0,actualDimensions:d}))
    for(const p of [...tail.items])if(p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===22&&examples.some(q=>pairGeometryErrors(q,p,tail).length))remove(10,p,'W01 sash roof collision removed for approved roof exchange')
    let removedUpper = true
    while (removedUpper) { removedUpper = false; for (const p of [...tail.items]) if (p.position.z > 0 && base[10].items.some(q => removed.some(r => r.id === q.item.id) && unionArea(contactRectangles(p,q,supportGap(p.item,q.item,tail))) > 1e-6)) { remove(10,p,'dependent cargo above removed roof item'); removedUpper = true } }
    for(const p of examples){if(canPlaceAt(p.item,p.position,p.orientation,p.rotation,tail)){tail.items.push(p);updateContainer(tail);moves.push({id:p.item.id,target:11,position:p.position,orientation:p.orientation,rotation:p.rotation,reason:'roof exchange'})}else rejected.push({id:p.item.id,position:p.position,errors:tail.items.flatMap(q=>pairGeometryErrors(p,q,tail))})}
  }
  let used = new Set(containers.flatMap(c=>c.items.map(p=>p.item.id)))
  let pool=cal.items.filter(i=>!used.has(i.id))
  const isW01=(i:CargoItem)=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===22
  // A lying W01 column can carry one same-source 100kg sash (<120kg),
  // so prefer two-high 1590x110 columns before the one-high 1060x110 remainder.
  for (const e of floorUnits.slice(0,floorIndex)) {
    const c=containers[e.bi], units=pool.filter(isW01).filter(i=>!used.has(i.id))
    for (const [j,item] of units.slice(0,2).entries()) {
      const position={...e.p.position,z:j*1065}, actualDimensions=calculateActualDimensions(item.dimensions,'lying',0,item.orientationVerticalAxes)
      if(canPlaceAt(item,position,'lying',0,c)){c.items.push({item,position,orientation:'lying',rotation:0,actualDimensions});updateContainer(c);used.add(item.id);moves.push({id:item.id,target:e.bi+1,position,orientation:'lying',rotation:0,reason:'two-high W01 narrow floor column'})}
    }
    const item=pool.filter(isW01).find(i=>!used.has(i.id));if(item){const position={x:e.p.position.x+1595,y:e.p.position.y,z:0},actualDimensions=calculateActualDimensions(item.dimensions,'standing',0,item.orientationVerticalAxes);if(canPlaceAt(item,position,'standing',0,c)){c.items.push({item,position,orientation:'standing',rotation:0,actualDimensions});updateContainer(c);used.add(item.id);moves.push({id:item.id,target:e.bi+1,position,orientation:'standing',rotation:0,reason:'W01 floor remainder beside two-high column'})}}
  }
  for(const pass of [0,1])for(const item of [...pool].sort((a,b)=>Number(isW01(b))-Number(isW01(a))||a.dimensions.length-b.dimensions.length)) {
    if(Date.now()>=until)break
    if(used.has(item.id))continue
    for(const bi of [9,6,5,3,4,7,8,0,1,2,10]){
      if(Date.now()>=until)break
      const c=containers[bi], p=placeResearchItem(item,c,isW01(item)?0:3+pass,Math.min(until,Date.now()+110))
      if(p){c.items.push(p);updateContainer(c);used.add(item.id);moves.push({id:item.id,target:bi+1,position:p.position,orientation:p.orientation,rotation:p.rotation,reason:isW01(item)?'W01 floor relocation':'residual insertion'});break}
    }
  }
  used = new Set(containers.flatMap(c=>c.items.map(p=>p.item.id)));pool=cal.items.filter(i=>!used.has(i.id))
  const solution=createPackingSolution(containers,pool,'V3-W01-W06-ROOF-EXCHANGE',0,Date.now()-t0), validation=validateSolution(solution,cal.items,cal.config),record={trial,roofs,removed,moves,rejected,loaded:used.size,missing:pool.map(i=>i.id),validation,elapsedMs:Date.now()-t0}
  appendFileSync(`${output}/ledger.jsonl`,JSON.stringify(record)+'\n')
  if(validation.valid){writeFileSync(`${output}/candidate-${trial}.json`,JSON.stringify({provenance,config:cal.config,solution,validation,complete:!pool.length,record},null,2));if(used.size>bestLoaded){bestLoaded=used.size;writeFileSync(`${output}/best-partial.json`,JSON.stringify({provenance,config:cal.config,solution,validation,complete:!pool.length,record},null,2))}}
  console.log(JSON.stringify({trial,loaded:used.size,removed:removed.length,missingW01:pool.filter(isW01).length,valid:validation.valid,errors:validation.errors.slice(0,2),elapsedMs:Date.now()-t0}))
}
writeFileSync(`${output}/summary.json`,JSON.stringify({provenance,rackCount,bestLoaded,elapsedMs:Date.now()-started},null,2))
