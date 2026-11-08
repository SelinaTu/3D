// #created 11/08/2026
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {loadingRulesFor} from '../core/loading-profile'
import {canPlaceAt,calculateActualDimensions,updateContainer,analyzeStacking} from '../core/packing-utils'
import {pairGeometryErrors} from '../core/solid-geometry'
import {placeShortFrameCanopyMacro} from '../core/research-short-frame-macro'
import {createPackingSolution} from '../core/solution-builder'
import {validateSolution} from '../core/validation'
import {researchHash} from '../core/research-metrics'
import type {Container,CargoItem,PlacedItem} from '../types/packing'
const input='data/optimization/v3-macro-repack/best-partial.json',cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),base=JSON.parse(readFileSync(input,'utf8')),originals=new Map(cal.items.map(i=>[i.id,i])),started=Date.now(),output='data/optimization/v3-eight-canopy-swap';mkdirSync(output,{recursive:true})
const containers:Container[]=structuredClone(base.solution.containers);for(const c of containers){c.loadingRules=loadingRulesFor(cal.items,cal.config);c.items=c.items.map(p=>({...p,item:originals.get(p.item.id)!}));updateContainer(c)}
const target=containers[7],donor=containers[9],donorShort=donor.items.filter(p=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===21&&p.position.x===2485).slice(0,8).map(p=>p.item),removed:PlacedItem[]=[],steps:unknown[]=[]
if(donorShort.length!==8)throw new Error('Expected eight source short frames on original rack 7')
// The central canopy extends to y1674. Move the W07 at y1620 as well as the
// seven pre-existing W06 upper plates and the two 110 mm floor slots crossed
// by the new base y782..892. No source constraint is weakened to retain them.
const ids=new Set(donor.items.filter(p=>p.item.rawData._sourceSheet==='门窗'&&p.item.rawData._sourceRow===21&&p.position.x===2485).map(p=>p.item.id));for(const c of containers){const take=c.items.filter(p=>ids.has(p.item.id)||c===target&&((p.item.rawData._sourceRow===20&&p.item.rawData._sourceSheet==='门窗'&&(p.orientation==='flat'&&p.position.x===6070||p.orientation==='lying'&&p.position.x===6070&&[690,805].includes(p.position.y)))||(p.item.rawData._sourceRow===9&&p.position.x===6070&&p.position.y===1620)));removed.push(...take);const remove=new Set(take.map(p=>p.item.id));c.items=c.items.filter(p=>!remove.has(p.item.id));updateContainer(c)}
const macro=placeShortFrameCanopyMacro(target,donorShort,{x:6070,y:0,z:0});steps.push({kind:'short-canopy',...macro,placements:macro.placements.map(p=>({id:p.item.id,position:p.position,orientation:p.orientation,rotation:p.rotation}))})
// This is an explicit transformation checkpoint, not a complete improvement.
// Record why the freed rack cannot yet receive W06 while one short frame is
// still on rack 7 and rack 12 retains its upper short-frame tiers.
const w06:CargoItem=removed.find(p=>p.item.rawData._sourceRow===20)!.item,candidate:PlacedItem={item:w06,position:{x:2485,y:0,z:1378},orientation:'flat',rotation:0,actualDimensions:calculateActualDimensions(w06.dimensions,'flat',0,w06.orientationVerticalAxes)},accepted=canPlaceAt(w06,candidate.position,candidate.orientation,candidate.rotation,donor);steps.push({kind:'rack7-W06-first-layer',id:w06.id,position:candidate.position,accepted,errors:accepted?[]:[...donor.items.flatMap(p=>pairGeometryErrors(candidate,p,donor)),...analyzeStacking([...donor.items,candidate],donor.loadingRules).errors]})
const used=new Set(containers.flatMap(c=>c.items.map(p=>p.item.id))),solution=createPackingSolution(containers,cal.items.filter(i=>!used.has(i.id)),'V3-SHORT-CANOPY-EXPLICIT-SWAP-CHECKPOINT',0,Date.now()-started),validation=validateSolution(solution,cal.items,cal.config),engineFiles=['src/scripts/probe-v3-eight-canopy-swap.ts','src/core/research-short-frame-macro.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts','src/core/loading-profile.ts'].map(path=>({path,sha256:researchFileHash(path)}))
writeFileSync(`${output}/result.json`,JSON.stringify({provenance:{...researchCalibrationProvenance(cal),engineFiles,engineSha256:researchHash(engineFiles),input:{path:input,sha256:researchFileHash(input)},command:'node --import tsx src/scripts/probe-v3-eight-canopy-swap.ts',recordedAt:new Date().toISOString()},config:cal.config,solution,validation,complete:false,canopyAccepted:macro.accepted,removed:removed.map(p=>({id:p.item.id,source:p.item.rawData._sourceRow,from:ids.has(p.item.id)?donor.id:target.id,position:p.position,orientation:p.orientation})),steps,elapsedMs:Date.now()-started,nextRequired:'Clear donor rack 7 last short frame and colliding rack 12 short tiers before placing W06 flat. The removed W07 still requires a ground slot. This partial checkpoint is not an improvement.'},null,2));console.log(JSON.stringify({output,canopyAccepted:macro.accepted,baseLoadKg:macro.baseLoadKg,loaded:used.size,missing:solution.unpackedItems.length,valid:validation.valid,errors:validation.errors.slice(0,5),rack7FirstW06Accepted:accepted,elapsedMs:Date.now()-started}))
