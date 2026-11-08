// #created 11/08/2026
import {mkdirSync,writeFileSync} from 'node:fs'
import {superviseResearch} from './research-supervisor'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {createEmptyContainer} from '../core/greedy-algorithm'
import {calculateActualDimensions,canPlaceAt,updateContainer,analyzeStacking} from '../core/packing-utils'
import {pairGeometryErrors} from '../core/solid-geometry'
import {reconstructOneContainer,reconstructionDiagnostics} from '../core/reconstruction-decoder'
import {validateSolution} from '../core/validation'
import {researchHash} from '../core/research-metrics'
import type {CargoItem,Orientation,Position3D} from '../types/packing'

const output='data/reconstruction/pdf-container-nine-seed';mkdirSync(output,{recursive:true})
if(!process.send){const supervision=await superviseResearch({modulePath:new URL(import.meta.url),args:['--worker'],execArgv:['--import','tsx'],budgetMs:30000,inheritOutput:true});writeFileSync(`${output}/supervision.json`,JSON.stringify(supervision,null,2))}else{
  const calibration=loadResearchCalibration('data/reconstruction/model-v2-contract.json'),config=calibration.config,ids=calibration.pdfAllocation.find(c=>c.containerNumber===9)!.ids,items=ids.map(id=>calibration.items.find(i=>i.id===id)!),container=createEmptyContainer(0,config,items),start=Date.now(),attempts:unknown[]=[]
  container.id='pdf-container-9';const source=(row:number)=>items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===row)
  const add=(item:CargoItem|undefined,position:Position3D,orientation:Orientation,rotation=0)=>{
    if(!item)return false
    const p={item,position,orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)},accepted=canPlaceAt(item,position,orientation,rotation,container)
    attempts.push({id:item.id,position,orientation,rotation,accepted,...(!accepted?{errors:[...container.items.flatMap(other=>pairGeometryErrors(p,other,container)),...analyzeStacking([...container.items,p],container.loadingRules).errors].slice(0,6)}:{})})
    if(accepted){container.items.push(p);updateContainer(container)}return accepted
  }
  const rack=(n:number)=>items.find(i=>i.rawData._sourceSheet==='玻璃架'&&i.name.startsWith(`${n}#`))
  add(rack(4),{x:0,y:0,z:0},'standing');add(rack(24),{x:2480,y:0,z:0},'standing');add(rack(16),{x:5684,y:0,z:0},'standing')
  // Controlled overhang remains above 80%, and the next rack is lower than these two stacks.
  const w04Second=source(7);for(let lane=0;lane<2;lane++)for(let layer=0;layer<6;layer++)add(w04Second[lane*6+layer],{x:lane*1335,y:0,z:1650+layer*125},'flat')
  for(let i=0;i<8;i++)add(source(5)[i],{x:2670,y:0,z:1089+i*125},'flat',90)
  for(let i=0;i<10;i++)add(source(6)[i],{x:4205,y:0,z:1089+i*125},'flat')
  for(let i=0;i<6;i++)add(source(22)[i],{x:5684,y:0,z:1726+i*115},'flat')
  const frames=source(16);let index=0
  for(let i=0;i<4;i++)add(frames[index++],{x:0,y:1595+i*165,z:0},'lying')
  for(let i=0;i<5;i++)add(frames[index++],{x:3035,y:1425+i*165,z:0},'lying')
  for(let i=0;i<12;i++)add(frames[index++],{x:7530,y:i*165,z:0},'lying')
  const sashes=source(17);index=0
  for(let i=0;i<8;i++)add(sashes[index++],{x:10565+i*115,y:0,z:0},'standing',90)
  for(let i=0;i<2;i++)add(sashes[index++],{x:0,y:1187+i*115,z:0},'standing')
  for(let i=0;i<2;i++)add(sashes[index++],{x:7530,y:1980+i*115,z:0},'standing')
  const narrow=[...source(14),...source(15)];index=0
  for(let i=0;i<4;i++)add(narrow[index++],{x:10565,y:1589.5+i*155,z:0},'standing')
  for(let i=0;i<5;i++)add(narrow[index++],{x:6070,y:1289+i*155,z:0},'standing')
  writeFileSync(`${output}/seed.json`,JSON.stringify({container,attempts,sourceIds:ids,config},null,2))
  const policy={seed:20261017,order:'length' as const,columnMode:'mixed' as const,rackYaw:0 as const,rackChain:false},solution=reconstructOneContainer(items,config,policy,Date.now()+25000,container)
  if(solution.containers[0])solution.containers[0].id='pdf-container-9'
  const validation=validateSolution(solution,items,config),complete=validation.valid&&solution.unpackedItems.length===0
  const engineFiles=['src/scripts/reconstruct-pdf-nine-seed.ts','src/core/reconstruction-decoder.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts','src/core/loading-profile.ts'].map(path=>({path,sha256:researchFileHash(path)}))
  const result={sourceContainerNumber:9,sourceIds:ids,config,solution,validation,complete,provenance:{...researchCalibrationProvenance(calibration),engineFiles,engineSha256:researchHash(engineFiles),seed:20261017,rules:container.loadingRules},attempts,policy,elapsedMs:Date.now()-start,diagnostics:reconstructionDiagnostics(solution,items,config)}
  writeFileSync(`${output}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({complete,loaded:solution.stats?.placedItems,unpacked:solution.unpackedItems.map(i=>({id:i.id,name:i.name})),valid:validation.valid,errors:validation.errors,seedAccepted:attempts.filter(a=>(a as {accepted:boolean}).accepted).length,seedRejected:attempts.filter(a=>!(a as {accepted:boolean}).accepted).length,elapsedMs:Date.now()-start}))
  process.send({type:'research-finished',status:'trial-limit'})
}
