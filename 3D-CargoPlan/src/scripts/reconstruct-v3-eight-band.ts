// #created 11/08/2026
import {mkdirSync, writeFileSync} from 'node:fs'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {createEmptyContainer} from '../core/greedy-algorithm'
import {canPlaceAt,calculateActualDimensions,updateContainer,tryPlaceItem,analyzeStacking} from '../core/packing-utils'
import {pairGeometryErrors} from '../core/solid-geometry'
import {createPackingSolution} from '../core/solution-builder'
import {validateSolution} from '../core/validation'
import {researchHash} from '../core/research-metrics'
import type {CargoItem,Orientation,Position3D,PlacedItem} from '../types/packing'
const started=Date.now(),cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),config=cal.config,sourceIds=cal.pdfAllocation.find(x=>x.containerNumber===8)!.ids,items=sourceIds.map(id=>cal.items.find(i=>i.id===id)!),c=createEmptyContainer(0,config,items)
c.id='pdf-container-8'
const used=new Set<string>(),attempts:unknown[]=[],source=(row:number)=>items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===row&&!used.has(i.id))
function add(item:CargoItem|undefined,position:Position3D,orientation:Orientation,rotation=0){if(!item)return false;const p:PlacedItem={item,position,orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)},accepted=canPlaceAt(item,position,orientation,rotation,c);attempts.push({id:item.id,position,orientation,rotation,accepted,...(!accepted?{errors:[...c.items.flatMap(o=>pairGeometryErrors(p,o,c)),...analyzeStacking([...c.items,p],c.loadingRules).errors].slice(0,8)}:{})});if(accepted){c.items.push(p);used.add(item.id);updateContainer(c)}return accepted}
// Two long-item bands: each six frames and ten W07s. Their complete inflated
// widths are 6*165+10*125=2240 mm. Every door keeps its source lying axis.
for(const x of [0,3035]){for(let i=0;i<6;i++)add(source(16)[0],{x,y:i*165,z:0},'lying');for(let i=0;i<10;i++)add(source(9)[0],{x,y:990+i*125,z:0},'lying')}
for(const x of [6070,8729.5])for(let i=0;i<13;i++)add(source(20)[0],{x,y:i*115,z:0},'lying')
for(let i=0;i<6;i++)add(source(9)[0],{x:6070,y:1495+i*125,z:0},'lying')
const structuralAccepted=used.size
for(const host of c.items.filter(p=>p.item.rawData._sourceRow===16))for(let lane=0;lane<2;lane++)for(let layer=0;layer<4;layer++)add(source(8)[0],{x:host.position.x+920+lane*535,y:host.position.y+5,z:185+layer*535},'lying')
const deadline=Date.now()+8000
for(const row of [15,17,5,6,7,8])for(const item of [...source(row)]){if(Date.now()>=deadline)break;const p=tryPlaceItem(item,c,deadline);if(p)add(item,p.position,p.orientation,p.rotation)}
const unpacked=items.filter(i=>!used.has(i.id)),solution=createPackingSolution([c],unpacked,'PDF8-V3-LONG-ITEM-BAND',0,Date.now()-started),validation=validateSolution(solution,items,config),paths=['src/scripts/reconstruct-v3-eight-band.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts','src/core/loading-profile.ts'],engineFiles=paths.map(path=>({path,sha256:researchFileHash(path)})),output='data/reconstruction/v3/container-8-band'
mkdirSync(output,{recursive:true});writeFileSync(`${output}/result.json`,JSON.stringify({sourceContainerNumber:8,sourceIds,complete:unpacked.length===0&&validation.valid,config,solution,validation,attempts,structuralAccepted,elapsedMs:Date.now()-started,provenance:{...researchCalibrationProvenance(cal),engineFiles,engineSha256:researchHash(engineFiles),command:'node --import tsx src/scripts/reconstruct-v3-eight-band.ts',method:'All 38 long pieces and 26 W06 pieces on floor; two explicit long bands; no cavity-axis changes; bounded eight-second residual insertion.'}},null,2));console.log(JSON.stringify({output,structuralAccepted,loaded:used.size,valid:validation.valid,unpacked:unpacked.map(i=>({id:i.id,name:i.name})),elapsedMs:Date.now()-started}))
