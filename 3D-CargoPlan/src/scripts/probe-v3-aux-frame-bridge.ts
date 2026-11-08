// #created 11/08/2026
import {mkdirSync,writeFileSync} from 'node:fs'
import {loadResearchCalibration} from '../core/research-calibration'
import {createEmptyContainer} from '../core/greedy-algorithm'
import {analyzeStacking,calculateActualDimensions,canPlaceAt,updateContainer} from '../core/packing-utils'
import {createPackingSolution} from '../core/solution-builder'
import {validateSolution} from '../core/validation'
import type {Orientation} from '../types/packing'
const cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'), rows=[30,36,37],aux=rows.map(r=>cal.items.find(i=>i.rawData._sourceSheet==='辅材'&&i.rawData._sourceRow===r)!),shorts=cal.items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===21).slice(0,9),items=[...aux,...shorts],c=createEmptyContainer(0,cal.config,items),attempts:unknown[]=[]
const put=(item:typeof items[number],x:number,y:number,z:number,o:Orientation,r=0)=>{const position={x,y,z},actualDimensions=calculateActualDimensions(item.dimensions,o,r,item.orientationVerticalAxes),accepted=canPlaceAt(item,position,o,r,c);attempts.push({id:item.id,position,orientation:o,rotation:r,accepted});if(accepted){c.items.push({item,position,orientation:o,rotation:r,actualDimensions});updateContainer(c)}}
put(aux[0],4000,1000,0,'standing');put(aux[1],3775.5,1000,1205,'standing',90);put(aux[2],5009.5,1000,1205,'standing',90)
for(const [j,item]of shorts.entries())put(item,3745.5,156,1400+j*115,'flat',90)
const solution=createPackingSolution([c],items.filter(i=>!c.items.some(p=>p.item.id===i.id)),'V3-AUX-SHORT-FRAME-BRIDGE-PROBE',0,0),validation=validateSolution(solution,items,cal.config),stack=analyzeStacking(c.items,c.loadingRules),output='data/optimization/v3-short-roof-exchange/aux-bridge-probe';mkdirSync(output,{recursive:true});writeFileSync(`${output}/result.json`,JSON.stringify({config:cal.config,solution,validation,attempts,topLoads:stack.topLoads},null,2));console.log(JSON.stringify({loaded:c.items.length,expected:items.length,valid:validation.valid,errors:validation.errors,attempts:attempts.filter(x=>!(x as {accepted:boolean}).accepted),topLoads:stack.topLoads}))
