// #created 11/08/2026
import {mkdirSync,writeFileSync} from 'node:fs'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash} from '../core/research-calibration'
import {calculateActualDimensions} from '../core/packing-utils'
import {geometryFor,unionArea} from '../core/solid-geometry'
import {researchHash} from '../core/research-metrics'

const calibration=loadResearchCalibration('data/reconstruction/model-v2-contract.json'),config=calibration.config,allocation=calibration.pdfAllocation.find(c=>c.containerNumber===8)!,items=allocation.ids.map(id=>calibration.items.find(i=>i.id===id)!),checks:{name:string;passed:boolean;actual?:unknown}[]=[]
const check=(name:string,passed:boolean,actual?:unknown)=>{checks.push({name,passed,...(actual===undefined?{}:{actual})});if(!passed)throw new Error(`Proof precondition failed: ${name}`)}
const group=(row:number)=>items.filter(i=>i.rawData._sourceSheet==='门窗'&&i.rawData._sourceRow===row),item=(row:number)=>group(row)[0],dim=(row:number,orientation:'standing'|'lying'|'flat')=>calculateActualDimensions(item(row).dimensions,orientation,0,item(row).orientationVerticalAxes)
check('exact v2 envelope and clearance projection',config.containerDimensions.length===11600&&config.containerDimensions.width===2250&&config.containerDimensions.height===2500&&config.loadingProfile==='villa-pdf'&&config.verticalSupport==='pdf-clearance-projection'&&config.offsetStackScope==='item-only')
check('80 percent area criterion is an explicit proof prerequisite', (config.supportCriterion ?? 'area-80-centroid') === 'area-80-centroid', config.supportCriterion ?? 'legacy-default-area-80-centroid')
check('exact original container 8 allocation',items.length===105&&[5,6,7,8,9,15,16,17,20].every(r=>group(r).length===({5:9,6:4,7:2,8:18,9:26,15:2,16:12,17:6,20:26} as Record<number,number>)[r]))
check('no other categories or racks',items.every(i=>i.rawData._sourceSheet==='门窗'))
for(const row of [5,6,7,8,17,20])check(`source row ${row} supports its exact source only`,group(row).every(i=>i.stackableWith?.length===1&&i.stackableWith[0]==='@self'))
for(const row of [9,15])check(`source row ${row} upper-unit limit is 5kg in every orientation`,group(row).every(i=>['standing','lying','flat'].every(o=>i.constraints?.orientationRules?.[o as 'standing']?.maxSupportedItemWeight===5)))
check('W07 actually allows lying only',group(9).every(i=>i.allowedOrientations.length===1&&i.allowedOrientations[0]==='lying'))
check('W02 frames actually allow lying only',group(16).every(i=>i.allowedOrientations.length===1&&i.allowedOrientations[0]==='lying'))
const f=dim(16,'lying'),w07=dim(9,'lying'),w06=dim(20,'lying'),w06flat=dim(20,'flat'),frame=item(16)
check('long strip dimensions',f.length===3030&&f.width===160&&f.height===2560&&w07.length===3030&&w07.width===120&&w07.height===2030)
check('W06 dimensions',w06.length===2654.5&&w06.width===110&&w06.height===1584.5&&w06flat.length===2654.5&&w06flat.width===1584.5&&w06flat.height===110&&dim(20,'standing').height>2500)
check('W06 and W02-sash load rules retained',[17,20].every(r=>item(r).constraints?.orientationRules?.lying?.maxStackWeight===120&&item(r).constraints?.orientationRules?.lying?.strictMaxStackWeight===true))
const geometry=geometryFor({item:frame,position:{x:0,y:0,z:0},orientation:'lying',rotation:0,actualDimensions:f})
check('W02 floor rail occupies the entire rectangle',unionArea(geometry.bottom)===3030*160)
check('W02 cavity is only 1200x160x2200 with strict lying-door authorization',!!geometry.cavity&&geometry.cavity.max.x-geometry.cavity.min.x===1200&&geometry.cavity.max.y-geometry.cavity.min.y===160&&geometry.cavity.max.z-geometry.cavity.min.z===2200&&geometry.cavity.min.z===180&&frame.cavity?.doorOrientation==='lying')
check('no other cavity',items.every(i=>i.rawData._sourceRow===16||!i.cavity))
const inflated={length:11605,width:2255,longLength:3035,w06Length:2659.5,w06Width:1589.5},longTransverse=12*165+26*125,capacityWithFlat=3*inflated.width-inflated.w06Width
check('at most three long intervals outside a W06 flat band',3*3035<=11605&&4*3035>11605)
check('at most two long intervals inside a W06 flat band',3*3035+2659.5>11605)
check('integrated transverse capacity contradiction',longTransverse>capacityWithFlat,{required:longTransverse,available:capacityWithFlat,deficit:longTransverse-capacityWithFlat})
const w03StandingArea=dim(5,'standing').length*dim(5,'standing').width,w03FlatArea=dim(5,'flat').length*dim(5,'flat').width
check('W03 first elevated flat cannot be supported by its eight remaining units',8*w03StandingArea<0.8*w03FlatArea,{maximumContact:8*w03StandingArea,required:0.8*w03FlatArea})
const w04StandingArea=dim(6,'standing').length*dim(6,'standing').width,w04LyingArea=dim(6,'lying').length*dim(6,'lying').width,w04FlatArea=dim(6,'flat').length*dim(6,'flat').width
check('W04 first elevated flat impossible in both small groups',3*Math.max(w04StandingArea,w04LyingArea)<0.8*w04FlatArea)
check('two standing W04 floor units cannot support two lying uppers',2*w04StandingArea<2*0.8*w04LyingArea)
check('one standing W04 cannot support one lying upper at 80%',w04StandingArea<0.8*w04LyingArea)
check('one lying W04 cannot support two disjoint upper units',w04LyingArea<2*0.8*w04StandingArea)
check('third vertical W04 layer cannot fit',3*1030+2*5>2500)
const sashLying=dim(17,'lying'),sashFlat=dim(17,'flat')
check('W02-sash first elevated flat lacks support among five possible bases',5*sashLying.length*sashLying.width<0.8*sashFlat.length*sashFlat.width)
check('standing W02-sash cannot support a flat within net height',dim(17,'standing').height+5+sashFlat.height>2500)
const areas=[
  {sourceRow:16,name:'W02 frame',quantity:12,minFloorAreaMm2:12*3030*160},
  {sourceRow:9,name:'W07',quantity:26,minFloorAreaMm2:26*3030*120},
  {sourceRow:20,name:'W06 sash (flat ruled out by transverse capacity)',quantity:26,minFloorAreaMm2:26*2654.5*110},
  {sourceRow:5,name:'W03',quantity:9,minFloorAreaMm2:9*1330*120},
  {sourceRow:6,name:'W04(1F)',quantity:4,minFloorAreaMm2:2*1330*120},
  {sourceRow:7,name:'W04(2F)',quantity:2,minFloorAreaMm2:1330*120},
  {sourceRow:15,name:'W12',quantity:2,minFloorAreaMm2:2*1030*150},
  {sourceRow:17,name:'W02 sash',quantity:6,minFloorAreaMm2:6*1584.5*110},
  {sourceRow:8,name:'W05 completely ignored (may occupy cavities)',quantity:18,minFloorAreaMm2:0},
],minimum=areas.reduce((s,a)=>s+a.minFloorAreaMm2,0),floor=11600*2250
check('floor area contradiction even ignoring W05 and every inter-item gap',minimum>floor,{minimum,floor,deficit:minimum-floor})
const engineFiles=['src/scripts/prove-container-eight-v2.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts','src/core/loading-profile.ts'].map(path=>({path,sha256:researchFileHash(path)})),output='data/reconstruction/container-eight-v2-certificate';mkdirSync(output,{recursive:true})
const certificate={schemaVersion:1,status:'conditionally-infeasible',sourceContainerNumber:8,scope:'Only original PDF container 8 allocation under the frozen normalized v2 geometric/load model including 80% support. Not a verdict on the PDF on-site plan, and not a proof about other allocations or global 11/10-container feasibility.',verificationMethod:'analytic necessary conditions with machine-checked source and arithmetic premises',sourceIds:allocation.ids,config,supportAreaFraction:0.8,clearanceMm:5,provenance:{...researchCalibrationProvenance(calibration),engineFiles,engineSha256:researchHash(engineFiles)},checks,transverseCertificate:{inflated,requiredLongTransverseMm:longTransverse,maximumLongTransverseMmWithAnyFirstW06Flat:capacityWithFlat,deficitMm:longTransverse-capacityWithFlat},floorCertificate:{areas,minimumFloorAreaMm2:minimum,availableFloorAreaMm2:floor,deficitMm2:minimum-floor,ignoredW05:true,ignoredClearanceArea:true}}
writeFileSync(`${output}/certificate.json`,JSON.stringify(certificate,null,2));console.log(JSON.stringify({status:certificate.status,checks:checks.length,allChecksPassed:true,floorMinimumM2:minimum/1e6,floorM2:floor/1e6,deficitM2:(minimum-floor)/1e6,output}))
