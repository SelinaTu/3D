// #created 11/08/2026
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import type {Container,PlacedItem,CargoItem} from '../types/packing'
import {analyzeStacking,updateContainer} from '../core/packing-utils'
import {nestedInside} from '../core/solid-geometry'
import {loadResearchCalibration,researchFileHash,researchCalibrationProvenance} from '../core/research-calibration'
import {loadingRulesFor} from '../core/loading-profile'
import {createPackingSolution} from '../core/solution-builder'
import {validateSolution} from '../core/validation'

const out='data/optimization/v3-floor-bottleneck-audit',sourceDir='data/optimization/v3-window-cpsat/round-5',started=Date.now()
mkdirSync(out,{recursive:true})
const problem=JSON.parse(readFileSync(`${sourceDir}/problem.json`,'utf8')),source=JSON.parse(readFileSync(`${sourceDir}/input-snapshot.json`,'utf8')),cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),scale=Number(problem.scale),gap=Number(problem.gap),L=Number(problem.length)+gap,W=Number(problem.width)+gap
interface Rect{x0:number;y0:number;x1:number;y1:number}
interface Obstacle extends Rect{id:string;z0:number;z1:number}
const area=(rs:Rect[])=>rs.reduce((n,r)=>n+(r.x1-r.x0)*(r.y1-r.y0),0)/scale**2/1e6
function union(rs:Rect[],complement=false):Rect[]{
 const clipped=rs.map(r=>({x0:Math.max(0,r.x0),y0:Math.max(0,r.y0),x1:Math.min(L,r.x1),y1:Math.min(W,r.y1)})).filter(r=>r.x1>r.x0&&r.y1>r.y0),xs=[...new Set([0,L,...clipped.flatMap(r=>[r.x0,r.x1])])].sort((a,b)=>a-b),result:Rect[]=[]
 let active=new Map<string,Rect>()
 for(let i=0;i<xs.length-1;i++){
  const x0=xs[i],x1=xs[i+1],ys=clipped.filter(r=>r.x0<x1&&r.x1>x0).map(r=>[r.y0,r.y1]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),merged:number[][]=[]
  for(const [y0,y1] of ys){if(merged.length&&y0<=merged.at(-1)![1])merged.at(-1)![1]=Math.max(y1,merged.at(-1)![1]);else merged.push([y0,y1])}
  const intervals=complement?[] as number[][]:merged
  if(complement){let y=0;for(const [y0,y1]of merged){if(y0>y)intervals.push([y,y0]);y=y1}if(y<W)intervals.push([y,W])}
  const next=new Map<string,Rect>()
  for(const [y0,y1]of intervals){const key=`${y0}:${y1}`,previous=active.get(key),r=previous?.x1===x0?previous:{x0,y0,x1,y1};if(r!==previous)result.push(r);r.x1=x1;next.set(key,r)}
  active=next
 }
 return result
}
const inflated=(o:Obstacle):Rect=>({x0:o.x0,y0:o.y0,x1:o.x1+gap,y1:o.y1+gap})
const byId=new Map<string,{bin:number;p:PlacedItem}>((source.solution.containers as Container[]).flatMap((c,bin)=>c.items.map(p=>[p.item.id,{bin,p}] as const)))
const fullItems:CargoItem[]=[...(source.solution.containers as Container[]).flatMap(c=>c.items.map(p=>p.item)),...source.solution.unpackedItems]
const allLongs=fullItems.filter(i=>i.rawData._sourceSheet==='门窗'&&[9,16].includes(Number(i.rawData._sourceRow)))
const longEntries=problem.items.filter((i:{id:string})=>allLongs.some(item=>item.id===i.id)),variableIds=new Set(longEntries.map((i:{id:string})=>i.id)),fixedLongs=allLongs.filter(i=>!variableIds.has(i.id))
const minimumArea=(items:CargoItem[])=>items.reduce((sum,i)=>sum+(3030+gap/scale)*((Number(i.rawData._sourceRow)===16?160:120)+gap/scale)/1e6,0)
const rectangles:unknown[]=[],components:unknown[]=[],binRecords:Record<string,unknown>[]=[]
for(const [bi,bin]of problem.bins.entries()){
 const c:Container=source.solution.containers[bi],obstacles:Obstacle[]=bin.obstacles,fixedIds=new Set(obstacles.map(o=>o.id)),parent=c.items.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:parent[i]=find(parent[i]),join=(i:number,j:number)=>{parent[find(i)]=find(j)},stack=analyzeStacking(c.items,c.loadingRules)
 for(const [i,p]of c.items.entries())if(fixedIds.has(p.item.id)){
  for(const support of stack.supports[i])if(fixedIds.has(c.items[support.index].item.id))join(i,support.index)
  for(let j=0;j<i;j++){const q=c.items[j];if(fixedIds.has(q.item.id)&&((p.item.cavity&&nestedInside(q,p))||(q.item.cavity&&nestedInside(p,q))))join(i,j)}
 }
 const groups=new Map<number,string[]>()
 for(const [i,p]of c.items.entries())if(fixedIds.has(p.item.id)){const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root)!.push(p.item.id)}
 const modes:Record<string,unknown>={}
 for(const [name,height]of [['ground',0],['W07_H2030',2030*scale],['W02_H2560',2560*scale]] as const){
  const active=obstacles.filter(o=>name==='ground'?o.z0===0:o.z0<=height+gap),blocked=union(active.map(inflated)),free=union(active.map(inflated),true),blockedArea=area(blocked),freeArea=area(free)
  rectangles.push({bin:bi+1,mode:name,units:'integer half-mm; boundary includes one clearance width',blocked,free})
  let bestParallel=0,example:unknown=null
  if(name!=='ground'){
   const length=(3030+5)*scale,width=((name==='W02_H2560'?160:120)+5)*scale,xs=[...new Set([0,...active.map(o=>o.x1+gap)])].filter(x=>x>=0&&x+length<=L)
   for(const x of xs){const ys=active.map(inflated).filter(r=>r.x0<x+length&&r.x1>x).map(r=>[Math.max(0,r.y0),Math.min(W,r.y1)]).filter(r=>r[1]>r[0]).sort((a,b)=>a[0]-b[0]),merged:number[][]=[];for(const [y0,y1]of ys){if(merged.length&&y0<=merged.at(-1)![1])merged.at(-1)![1]=Math.max(y1,merged.at(-1)![1]);else merged.push([y0,y1])}let y=0,parallel=0;const slots:number[][]=[];for(const [y0,y1]of [...merged,[W,W]]){if(y0>y){parallel+=Math.floor((y0-y)/width);if(y0-y>=width)slots.push([y/scale,y0/scale])}y=Math.max(y,y1)}if(parallel>bestParallel){bestParallel=parallel;example={x:x/scale,freeYIntervalsMm:slots}}
   }
  }
  const ranked=[...groups.values()].map(ids=>{const set=new Set(ids),rs=active.filter(o=>set.has(o.id));return{ids,coverageM2:area(union(rs.map(inflated)))}}).filter(g=>g.coverageM2>0).sort((a,b)=>b.coverageM2-a.coverageM2).slice(0,12).map(g=>{const ids=new Set(g.ids),sourceCounts:Record<string,number>={};for(const id of g.ids){const p=byId.get(id)!.p,k=`${p.item.rawData._sourceSheet}:${p.item.rawData._sourceRow}`;sourceCounts[k]=(sourceCounts[k]??0)+1}return{...g,sourceCounts,groundIds:g.ids.filter(id=>byId.get(id)!.p.position.z===0),exclusiveBlockedM2:Math.max(0,blockedArea-area(union(active.filter(o=>!ids.has(o.id)).map(inflated))))}})
  components.push({bin:bi+1,mode:name,topFixedComponents:ranked})
  modes[name]={fixedActiveItems:active.length,blockedM2:blockedArea,availableM2:freeArea,freeUnionRectangles:free.length,...(name!=='ground'?{maxParallelLongsAtOneX:bestParallel,bestAnchorExample:example}:{})}
 }
 const floor=modes.ground as {blockedM2:number},w07=modes.W07_H2030 as {blockedM2:number},w02=modes.W02_H2560 as {blockedM2:number}
 binRecords.push({bin:bi+1,originalContainerId:c.id,inflatedFloorAreaM2:L*W/scale**2/1e6,modes,roofExtraBlockedM2:{W07:w07.blockedM2-floor.blockedM2,W02:w02.blockedM2-floor.blockedM2}})
}
const totalAvailable=(mode:string)=>binRecords.reduce((sum,b)=>sum+((b.modes as Record<string,{availableM2:number}>)[mode].availableM2),0),w02Items=allLongs.filter(i=>Number(i.rawData._sourceRow)===16),allLongArea=minimumArea(allLongs),variableArea=minimumArea(allLongs.filter(i=>variableIds.has(i.id)))
const audit={scope:'Fixed-component conservative projection model, necessary area tests only; neither rectangle area nor a timed UNKNOWN proves packability or infeasibility.',provenance:{...researchCalibrationProvenance(cal),input:{path:`${sourceDir}/input-snapshot.json`,sha256:researchFileHash(`${sourceDir}/input-snapshot.json`)},problem:{path:`${sourceDir}/problem.json`,sha256:researchFileHash(`${sourceDir}/problem.json`)},auditEngine:{path:'src/scripts/audit-v3-floor-bottleneck.ts',sha256:researchFileHash('src/scripts/audit-v3-floor-bottleneck.ts')}},units:{dimensions:'mm',area:'m2'},areaConvention:'Each footprint uses length+5,width+5. Workspace is (11600+5)*(2250+5) per bin, matching NoOverlap2D without imposing a wall gap. Fixed rectangles and workspace are clipped in doubled integer coordinates.',longs:{total:allLongs.length,W07:allLongs.length-w02Items.length,W02:w02Items.length,variable:longEntries.length,fixed:fixedLongs.map(i=>({id:i.id,...byId.get(i.id)?.p.position,bin:byId.get(i.id)!.bin+1})),allMinimumInflatedFootprintM2:allLongArea,variableMinimumInflatedFootprintM2:variableArea,W02MinimumInflatedFootprintM2:minimumArea(w02Items)},necessaryAreaTests:{variableLongs:{requiredM2:variableArea,availableAtH2030M2:totalAvailable('W07_H2030'),violated:variableArea>totalAvailable('W07_H2030')+1e-9},W02:{requiredM2:minimumArea(w02Items),availableAtH2560M2:totalAvailable('W02_H2560'),violated:minimumArea(w02Items)>totalAvailable('W02_H2560')+1e-9}},bins:binRecords,elapsedMs:Date.now()-started}
writeFileSync(`${out}/area-audit.json`,JSON.stringify(audit,null,2));writeFileSync(`${out}/projection-unions.json`,JSON.stringify(rectangles,null,2));writeFileSync(`${out}/component-blockers.json`,JSON.stringify(components,null,2))
const longProblem={...problem,items:longEntries.map((i:Record<string,unknown>)=>({...i,required:true})),scope:'Diagnostic only: all 135 movable long windows/frames required; other movable short windows omitted. Three structural W07 remain fixed, hence all138 longs represented. Fixed components and W02/W05 rigid components unchanged. Not a complete cargo solution.',provenance:{...problem.provenance,parentProblemSha256:researchFileHash(`${sourceDir}/problem.json`),diagnostic:true,solverBudgetSeconds:25,seed:20261022}}
writeFileSync(`${out}/longs-only-problem.json`,JSON.stringify(longProblem,null,2));writeFileSync(`${out}/input-snapshot.json`,readFileSync(`${sourceDir}/input-snapshot.json`));writeFileSync(`${out}/audit-engine.ts`,readFileSync('src/scripts/audit-v3-floor-bottleneck.ts'));writeFileSync(`${out}/solver-engine.py`,readFileSync('scripts/solve-v3-window-cpsat.py'))
console.log(JSON.stringify({event:'floor-area-audit',longs:audit.longs,necessaryAreaTests:audit.necessaryAreaTests,elapsedMs:Date.now()-started}))
const python=spawnSync('python3',[`${out}/solver-engine.py`,`${out}/longs-only-problem.json`,`${out}/longs-only-answer.json`,'25','20261022'],{env:{...process.env,PYTHONPATH:'/private/tmp/container-packing-solver'},encoding:'utf8',timeout:30000,maxBuffer:4000000});writeFileSync(`${out}/solver.log`,python.stdout??'');writeFileSync(`${out}/solver.stderr`,python.stderr??'')
const answerPath=`${out}/longs-only-answer.json`,answer=existsSync(answerPath)?JSON.parse(readFileSync(answerPath,'utf8')):null
let diagnostic:unknown=null
if(answer?.placements){
 const containers:Container[]=structuredClone(source.solution.containers),moving=new Set(problem.items.flatMap((i:{id:string;componentMembers:{id:string}[]})=>[i.id,...i.componentMembers.map(p=>p.id)])),originals=new Map(cal.items.map(i=>[i.id,i]))
 for(const c of containers){c.loadingRules=loadingRulesFor(cal.items,cal.config);c.items=c.items.filter(p=>!moving.has(p.item.id)).map(p=>({...p,item:originals.get(p.item.id)!}))}
 for(const p of answer.placements){const e=longProblem.items[p.item],v=e.variants[p.variant],item=originals.get(e.id)!;containers[p.bin].items.push({item,position:{x:p.x/scale,y:p.y/scale,z:0},orientation:v.orientation,rotation:v.rotation,actualDimensions:{length:v.size[0]/scale,width:v.size[1]/scale,height:v.size[2]/scale}});for(const child of e.componentMembers)containers[p.bin].items.push({item:originals.get(child.id)!,position:{x:p.x/scale+child.relativePosition.x,y:p.y/scale+child.relativePosition.y,z:child.relativePosition.z},orientation:child.orientation,rotation:child.rotation,actualDimensions:child.actualDimensions})}
 for(const c of containers)updateContainer(c)
 const used=new Set(containers.flatMap(c=>c.items.map(p=>p.item.id))),solution=createPackingSolution(containers,cal.items.filter(i=>!used.has(i.id)),'DIAGNOSTIC-ALL-LONGS-ONLY',0,Date.now()-started),validation=validateSolution(solution,cal.items,cal.config),allLongsPresent=allLongs.every(i=>used.has(i.id));diagnostic={loaded:used.size,missing:solution.unpackedItems.length,allLongsPresent,validation}
 if(validation.valid&&allLongsPresent)writeFileSync(`${out}/diagnostic-result.json`,JSON.stringify({diagnosticOnly:true,notAnImprovedCompleteCandidate:true,config:cal.config,solution,validation,allLongsPresent,provenance:audit.provenance},null,2))
}
const record={solverStatus:answer?.status??'NO_FINAL_ANSWER',solverWallSeconds:answer?.wallTime,solverObjective:answer?.objective,solverExitCode:python.status,solverError:python.error?.message,scope:longProblem.scope,diagnostic,elapsedMs:Date.now()-started,globalInfeasibilityProven:false,globalOptimalityProven:false}
writeFileSync(`${out}/summary.json`,JSON.stringify(record,null,2));console.log(JSON.stringify(record))
