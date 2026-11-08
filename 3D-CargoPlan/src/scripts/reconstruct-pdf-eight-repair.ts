// #created 11/08/2026
import {readFileSync,writeFileSync} from 'node:fs'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {createEmptyContainer} from '../core/greedy-algorithm'
import {calculateActualDimensions,canPlaceAt,updateContainer} from '../core/packing-utils'
import {createPackingSolution} from '../core/solution-builder'
import {validateSolution} from '../core/validation'
import {researchHash} from '../core/research-metrics'
import type {CargoItem,Orientation,Position3D} from '../types/packing'
import {superviseResearch} from './research-supervisor'

if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--worker'],execArgv:['--import','tsx'],budgetMs:7000,inheritOutput:true});writeFileSync('delivery-output/reconstruction/pdf-eight-maxrects/repair-supervision.json',JSON.stringify(supervision,null,2))}else{
const output='delivery-output/reconstruction/pdf-eight-maxrects',calibration=loadResearchCalibration('data/reconstruction/model-v2-contract.json'),ids=calibration.pdfAllocation.find(c=>c.containerNumber===8)!.ids,items=ids.map(id=>calibration.items.find(i=>i.id===id)!),config=calibration.config
type Unit={item:CargoItem;position:Position3D;orientation:Orientation;rotation:number}
type Rect={id:string;length:number;width:number;units:Unit[]}
type Position={rect:Rect;x:number;y:number;yaw:number}
type Box={x:number;y:number;l:number;w:number}
const baseline=JSON.parse(readFileSync(`${output}/best-2d-partial.json`,'utf8')),placed=baseline.layout.placements as Position[],start=Date.now(),limit=start+5000
const missing=baseline.ordered.filter((id:string)=>!placed.some(p=>p.rect.id===id)) as string[]
if(missing.length!==1)throw new Error('This bounded repair expects exactly one unplaced rectangle')
const source=items.find(i=>i.id===missing[0])!,unplaced:Rect={id:source.id,length:3030,width:120,units:[{item:source,position:{x:0,y:0,z:0},orientation:'lying',rotation:0}]}
const box=(p:Position):Box=>({x:p.x,y:p.y,l:(p.yaw?p.rect.width:p.rect.length)+5,w:(p.yaw?p.rect.length:p.rect.width)+5})
const overlap=(a:Box,b:Box)=>a.x<b.x+b.l-1e-6&&a.x+a.l>b.x+1e-6&&a.y<b.y+b.w-1e-6&&a.y+a.w>b.y+1e-6
function split(frees:Box[],b:Box){const next:Box[]=[];for(const f of frees){if(!overlap(f,b)){next.push(f);continue}if(b.x>f.x)next.push({...f,l:b.x-f.x});if(b.x+b.l<f.x+f.l)next.push({x:b.x+b.l,y:f.y,l:f.x+f.l-b.x-b.l,w:f.w});if(b.y>f.y)next.push({...f,w:b.y-f.y});if(b.y+b.w<f.y+f.w)next.push({x:f.x,y:b.y+b.w,l:f.l,w:f.y+f.w-b.y-b.w})}return next.filter((f,i)=>f.l>0&&f.w>0&&!next.some((g,j)=>i!==j&&g.x<=f.x&&g.y<=f.y&&g.x+g.l>=f.x+f.l&&g.y+g.w>=f.y+f.w&&(j<i||g.l*g.w>f.l*f.w)))}
const xs=new Set([0,8570]),ys=new Set([0,2130])
for(const p of placed){const b=box(p);for(const x of [b.x,b.x+b.l,b.x-3035,b.x+b.l-3035])if(x>=0&&x<=8570)xs.add(x);for(const y of [b.y,b.y+b.w,b.y-125,b.y+b.w-125])if(y>=0&&y<=2130)ys.add(y)}
let candidateLayout:Position[]|undefined,trials=0
let rng=20261017;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296}
outer:for(const x of xs)for(const y of ys){
  if(Date.now()>=limit)break outer
  trials++;const added={rect:unplaced,x,y,yaw:0},b=box(added),removed=placed.filter(p=>overlap(box(p),b))
  if(removed.length>6)continue
  const keep=placed.filter(p=>!removed.includes(p)),initialFree=[...keep,added].reduce((f,p)=>split(f,box(p)),[{x:0,y:0,l:11605,w:2255}])
  const orders=[removed,[...removed].reverse(),[...removed].sort((a,b)=>b.rect.length*b.rect.width-a.rect.length*a.rect.width),...Array.from({length:20},()=>removed.map(p=>({p,r:random()})).sort((a,b)=>a.r-b.r).map(x=>x.p))]
  for(const order of orders)for(const heuristic of [0,1]){
    let frees=initialFree;const replacements:Position[]=[]
    for(const p of order){let best:{p:Position;b:Box;score:number}|undefined;for(const f of frees)for(const yaw of [0,90]){const l=(yaw?p.rect.width:p.rect.length)+5,w=(yaw?p.rect.length:p.rect.width)+5;if(l>f.l+1e-6||w>f.w+1e-6)continue;const score=heuristic===0?Math.min(f.l-l,f.w-w):f.l*f.w-l*w;if(!best||score<best.score)best={p:{rect:p.rect,x:f.x,y:f.y,yaw},b:{x:f.x,y:f.y,l,w},score}}if(!best)break;replacements.push(best.p);frees=split(frees,best.b)}
    if(replacements.length===removed.length){candidateLayout=[...keep,added,...replacements];writeFileSync(`${output}/repaired-layout.json`,JSON.stringify({trials,elapsedMs:Date.now()-start,layout:{placements:candidateLayout},removed:removed.map(p=>p.rect.id),baselineSha256:researchFileHash(`${output}/best-2d-partial.json`)},null,2));break outer}
  }
}
const layout=candidateLayout??placed,container=createEmptyContainer(0,config,items);container.id='pdf-container-8'
const rejections:unknown[]=[]
const add=(item:CargoItem,p:Position3D,orientation:Orientation,rotation:number)=>{if(!canPlaceAt(item,p,orientation,rotation,container)){rejections.push({id:item.id,p,orientation,rotation});return false}container.items.push({item,position:p,orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)});updateContainer(container);return true}
for(const p of layout)for(const unit of p.rect.units){const d=calculateActualDimensions(unit.item.dimensions,unit.orientation,unit.rotation,unit.item.orientationVerticalAxes),position=p.yaw?{x:p.x+p.rect.width-unit.position.y-d.width,y:p.y+unit.position.x,z:unit.position.z}:{x:p.x+unit.position.x,y:p.y+unit.position.y,z:unit.position.z};add(unit.item,position,unit.orientation,(unit.rotation+p.yaw)%360)}
const w05=items.filter(i=>i.rawData._sourceRow===8),hosts=container.items.filter(p=>p.item.rawData._sourceRow===16);let index=0
for(const host of hosts)for(let lane=0;lane<2&&index<w05.length;lane++)for(let layer=0;layer<4&&index<w05.length;layer++)if(add(w05[index],{x:host.position.x+920+lane*535,y:host.position.y+5,z:185+layer*535},'lying',0))index++
const loaded=new Set(container.items.map(p=>p.item.id)),solution=createPackingSolution([container],items.filter(i=>!loaded.has(i.id)),'PDF8-FIXED-MULTIBASE-REPAIR',0,Date.now()-start),validation=validateSolution(solution,items,config),complete=validation.valid&&solution.unpackedItems.length===0
const engineFiles=['src/scripts/reconstruct-pdf-eight-repair.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts','src/core/loading-profile.ts'].map(path=>({path,sha256:researchFileHash(path)}))
writeFileSync(`${output}/result.json`,JSON.stringify({sourceContainerNumber:8,sourceIds:ids,config,solution,validation,complete,provenance:{...researchCalibrationProvenance(calibration),engineFiles,engineSha256:researchHash(engineFiles),seed:20261017,inputLayoutSha256:researchFileHash(`${output}/best-2d-partial.json`)},attempts:{repairCandidates:trials,elapsedMs:Date.now()-start,twoDComplete:!!candidateLayout,rejections},attemptsPath:`${output}/attempts.jsonl`},null,2))
console.log(JSON.stringify({complete,loaded:loaded.size,unpacked:solution.unpackedItems.map(i=>i.id),valid:validation.valid,errors:validation.errors,trials,elapsedMs:Date.now()-start,rejections:rejections.length}))
}
