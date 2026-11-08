// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Orientation, PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { calculateActualDimensions, canPlaceAt, analyzeStacking, updateContainer } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { assessResearchCandidate } from '../core/research-metrics'
const cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json'),input='data/optimization/v3-floor-orientation-repair-high/best-partial.json',source=JSON.parse(readFileSync(input,'utf8')),solution=structuredClone(source.solution) as PackingSolution,c=solution.containers.find(c=>c.id==='repair-v3-11')!,old=new Map(c.items.map(p=>[p.item.id,p])),aux=c.items.filter(p=>p.item.rawData._sourceSheet==='辅材'&&p.item.rawData._sourceRow===8).map(p=>p.item),ids=['门窗:W12:r15:u45','辅材:12:r18:u3','辅材:15:r21','辅材:18:r24:u1','辅材:19:r27','辅材:32:r40:u10','辅材:32:r40:u11','辅材:11:r16:u2',...aux.map(i=>i.id)],attempts:unknown[]=[],started=Date.now()
c.items=c.items.filter(p=>!ids.includes(p.item.id));updateContainer(c)
function put(id:string,x:number,y:number,z:number,orientation:Orientation,rotation:number,note?:string){const item=old.get(id)!.item,p={item,position:{x,y,z},orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)},accepted=canPlaceAt(item,p.position,orientation,rotation,c),errors=accepted?[]:[...c.items.flatMap(other=>pairGeometryErrors(p,other,c)),...analyzeStacking([...c.items,p],c.loadingRules).errors];attempts.push({id,position:p.position,orientation,rotation,actualDimensions:p.actualDimensions,accepted,errors,note});c.items.push(p);updateContainer(c)}
put('门窗:W12:r15:u45',7535,1220,1048,'flat',0)
let next=0;for(const [x,y,count,rotation]of[[8389,0,6,0],[8994,0,6,0],[8389,615,4,90]])for(let j=0;j<count;j++)put(aux[next++].id,x,y,1048+j*215,'standing',rotation)
put('辅材:15:r21',9004,615,1048,'lying',90,'Generic source orientation lying90 gives the intended 360×330 footprint; standing90 would be 440×330 and collide.')
put('辅材:12:r18:u3',9004,950,1048,'lying',0)
put('辅材:18:r24:u1',9369,615,1048,'lying',0,'Generic source lying0 gives 350×250 footprint; lying90 would overlap the next carton.')
put('辅材:19:r27',9369,870,1048,'standing',90)
put('辅材:32:r40:u10',8500,1220,1203,'standing',0,'Largest face down is generic standing, 340×400 footprint and 260 height.')
put('辅材:32:r40:u11',8500,1220,1468,'standing',0)
const moved=old.get('辅材:11:r16:u2')!;put(moved.item.id,7751,1650,0,moved.orientation,moved.rotation)
const assessment=assessResearchCandidate(solution,cal.items,cal.config),output='data/optimization/v3-tail-aux-roof/flat-probe';mkdirSync(output,{recursive:true});writeFileSync(`${output}/result.json`,JSON.stringify({provenance:{...researchCalibrationProvenance(cal),input:{path:input,sha256:researchFileHash(input)},scriptSha256:researchFileHash('src/scripts/probe-v3-tail-flat-roof.ts')},config:cal.config,solution,validation:assessment.validation,metrics:assessment.metrics,attempts,accepted:assessment.validation.valid,elapsedMs:Date.now()-started},null,2));console.log(JSON.stringify({accepted:assessment.validation.valid,loaded:assessment.metrics.placedItems,errors:assessment.validation.errors.slice(0,12),firstRejected:attempts.find(a=>!(a as {accepted:boolean}).accepted),elapsedMs:Date.now()-started}))
