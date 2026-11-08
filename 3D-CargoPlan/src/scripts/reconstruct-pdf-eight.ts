// #created 11/08/2026
import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {superviseResearch} from './research-supervisor'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {reconstructionColumns} from '../core/reconstruction-decoder'
import {createEmptyContainer} from '../core/greedy-algorithm'
import {calculateActualDimensions,canPlaceAt,updateContainer} from '../core/packing-utils'
import {createPackingSolution} from '../core/solution-builder'
import {validateSolution} from '../core/validation'
import {researchHash} from '../core/research-metrics'
import type {CargoItem,Orientation,Position3D} from '../types/packing'

const output=resolve('delivery-output/reconstruction/pdf-eight-maxrects')
mkdirSync(output,{recursive:true})
if(!process.send){
  const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--worker'],execArgv:['--import','tsx'],budgetMs:55000,inheritOutput:true})
  writeFileSync(resolve(output,'supervision.json'),JSON.stringify(supervision,null,2))
}else{
  const calibration=loadResearchCalibration('data/reconstruction/model-v2-contract.json'),ids=calibration.pdfAllocation.find(c=>c.containerNumber===8)!.ids,items=ids.map(id=>calibration.items.find(i=>i.id===id)!),config=calibration.config,start=Date.now(),deadline=start+52000
  const engineFiles=['src/scripts/reconstruct-pdf-eight.ts','src/core/reconstruction-decoder.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts','src/core/loading-profile.ts'].map(path=>({path,sha256:researchFileHash(path)}))
  const provenance={...researchCalibrationProvenance(calibration),engineFiles,engineSha256:researchHash(engineFiles),seed:20261017,assignment:'original PDF container 8 only',rules:'unchanged calibrated v2 common placement and independent validator'}
  const source=(row:number)=>items.filter(i=>i.rawData._sourceRow===row)
  type PlacementUnit={item:CargoItem;position:Position3D;orientation:Orientation;rotation:number}
  type Rect={id:string;length:number;width:number;units:PlacementUnit[];noise:number}
  type Free={x:number;y:number;l:number;w:number}
  const r20=source(20),bridgeUnits:PlacementUnit[]=[]
  for(let i=0;i<13;i++)bridgeUnits.push({item:r20[i],position:{x:0,y:i*115,z:0},orientation:'lying',rotation:0})
  for(let i=0;i<7;i++)bridgeUnits.push({item:r20[13+i],position:{x:0,y:0,z:1589.5+i*115},orientation:'flat',rotation:0})
  // These two 1530-high W03s fit below the overhang, without supporting the upper W06s.
  for(let i=0;i<2;i++)bridgeUnits.push({item:source(5)[i],position:{x:i*1335,y:1495,z:0},orientation:'lying',rotation:0})
  const bridge:Rect={id:'13-lying-supports-7-flat-plus-2-under-overhang',length:2665,width:1615,units:bridgeUnits,noise:0}
  const consumed=new Set(bridgeUnits.map(p=>p.item.id)),groups=new Map<number,CargoItem[]>()
  for(const i of items.filter(i=>!consumed.has(i.id)&&i.rawData._sourceRow!==8))groups.set(Number(i.rawData._sourceRow),[...(groups.get(Number(i.rawData._sourceRow))??[]),i])
  const rectangles:Rect[]=[bridge]
  for(const units of groups.values())for(const c of reconstructionColumns(units,config,'mixed'))rectangles.push({id:c.units[0].id,length:c.dimensions.length,width:c.dimensions.width,noise:0,units:c.units.map((item,i)=>({item,position:{x:0,y:0,z:i*(c.unitHeight+5)},orientation:c.orientation,rotation:c.rotation}))})
  const fit=(rects:Rect[],heuristic:number)=>{
    let frees:Free[]=[{x:0,y:0,l:11605,w:2255}];const placements:{rect:Rect;x:number;y:number;yaw:number}[]=[]
    for(const rect of rects){
      let best:{x:number;y:number;l:number;w:number;yaw:number;score:number;secondary:number}|undefined
      for(const f of frees)for(const yaw of rect.id===bridge.id?[0]:[0,90]){
        const l=(yaw?rect.width:rect.length)+5,w=(yaw?rect.length:rect.width)+5
        if(l>f.l+1e-6||w>f.w+1e-6)continue
        const dl=f.l-l,dw=f.w-w,score=heuristic===0?Math.min(dl,dw):heuristic===1?f.l*f.w-l*w:heuristic===2?Math.max(dl,dw):f.y+w,secondary=heuristic===3?f.x:Math.max(dl,dw)
        if(!best||score<best.score-1e-6||Math.abs(score-best.score)<1e-6&&secondary<best.secondary)best={x:f.x,y:f.y,l,w,yaw,score,secondary}
      }
      if(!best)return {placements,complete:false}
      placements.push({rect,x:best.x,y:best.y,yaw:best.yaw})
      const b=best,next:Free[]=[]
      for(const f of frees){if(b.x>=f.x+f.l-1e-6||b.x+b.l<=f.x+1e-6||b.y>=f.y+f.w-1e-6||b.y+b.w<=f.y+1e-6){next.push(f);continue}if(b.x>f.x)next.push({...f,l:b.x-f.x});if(b.x+b.l<f.x+f.l)next.push({x:b.x+b.l,y:f.y,l:f.x+f.l-b.x-b.l,w:f.w});if(b.y>f.y)next.push({...f,w:b.y-f.y});if(b.y+b.w<f.y+f.w)next.push({x:f.x,y:b.y+b.w,l:f.l,w:f.y+f.w-b.y-b.w})}
      frees=next.filter((f,i)=>f.l>0&&f.w>0&&!next.some((g,j)=>i!==j&&g.x<=f.x&&g.y<=f.y&&g.x+g.l>=f.x+f.l&&g.y+g.w>=f.y+f.w&&(j<i||g.l*g.w>f.l*f.w)))
    }
    return {placements,complete:true}
  }
  let state=20261017,best=0,bestUnits=0,parentStop=0,trial=0,complete=false,bestOrder:Rect[]=[]
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
  for(;trial<800000&&Date.now()<deadline&&!complete;trial++){
    const heuristic=trial%4,mode=Math.floor(trial/4)%6
    let ordered=rectangles.map(r=>({...r,noise:random()})).sort((a,b)=>{
      if(mode===0)return b.length*b.width-a.length*a.width
      if(mode===1)return Math.max(b.length,b.width)-Math.max(a.length,a.width)||b.width-a.width
      if(mode===2)return a.noise-b.noise
      if(mode===3)return b.length*b.width*(0.6+b.noise)-a.length*a.width*(0.6+a.noise)
      if(mode===4)return Number(b.id===bridge.id)-Number(a.id===bridge.id)||b.length-a.length||b.width-a.width
      return Math.min(b.length,b.width)-Math.min(a.length,a.width)||b.length-a.length
    })
    if(bestOrder.length&&trial%3!==0){ordered=[...bestOrder];const moves=1+Math.floor(random()*4);for(let m=0;m<moves;m++){const from=m===0?parentStop:Math.floor(random()*ordered.length),to=Math.floor(random()*ordered.length),[value]=ordered.splice(Math.min(from,ordered.length-1),1);ordered.splice(to,0,value)}}
    else if(trial%2===0){const index=ordered.findIndex(r=>r.id===bridge.id);ordered.unshift(...ordered.splice(index,1))}
    const layout=fit(ordered,heuristic)
    const unitsFit=layout.placements.reduce((s,p)=>s+p.rect.units.length,0)
    if(unitsFit>bestUnits){best=layout.placements.length;bestUnits=unitsFit;bestOrder=ordered;parentStop=best;writeFileSync(resolve(output,'best-2d-partial.json'),JSON.stringify({trial,fit:best,unitsFit,ordered:ordered.map(r=>r.id),layout,provenance},null,2));console.log(JSON.stringify({trial,rectangles:rectangles.length,fit:best,unitsFit,elapsedMs:Date.now()-start}))}
    else if(unitsFit>=bestUnits-1&&random()<0.15){bestOrder=ordered;parentStop=layout.placements.length}
    if(!layout.complete)continue
    const container=createEmptyContainer(0,config,items);container.id='pdf-container-8'
    let accepted=true
    const add=(item:CargoItem,p:Position3D,orientation:Orientation,rotation:number)=>{if(!canPlaceAt(item,p,orientation,rotation,container))return false;container.items.push({item,position:p,orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)});updateContainer(container);return true}
    for(const p of layout.placements){for(const unit of p.rect.units){const position=p.yaw?{x:p.x+p.rect.width-unit.position.y-calculateActualDimensions(unit.item.dimensions,unit.orientation,unit.rotation,unit.item.orientationVerticalAxes).width,y:p.y+unit.position.x,z:unit.position.z}:{x:p.x+unit.position.x,y:p.y+unit.position.y,z:unit.position.z};if(!add(unit.item,position,unit.orientation,(unit.rotation+p.yaw)%360)){accepted=false;break}}if(!accepted)break}
    if(!accepted){appendFileSync(resolve(output,'attempts.jsonl'),JSON.stringify({trial,layoutComplete:true,accepted:false})+'\n');continue}
    const w05=source(8),hosts=container.items.filter(p=>p.item.rawData._sourceRow===16);let index=0
    for(const host of hosts){for(let lane=0;lane<2&&index<w05.length;lane++)for(let layer=0;layer<4&&index<w05.length;layer++){if(add(w05[index],{x:host.position.x+920+lane*535,y:host.position.y+5,z:185+layer*535},'lying',0))index++}}
    const loaded=new Set(container.items.map(p=>p.item.id)),solution=createPackingSolution([container],items.filter(i=>!loaded.has(i.id)),'PDF8-MULTIBASE-MAXRECTS',0,Date.now()-start),validation=validateSolution(solution,items,config)
    complete=validation.valid&&solution.unpackedItems.length===0
    appendFileSync(resolve(output,'attempts.jsonl'),JSON.stringify({trial,layoutComplete:true,accepted:true,complete,loaded:loaded.size,errors:validation.errors})+'\n')
    if(complete){writeFileSync(resolve(output,'result.json'),JSON.stringify({sourceContainerNumber:8,sourceIds:ids,complete,config,solution,validation,provenance,construction:{bridge:'13 lying supports, 7 flat above, common rules unchanged',trial,heuristic,mode,rectangleOrder:ordered.map(r=>r.id)},attemptsPath:resolve(output,'attempts.jsonl')},null,2));console.log(JSON.stringify({event:'complete',trial,loaded:loaded.size,elapsedMs:Date.now()-start}))}
  }
  writeFileSync(resolve(output,'summary.json'),JSON.stringify({trial,bestRectanglesFit:best,totalRectangles:rectangles.length,complete,elapsedMs:Date.now()-start,provenance},null,2));process.send({type:'research-finished',status:Date.now()>=deadline?'budget-exhausted':'trial-limit'})
}
