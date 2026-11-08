// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import type { CargoItem, Container, Orientation, PackingSolution, Position3D } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate } from '../core/research-metrics'
import { loadingRulesFor } from '../core/loading-profile'
import { createPackingSolution } from '../core/solution-builder'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, findPlacementPoints, updateContainer, volume } from '../core/packing-utils'
import { geometryFor, requiredClearance } from '../core/solid-geometry'
import { reconstructionColumns, reconstructionSourceKey } from '../core/reconstruction-decoder'
import { placeResearchItem } from '../core/research-placement'
import { superviseResearch } from './research-supervisor'
const output='data/optimization/v3-sku-repack';mkdirSync(output,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--child'],execArgv:['--import','tsx'],budgetMs:120000,candidateWallLimitMs:39000,inheritOutput:true});writeFileSync(`${output}/supervision.json`,JSON.stringify(supervision,null,2))}else{
 const begin=Date.now(),deadline=begin+115000,cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),{items,config}=cal,input='data/optimization/v3-macro-repack/best-partial.json',source=JSON.parse(readFileSync(input,'utf8')).solution as PackingSolution
 writeFileSync(`${output}/source-snapshot.json`,JSON.stringify({input,sha256:researchFileHash(input),solution:source}))
 const provenance={...researchCalibrationProvenance(cal),inputSha256:researchFileHash(input),scriptSha256:researchFileHash('src/scripts/research-v3-sku-repack.ts'),engineFiles:['src/core/reconstruction-decoder.ts','src/core/research-placement.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts'].map(path=>({path,sha256:researchFileHash(path)})),cpu:cpus()[0]?.model,command:'node --import tsx src/scripts/research-v3-sku-repack.ts',startedAt:new Date().toISOString()}
 const sheet=(i:CargoItem)=>String(i.rawData._sourceSheet),row=(i:CargoItem)=>Number(i.rawData._sourceRow),used=(cs:Container[])=>new Set(cs.flatMap(c=>c.items.map(p=>p.item.id)))
 type Column=ReturnType<typeof reconstructionColumns>[number]
 function anchors(c:Container,col:Column,rotation:number,roof:boolean):Position3D[]{
  const d=calculateActualDimensions(col.units[0].dimensions,col.orientation,rotation,col.units[0].orientationVerticalAxes),points:Position3D[]=findPlacementPoints(c).filter(p=>roof?p.z>0:true).map(p=>({...p})),seen=new Set<string>()
  if(!roof)for(const x of[0,c.dimensions.length-d.length])for(const y of[0,c.dimensions.width-d.width])points.push({x,y,z:0})
  const faces=c.items.flatMap(p=>geometryFor(p).top.map(f=>({...f,host:p})))
  for(const f of faces){const z=f.z+(c.loadingRules?.supportGapMm??0);for(const x of[f.minX,f.maxX-d.length,(f.minX+f.maxX-d.length)/2])for(const y of[f.minY,f.maxY-d.width,(f.minY+f.maxY-d.width)/2])points.push({x,y,z})}
  // Candidate centres spanning two coplanar real top faces. Common geometry checks every actual support.
  if(roof)for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){const a=faces[i],b=faces[j];if(Math.abs(a.z-b.z)>1e-6||a.host===b.host)continue;const minX=Math.min(a.minX,b.minX),maxX=Math.max(a.maxX,b.maxX),minY=Math.min(a.minY,b.minY),maxY=Math.max(a.maxY,b.maxY);if(maxX-minX>d.length*2||maxY-minY>d.width*2)continue;points.push({x:(minX+maxX-d.length)/2,y:(minY+maxY-d.width)/2,z:a.z+(c.loadingRules?.supportGapMm??0)})}
  if(!roof)for(const host of c.items){const p=host.position,q=host.actualDimensions,gap=requiredClearance(host.item,col.units[0],c);for(const [x,y]of[[p.x+q.length+gap,p.y],[p.x-d.length-gap,p.y],[p.x,p.y+q.width+gap],[p.x,p.y-d.width-gap],[p.x+q.length-d.length,p.y+q.width+gap]])points.push({x,y,z:0})}
  return points.filter(p=>{const k=`${p.x}/${p.y}/${p.z}`;if(seen.has(k)||p.x<0||p.y<0||p.x+d.length>c.dimensions.length+1e-6||p.y+d.width>c.dimensions.width+1e-6||p.z+col.dimensions.height>2500+1e-6)return false;seen.add(k);return true}).sort((a,b)=>a.z-b.z||a.x-b.x||a.y-b.y)
 }
 function placeColumn(col:Column,c:Container,until:number,roof:boolean,floorOnly=false):boolean{
  if(c.totalWeight+col.units.reduce((s,i)=>s+i.weight,0)>c.maxWeight)return false
  for(const yaw of[0,90]){const rotation=(col.rotation+yaw)%360
   for(const position of anchors(c,col,rotation,roof)){if(Date.now()>=until)return false;if(floorOnly&&position.z!==0)continue
    const staged:Container={...c,items:[...c.items]};let good=true
    for(const [j,item]of col.units.entries()){const p={...position,z:position.z+j*(col.unitHeight+(c.loadingRules?.supportGapMm??0))};if(!canPlaceAt(item,p,col.orientation,rotation,staged)){good=false;break}staged.items.push({item,position:p,orientation:col.orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,col.orientation,rotation,item.orientationVerticalAxes)});updateContainer(staged)}
    if(good){c.items=staged.items;updateContainer(c);return true}
   }
  }return false
 }
 function column(units:CargoItem[],orientation:Orientation):Column{const d=calculateActualDimensions(units[0].dimensions,orientation,0,units[0].orientationVerticalAxes);return{units,orientation,rotation:0,unitHeight:d.height,dimensions:{...d,height:units.length*d.height+(units.length-1)*5}}}
 let bestLoaded=0
 for(let trial=0;trial<3&&Date.now()<deadline;trial++){
  process.send?.({type:'candidate-start',trial});const t=Date.now(),until=Math.min(deadline,t+35000),moves:unknown[]=[],stageCounts:unknown[]=[]
  const containers=source.containers.map(c=>{const x=structuredClone(c);x.items=x.items.filter(p=>sheet(p.item)==='玻璃架'||sheet(p.item)==='门窗'&&[23,25,16,9].includes(row(p.item))||sheet(p.item)==='辅材'&&(p.item.constraints?.mustBeOnFloor||p.item.weight>600));x.loadingRules=loadingRulesFor(items,config);updateContainer(x);return x})
  let ids=used(containers),pool=items.filter(i=>!ids.has(i.id)),mandatory=containers.reduce((s,c)=>s+c.items.length,0)
  const bins=()=>[...containers].sort((a,b)=>trial%2?a.volumeUtilization-b.volumeUtilization:b.volumeUtilization-a.volumeUtilization)
  const record=(stage:string)=>{ids=used(containers);pool=items.filter(i=>!ids.has(i.id));stageCounts.push({stage,loaded:ids.size,missing:pool.length,elapsedMs:Date.now()-t})}
  // Preserve 39 source W07 positions and add the seven missing floor-only doors first.
  for(const item of pool.filter(i=>sheet(i)==='门窗'&&row(i)===9))for(const c of bins()){const col=column([item],'lying');if(placeColumn(col,c,Math.min(until,t+2500,Date.now()+180),false,true)){moves.push({stage:'W07-first',ids:[item.id],target:c.id});break}}
  record('W07-first')
  // Roof capacity is spent on full load-limited batches of heavy sashes before small windows.
  for(const sku of trial===1?[17,20]:[20,17]){
   let pending=pool.filter(i=>sheet(i)==='门窗'&&row(i)===sku),max=trial===2?3:sku===20?4:5
   while(pending.length&&Date.now()<Math.min(until,t+12500)){
    let placed=0
    for(let n=Math.min(max,pending.length);n>0&&!placed;n--)for(const c of bins()){
     const currentLoads=analyzeStacking(c.items,c.loadingRules).topLoads;const rackCapacity=Math.max(0,...c.items.map((p,i)=>sheet(p.item)==='玻璃架'?600-currentLoads[i]:0));if(rackCapacity+1e-6<n*pending[0].weight)continue
     if(placeColumn(column(pending.slice(0,n),'flat'),c,Math.min(until,t+12500,Date.now()+180),true)){moves.push({stage:`roof-${sku}`,ids:pending.slice(0,n).map(i=>i.id),target:c.id});placed=n;break}
    }
    if(!placed)break;pending=pending.slice(placed)
   }record(`roof-${sku}`)
  }
  // W01 sash columns have two lying source units per floor footprint, rather than spending racks.
  const w01=pool.filter(i=>sheet(i)==='门窗'&&row(i)===22)
  for(let k=0;k<w01.length&&Date.now()<until;k+=2){const col=column(w01.slice(k,k+2),'lying');for(const c of bins())if(placeColumn(col,c,Math.min(until,Date.now()+200),false,true)){moves.push({stage:'W01-two-lying',ids:col.units.map(i=>i.id),target:c.id});break}}
  record('W01-two-lying')
  const groups=new Map<string,CargoItem[]>();for(const item of pool)groups.set(reconstructionSourceKey(item),[...(groups.get(reconstructionSourceKey(item))??[]),item])
  const ordered=[...groups.values()].sort((a,b)=>Number(sheet(a[0])==='辅材')-Number(sheet(b[0])==='辅材')||Math.max(...Object.values(b[0].dimensions))-Math.max(...Object.values(a[0].dimensions))||b.reduce((s,i)=>s+volume(i.dimensions),0)-a.reduce((s,i)=>s+volume(i.dimensions),0))
  for(const units of ordered){if(Date.now()>=until)break;const columns=reconstructionColumns(units,config,trial===1?'height':'mixed')
   for(const col of columns){if(Date.now()>=until)break;for(const c of bins())if(placeColumn(col,c,Math.min(until,Date.now()+160),false)){moves.push({stage:'DP-source-column',ids:col.units.map(i=>i.id),orientation:col.orientation,target:c.id});break}}
  }record('DP-source-columns')
  // Only the remaining small pieces use a single-unit cavity/boundary pass.
  for(const item of pool.filter(i=>sheet(i)==='辅材'||volume(i.dimensions)<2e8)){if(Date.now()>=until)break;for(const c of bins()){const p=placeResearchItem(item,c,trial+3,Math.min(until,Date.now()+100));if(p){c.items.push(p);updateContainer(c);moves.push({stage:'small-cavity-fill',ids:[item.id],target:c.id,position:p.position,orientation:p.orientation,rotation:p.rotation});break}}}
  record('small-cavity-fill')
  const solution=createPackingSolution(containers,pool,`V3-SKU-ROOF-COLUMN-REPACK-${trial}`,0,Date.now()-t),assess=assessResearchCandidate(solution,items,config),bySource=pool.reduce<Record<string,number>>((a,i)=>{const k=reconstructionSourceKey(i);a[k]=(a[k]??0)+1;return a},{}),result={provenance,config,solution,validation:assess.validation,metrics:assess.metrics,record:{trial,mandatory,stageCounts,moves,unpackedBySource:bySource,elapsedMs:Date.now()-t,accepted:assess.metrics.eligible&&assess.metrics.totalContainers<=11}}
  appendFileSync(`${output}/ledger.jsonl`,JSON.stringify({...result.record,metrics:assess.metrics,validation:assess.validation,provenance})+'\n');writeFileSync(`${output}/candidate-${trial}.json`,JSON.stringify(result,null,2))
  if(assess.validation.valid&&assess.metrics.placedItems>bestLoaded){bestLoaded=assess.metrics.placedItems;writeFileSync(`${output}/best-partial.json`,JSON.stringify(result,null,2))}if(result.record.accepted)writeFileSync(`${output}/best-complete.json`,JSON.stringify(result,null,2))
  console.log(JSON.stringify({trial,loaded:assess.metrics.placedItems,missing:pool.length,valid:assess.validation.valid,accepted:result.record.accepted,stageCounts,elapsedMs:result.record.elapsedMs}));process.send?.({type:'candidate-finish',trial});if(result.record.accepted)break
 }
 process.send?.({type:'research-finished',status:'bounded-sku-roof-columns-complete'})
}
