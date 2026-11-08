// #created 11/08/2026
import {appendFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import type {Container,PackingSolution,PlacedItem} from '../types/packing'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {analyzeStacking,updateContainer} from '../core/packing-utils'
import {nestedInside,solidVolume,isGlassRack} from '../core/solid-geometry'
import {placeResearchItem} from '../core/research-placement'
import {assessResearchCandidate,compareResearchMetrics,researchHash} from '../core/research-metrics'
import {createPackingSolution} from '../core/solution-builder'
import {superviseResearch} from './research-supervisor'

const out='data/optimization/v3-tail-independent';mkdirSync(out,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--child'],execArgv:['--import','tsx'],budgetMs:120000,inheritOutput:true});writeFileSync(`${out}/supervision.json`,JSON.stringify(supervision,null,2))}else{
const started=Date.now(),deadline=started+110000,sourceIndex=2,input='data/optimization/v3-last-w12-repair/best-complete.json',inputBytes=readFileSync(input),original=JSON.parse(inputBytes.toString('utf8')).solution as PackingSolution,cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),sourceFiles=['src/scripts/research-v3-tail-independent.ts','src/core/research-placement.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/research-metrics.ts','src/core/validation.ts'],engineFiles=sourceFiles.map(path=>{const snapshotPath=`${out}/engine-snapshot/${path}`;mkdirSync(snapshotPath.slice(0,snapshotPath.lastIndexOf('/')),{recursive:true});writeFileSync(snapshotPath,readFileSync(path));return{path,snapshotPath,sha256:researchFileHash(snapshotPath)}}),provenance={...researchCalibrationProvenance(cal),input:{path:input,sha256:researchFileHash(input),snapshotPath:`${out}/input-snapshot.json`},engineFiles,engineSha256:researchHash(engineFiles),budgetMs:120000,searchBudgetMs:110000,sourceIndex,excludedTargetIndex:0,scope:'Complete-only independent transfer from original container3; original container1 is neither donor nor destination to reduce conflicts with parallel W09 work. No hard loading rule changes.'}
writeFileSync(`${out}/input-snapshot.json`,inputBytes)
const baseline=assessResearchCandidate(original,cal.items,cal.config);if(!baseline.metrics.eligible)throw Error('Baseline must be independently valid and complete')
writeFileSync(`${out}/baseline-metrics.json`,JSON.stringify({provenance,metrics:baseline.metrics,validation:baseline.validation},null,2))
let best=original,bestMetrics=baseline.metrics,trials=0,accepted=0
const moves:unknown[]=[],ledger=(entry:unknown)=>appendFileSync(`${out}/ledger.jsonl`,JSON.stringify(entry)+'\n')
interface Group{host:PlacedItem;members:PlacedItem[];volume:number}
function groups(container:Container):Group[]{return container.items.filter(p=>!isGlassRack(p.item)).map(host=>{const members=host.item.rawData._sourceSheet==='门窗'&&Number(host.item.rawData._sourceRow)===16?container.items.filter(q=>q!==host&&nestedInside(q,host)):[];return{host,members,volume:solidVolume(host.item)+members.reduce((n,p)=>n+solidVolume(p.item),0)}}).sort((a,b)=>b.volume-a.volume||b.host.position.z-a.host.position.z||a.host.item.id.localeCompare(b.host.item.id))}
for(let pass=0;pass<3&&Date.now()<deadline;pass++){
 let passAccepted=0
 for(const group of groups(best.containers[sourceIndex])){
  if(Date.now()>=deadline)break
  const liveSource=best.containers[sourceIndex],liveHost=liveSource.items.find(p=>p.item.id===group.host.item.id);if(!liveHost)continue
  const ids=new Set([liveHost.item.id,...group.members.map(p=>p.item.id)]),containers=structuredClone(best.containers),donor=containers[sourceIndex]
  donor.items=donor.items.filter(p=>!ids.has(p.item.id));updateContainer(donor)
  const sourceCheck=analyzeStacking(donor.items,donor.loadingRules)
  if(sourceCheck.errors.length){ledger({event:'rejected-source-removal',pass,ids:[...ids],errors:sourceCheck.errors.slice(0,4),elapsedMs:Date.now()-started});continue}
  const targets=bestMetrics.containers.filter(m=>m.sourceIndex!==sourceIndex&&m.sourceIndex!==0).map(m=>m.sourceIndex)
  let committed=false
  for(const targetIndex of targets){
   if(committed||Date.now()>=deadline)break
   for(const mode of [3,4]){
    if(committed||Date.now()>=deadline)break
    const target=containers[targetIndex],before=[...target.items],restricted=group.members.length?{...liveHost.item,allowedOrientations:[liveHost.orientation]}:liveHost.item,p=placeResearchItem(restricted,target,mode,Math.min(deadline,Date.now()+95));trials++
    if(!p){ledger({event:'no-placement',trial:trials,pass,ids:[...ids],target:target.id,mode,elapsedMs:Date.now()-started});continue}
    p.item=liveHost.item
    if(group.members.length&&(p.orientation!==liveHost.orientation||p.rotation!==liveHost.rotation)){ledger({event:'rejected-component-rotation',trial:trials,id:liveHost.item.id,target:target.id,orientation:p.orientation,rotation:p.rotation});continue}
    const replacements=[p,...group.members.map(child=>({...child,position:{x:p.position.x+child.position.x-liveHost.position.x,y:p.position.y+child.position.y-liveHost.position.y,z:p.position.z+child.position.z-liveHost.position.z}}))]
    target.items.push(...replacements);updateContainer(target)
    const solution=createPackingSolution(containers,[],'V3-COMPLETE-ONLY-INDEPENDENT-TAIL-TRANSFER',0,Date.now()-started),assessment=assessResearchCandidate(solution,cal.items,cal.config),improved=assessment.metrics.eligible&&compareResearchMetrics(assessment.metrics,bestMetrics)<0,record={event:'candidate',trial:trials,pass,ids:[...ids],from:donor.id,to:target.id,placements:replacements.map(q=>({id:q.item.id,position:q.position,orientation:q.orientation,rotation:q.rotation})),eligible:assessment.metrics.eligible,improved,tailM3:assessment.metrics.tailSolidVolumeMm3/1e9,front10Bottleneck:assessment.metrics.front10MinimumSolidUtilization,validationErrors:assessment.validation.errors.slice(0,4),elapsedMs:Date.now()-started};ledger(record)
    if(improved){best=solution;bestMetrics=assessment.metrics;accepted++;passAccepted++;moves.push(record);const result={provenance,config:cal.config,...assessment,moves,record:{trials,accepted,elapsedMs:Date.now()-started,globalOptimalityProven:false}};writeFileSync(`${out}/best-complete.json`,JSON.stringify(result,null,2));writeFileSync(`${out}/accepted-${accepted}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({event:'complete-improvement',accepted,ids:[...ids],tailM3:bestMetrics.tailSolidVolumeMm3/1e9,front10Bottleneck:bestMetrics.front10MinimumSolidUtilization,elapsedMs:Date.now()-started}));committed=true;break}
    target.items=before;updateContainer(target)
   }
  }
 }
 if(!passAccepted)break
}
writeFileSync(`${out}/summary.json`,JSON.stringify({provenance,trials,accepted,elapsedMs:Date.now()-started,baseline:baseline.metrics,best:bestMetrics,complete:bestMetrics.eligible,globalOptimalityProven:false},null,2));console.log(JSON.stringify({event:'finished',trials,accepted,tailM3:bestMetrics.tailSolidVolumeMm3/1e9,front10Bottleneck:bestMetrics.front10MinimumSolidUtilization,elapsedMs:Date.now()-started}));process.send?.({type:'research-finished',status:'complete-only-tail-search-finished'})
}
