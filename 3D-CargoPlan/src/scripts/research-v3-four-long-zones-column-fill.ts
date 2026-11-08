// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { CargoItem, PackingSolution, PlacedItem } from '../types/packing'
import { loadResearchCalibration, researchFileHash } from '../core/research-calibration'
import { canPlaceAt, updateContainer, volume } from '../core/packing-utils'
import { placeResearchItem } from '../core/research-placement'
import { createPackingSolution } from '../core/solution-builder'
import { assessResearchCandidate } from '../core/research-metrics'
const out='data/optimization/v3-four-long-zones/column-first';mkdirSync(out,{recursive:true})
const start=Date.now(),deadline=start+15000,cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),input='data/optimization/v3-four-long-zones/structure-seed.json',source=JSON.parse(readFileSync(input,'utf8')),containers=(structuredClone(source.solution) as PackingSolution).containers,moves:unknown[]=[],ledger:unknown[]=[]
const used=()=>new Set(containers.flatMap(c=>c.items.map(p=>p.item.id))),pool=()=>{const ids=used();return cal.items.filter(i=>!ids.has(i.id))}
for(let k=0;k<2;k++){const units=pool().filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===12).slice(0,8),c=containers[4],staged={...c,items:[...c.items]},origin={x:k?3164:3185,y:k?1650:1425,z:0};let good=true;for(let j=0;j<units.length;j++){const position={...origin,z:j*305},p:PlacedItem={item:units[j],position,orientation:'flat',rotation:0,actualDimensions:units[j].dimensions};if(!canPlaceAt(p.item,p.position,p.orientation,p.rotation,staged)){good=false;break}staged.items.push(p);updateContainer(staged)}if(good){c.items=staged.items;updateContainer(c);moves.push({kind:'whole-W09-column',units:units.map(i=>i.id),origin})}else ledger.push({event:'column-rejected',origin,ids:units.map(i=>i.id)})}
function save(name:string){const solution=createPackingSolution(containers,pool(),'V3-FOUR-LONG-ZONES-COLUMN-FIRST',0,Date.now()-start),a=assessResearchCandidate(solution,cal.items,cal.config),r={provenance:{input:{path:input,sha256:researchFileHash(input)},sourceScript:{path:'src/scripts/research-v3-four-long-zones-column-fill.ts',sha256:researchFileHash('src/scripts/research-v3-four-long-zones-column-fill.ts')}},config:cal.config,solution,metrics:a.metrics,validation:a.validation,moves,ledger,elapsedMs:Date.now()-start};writeFileSync(`${out}/${name}.json`,JSON.stringify(r,null,2));if(!a.validation.valid)throw Error(JSON.stringify(a.validation.errors));console.log(JSON.stringify({event:name,loaded:r.metrics.placedItems,missing:r.solution.unpackedItems.map(i=>i.id),elapsedMs:r.elapsedMs}));return r}
save('columns-seed')
const priority=(i:CargoItem)=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===16?0:i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===9?1:i.rawData._sourceSheet==='门窗'&&[14,15,17].includes(Number(i.rawData._sourceRow))?2:3
for(const item of pool().sort((a,b)=>priority(a)-priority(b)||volume(b.dimensions)-volume(a.dimensions))){if(Date.now()>=deadline)break;for(const c of [containers[4],...containers.filter((_,i)=>i!==4)]){const p=placeResearchItem(item,c,3,Math.min(deadline,Date.now()+100));if(p){c.items.push(p);updateContainer(c);moves.push({id:item.id,target:c.id,position:p.position,orientation:p.orientation,rotation:p.rotation});break}}}
save('result')
