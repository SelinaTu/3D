// #created 11/08/2026
import fs from 'node:fs'
import path from 'node:path'
import { loadResearchCalibration } from '../core/research-calibration'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { analyzeStacking, calculateActualDimensions, updateContainer } from '../core/packing-utils'
import { validateSolution } from '../core/validation'
import { createPackingSolution } from '../core/solution-builder'
import type { PlacedItem } from '../types/packing'

const out='data/optimization/v3-r2-eight-seed'
fs.mkdirSync(out,{recursive:true})
const cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const units=cal.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===23)
let attempts=0,bestMax=Infinity,best:unknown
const started=Date.now(),deadline=started+110000
for(const nBase of [10,9]){
 for(let left=0;left<=260;left+=5)for(let right=left+995;right<=1260;right+=5){
  if(Date.now()>deadline)break
  for(const spread of [215,220,225,226]){
   const ys=Array.from({length:nBase},(_,i)=>i*spread)
   if(ys.at(-1)!+210>2250)continue
   for(const shift of [0,5,10,15,20,25,30,40,50,60,70,80,90,100]){
    if(ys.at(-1)!+shift+210>2250)continue
    attempts++
    const items:PlacedItem[]=ys.map((y,i)=>({item:units[i],position:{x:0,y:y+shift,z:0},orientation:'lying',rotation:0,actualDimensions:calculateActualDimensions(units[i].dimensions,'lying',0,units[i].orientationVerticalAxes)}))
    for(let j=0;j<14;j++)items.push({item:units[nBase+j],position:{x:0,y:j%2?right:left,z:995+Math.floor(j/2)*215},orientation:'flat',rotation:0,actualDimensions:calculateActualDimensions(units[nBase+j].dimensions,'flat',0,units[nBase+j].orientationVerticalAxes)})
    const c=createEmptyContainer(0,cal.config,items.map(p=>p.item));c.items=items;updateContainer(c)
    const a=analyzeStacking(items,c.loadingRules),max=Math.max(...a.topLoads.slice(0,nBase))
    if(max<bestMax){bestMax=max;best={nBase,left,right,spread,shift,errors:a.errors,max,baseLoads:a.topLoads.slice(0,nBase)}}
    if(a.errors.length)continue
    const solution=createPackingSolution([c],[],'R2-LONG-DENSITY',Date.now()-started,0),validation=validateSolution(solution,items.map(p=>p.item),cal.config)
    if(validation.valid){const result={attempts,elapsedMs:Date.now()-started,macroOnly:true,count:items.length,parameters:{nBase,left,right,spread,shift},baseLoads:a.topLoads.slice(0,nBase),solution,validation};fs.writeFileSync(path.join(out,`macro-${items.length}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({count:items.length,parameters:result.parameters,max,attempts,elapsedMs:result.elapsedMs}));process.exit(0)}
   }
  }
 }
}
fs.writeFileSync(path.join(out,'density-diagnostic.json'),JSON.stringify({attempts,elapsedMs:Date.now()-started,best},null,2));console.log(JSON.stringify({attempts,elapsedMs:Date.now()-started,best}))
