// #created 11/08/2026
import {appendFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import type {CargoItem,Container,PackingSolution,PlacedItem} from '../types/packing'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {analyzeStacking,updateContainer,orientationsFor,canPlaceAt,maxPlacementHeight} from '../core/packing-utils'
import {nestedInside,solidVolume,isGlassRack,geometryFor,supportGap,requiredClearance} from '../core/solid-geometry'
import {placeResearchItem} from '../core/research-placement'
import {assessResearchCandidate,compareResearchMetrics,researchHash} from '../core/research-metrics'
import {createPackingSolution} from '../core/solution-builder'
import {superviseResearch} from './research-supervisor'

const out=process.argv[2]??'data/optimization/v3-r2-tail-transfer';mkdirSync(out,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:[out,process.argv[3]??'data/optimization/v3-tail-independent/frozen-complete.json','--child'],execArgv:['--import','tsx'],budgetMs:120000,inheritOutput:true});writeFileSync(`${out}/supervision.json`,JSON.stringify(supervision,null,2))}else{
const started=Date.now(),deadline=started+110000,sourceIndex=2,input=process.argv[3]??'data/optimization/v3-tail-independent/frozen-complete.json',inputBytes=readFileSync(input),original=JSON.parse(inputBytes.toString('utf8')).solution as PackingSolution,cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),sourceFiles=['src/scripts/research-v3-r2-tail-transfer.ts','src/core/research-placement.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/research-metrics.ts','src/core/validation.ts'],engineFiles=sourceFiles.map(path=>{const snapshotPath=`${out}/engine-snapshot/${path}`;mkdirSync(snapshotPath.slice(0,snapshotPath.lastIndexOf('/')),{recursive:true});writeFileSync(snapshotPath,readFileSync(path));return{path,snapshotPath,sha256:researchFileHash(snapshotPath)}}),provenance={...researchCalibrationProvenance(cal),input:{path:input,sha256:researchFileHash(input),snapshotPath:`${out}/input-snapshot.json`},engineFiles,engineSha256:researchHash(engineFiles),budgetMs:120000,searchBudgetMs:110000,sourceIndex,seed:20261019,round:Number(process.argv[4])||1,scope:'Complete-only transfer from sourceIndex2 to all other bins, all six placement modes, support descendant plus nesting closures, enhanced boundary cross-product anchors. No frozen rule changes.'}
writeFileSync(`${out}/input-snapshot.json`,inputBytes)
const baseline=assessResearchCandidate(original,cal.items,cal.config);if(!baseline.metrics.eligible)throw Error('Baseline must be independently valid and complete')
writeFileSync(`${out}/baseline-metrics.json`,JSON.stringify({provenance,metrics:baseline.metrics,validation:baseline.validation},null,2))
let best=original,bestMetrics=baseline.metrics,trials=0,accepted=0
const moves:unknown[]=[],ledger=(entry:unknown)=>appendFileSync(`${out}/ledger.jsonl`,JSON.stringify(entry)+'\n')
function crossPlacement(item:CargoItem,c:Container,end:number):PlacedItem|null{
 for(const variant of orientationsFor(item)){
  const d=variant.dimensions,xs=new Set([0,c.dimensions.length-d.length]),ys=new Set([0,c.dimensions.width-d.width]),zs=new Set([0]);
  for(const q of c.items){const p=q.position,b=q.actualDimensions,gap=requiredClearance(item,q.item,c);for(const x of [p.x,p.x+b.length-d.length,p.x+b.length+gap,p.x-d.length-gap])if(x>=0&&x+d.length<=c.dimensions.length)xs.add(x);for(const y of [p.y,p.y+b.width-d.width,p.y+b.width+gap,p.y-d.width-gap])if(y>=0&&y+d.width<=c.dimensions.width)ys.add(y);if(q.item.canStackOnTop||q.item.cavity)for(const face of geometryFor(q).top){const z=face.z+supportGap(item,q.item,c);if(z+d.height<=maxPlacementHeight(item,c))zs.add(z)}}
  for(const z of [...zs].sort((a,b)=>a-b))for(const x of [...xs].sort((a,b)=>a-b))for(const y of [...ys].sort((a,b)=>a-b)){
   if(Date.now()>=end)return null;if(canPlaceAt(item,{x,y,z},variant.orientation,variant.rotation,c))return{item,position:{x,y,z},orientation:variant.orientation,rotation:variant.rotation,actualDimensions:d}
  }
 }
 return null
}
interface Group{host:PlacedItem;members:PlacedItem[];volume:number}
function groups(container:Container):Group[]{
 const stack=analyzeStacking(container.items,container.loadingRules)
 return container.items.filter(p=>!isGlassRack(p.item)).map(host=>{
  const root=container.items.indexOf(host),indices=new Set([root]);let changed=true
  while(changed){changed=false;container.items.forEach((q,i)=>{if(indices.has(i))return;const nested=[...indices].some(j=>nestedInside(q,container.items[j]));const dependent=stack.supports[i].some(s=>indices.has(s.index));if(nested||dependent){indices.add(i);changed=true}})}
  const members=container.items.filter((_,i)=>i!==root&&indices.has(i));return{host,members,volume:solidVolume(host.item)+members.reduce((n,p)=>n+solidVolume(p.item),0)}
 }).sort((a,b)=>a.members.length-b.members.length||b.host.position.z-a.host.position.z||b.volume-a.volume||a.host.item.id.localeCompare(b.host.item.id))
}
for(let pass=0;pass<3&&Date.now()<deadline;pass++){
 let passAccepted=0
 for(const group of groups(best.containers[sourceIndex])){
  if(Date.now()>=deadline)break
  const liveSource=best.containers[sourceIndex],liveHost=liveSource.items.find(p=>p.item.id===group.host.item.id);if(!liveHost)continue
  const ids=new Set([liveHost.item.id,...group.members.map(p=>p.item.id)]),containers=structuredClone(best.containers),donor=containers[sourceIndex]
  donor.items=donor.items.filter(p=>!ids.has(p.item.id));updateContainer(donor)
  const sourceCheck=analyzeStacking(donor.items,donor.loadingRules)
  if(sourceCheck.errors.length){ledger({event:'rejected-source-removal',pass,ids:[...ids],errors:sourceCheck.errors.slice(0,4),elapsedMs:Date.now()-started});continue}
  const targets=bestMetrics.containers.filter(m=>m.sourceIndex!==sourceIndex).map(m=>m.sourceIndex)
  let committed=false
  for(const targetIndex of targets){
   if(committed||Date.now()>=deadline)break
   for(const mode of [0,1,2,3,4,5,6]){
    if(committed||Date.now()>=deadline)break
    const target=containers[targetIndex],before=[...target.items],restricted=group.members.length?{...liveHost.item,allowedOrientations:[liveHost.orientation]}:liveHost.item,p=mode===6?crossPlacement(restricted,target,Math.min(deadline,Date.now()+250)):placeResearchItem(restricted,target,mode,Math.min(deadline,Date.now()+180));trials++
    if(!p){ledger({event:'no-placement',trial:trials,pass,ids:[...ids],target:target.id,mode,elapsedMs:Date.now()-started});continue}
    p.item=liveHost.item
    if(group.members.length&&(p.orientation!==liveHost.orientation||p.rotation!==liveHost.rotation)){ledger({event:'rejected-component-rotation',trial:trials,id:liveHost.item.id,target:target.id,orientation:p.orientation,rotation:p.rotation});continue}
    const replacements=[p,...group.members.map(child=>({...child,position:{x:p.position.x+child.position.x-liveHost.position.x,y:p.position.y+child.position.y-liveHost.position.y,z:p.position.z+child.position.z-liveHost.position.z}}))]
    target.items.push(...replacements);updateContainer(target)
    const solution=createPackingSolution(containers,[],'V3-COMPLETE-ONLY-INDEPENDENT-TAIL-TRANSFER',0,Date.now()-started),assessment=assessResearchCandidate(solution,cal.items,cal.config),improved=assessment.metrics.eligible&&(assessment.metrics.front10MinimumSolidUtilization??-Infinity)+1e-12>=(baseline.metrics.front10MinimumSolidUtilization??-Infinity)&&compareResearchMetrics(assessment.metrics,bestMetrics)<0,record={event:'candidate',trial:trials,pass,ids:[...ids],from:donor.id,to:target.id,placements:replacements.map(q=>({id:q.item.id,position:q.position,orientation:q.orientation,rotation:q.rotation})),eligible:assessment.metrics.eligible,improved,tailM3:assessment.metrics.tailSolidVolumeMm3/1e9,front10Bottleneck:assessment.metrics.front10MinimumSolidUtilization,validationErrors:assessment.validation.errors.slice(0,4),elapsedMs:Date.now()-started};ledger(record)
    if(improved){best=solution;bestMetrics=assessment.metrics;accepted++;passAccepted++;moves.push(record);const result={provenance,config:cal.config,...assessment,moves,record:{trials,accepted,elapsedMs:Date.now()-started,globalOptimalityProven:false}};writeFileSync(`${out}/best-complete.json`,JSON.stringify(result,null,2));writeFileSync(`${out}/accepted-${accepted}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({event:'complete-improvement',accepted,ids:[...ids],tailM3:bestMetrics.tailSolidVolumeMm3/1e9,front10Bottleneck:bestMetrics.front10MinimumSolidUtilization,elapsedMs:Date.now()-started}));committed=true;break}
    target.items=before;updateContainer(target)
   }
  }
 }
 if(!passAccepted)break
}
writeFileSync(`${out}/summary.json`,JSON.stringify({provenance,trials,accepted,elapsedMs:Date.now()-started,baseline:baseline.metrics,best:bestMetrics,complete:bestMetrics.eligible,globalOptimalityProven:false},null,2));console.log(JSON.stringify({event:'finished',trials,accepted,tailM3:bestMetrics.tailSolidVolumeMm3/1e9,front10Bottleneck:bestMetrics.front10MinimumSolidUtilization,elapsedMs:Date.now()-started}));process.send?.({type:'research-finished',status:'complete-only-tail-search-finished'})
}
