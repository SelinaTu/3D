// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchFileHash } from '../core/research-calibration'
import { updateContainer } from '../core/packing-utils'
import { placeResearchItem } from '../core/research-placement'
import { createPackingSolution } from '../core/solution-builder'
import { assessResearchCandidate } from '../core/research-metrics'
const start=Date.now(),deadline=start+15000,out='data/optimization/v3-four-long-zones/final-fill',input='data/optimization/v3-four-long-zones/column-first/result.json';mkdirSync(out,{recursive:true})
const cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),source=JSON.parse(readFileSync(input,'utf8')),containers=(structuredClone(source.solution) as PackingSolution).containers,moves:unknown[]=[]
const pool=()=>{const used=new Set(containers.flatMap(c=>c.items.map(p=>p.item.id)));return cal.items.filter(i=>!used.has(i.id))}
for(let pass=0;pass<3&&Date.now()<deadline;pass++)for(const item of pool().sort((a,b)=>a.rawData._sourceSheet==='辅材'?-1:b.rawData._sourceSheet==='辅材'?1:0)){for(const c of containers){const p=placeResearchItem(item,c,3+pass,Math.min(deadline,Date.now()+150));if(p){c.items.push(p);updateContainer(c);moves.push({id:item.id,target:c.id,position:p.position,orientation:p.orientation,rotation:p.rotation});break}}}
const solution=createPackingSolution(containers,pool(),'V3-FOUR-LONG-ZONES-FINAL-FILL',0,Date.now()-start),a=assessResearchCandidate(solution,cal.items,cal.config),r={provenance:{input:{path:input,sha256:researchFileHash(input)},script:{path:'src/scripts/research-v3-four-long-zones-final-fill.ts',sha256:researchFileHash('src/scripts/research-v3-four-long-zones-final-fill.ts')}},config:cal.config,solution,metrics:a.metrics,validation:a.validation,moves,elapsedMs:Date.now()-start};writeFileSync(`${out}/result.json`,JSON.stringify(r,null,2));if(!a.validation.valid)throw Error(JSON.stringify(a.validation.errors));console.log(JSON.stringify({loaded:a.metrics.placedItems,valid:a.validation.valid,missing:solution.unpackedItems.map(i=>i.id),elapsedMs:r.elapsedMs}))
