// #created 11/08/2026
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { researchHash, allocationHash } from '../core/research-metrics'
import { validateSolution } from '../core/validation'
import { createPackingSolution } from '../core/solution-builder'
import { loadingRulesFor } from '../core/loading-profile'
import { superviseResearch } from './research-supervisor'
import type { Container, PackingSolution } from '../types/packing'

const arg=(name:string,fallback:string)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1]}
if(!process.send)throw new Error('Reconstruction job requires the external total-wall supervisor')
const output=resolve(arg('--output','delivery-output/reconstruction')),budgetMs=Math.min(600000,Number(arg('--budget-ms','600000'))),containerMs=Math.min(60000,Number(arg('--container-ms','55000'))),seed=Number(arg('--seed','20261017'))
if(!(budgetMs>0&&containerMs>0&&Number.isInteger(seed)))throw new Error('Invalid reconstruction budget/seed')
const contract=arg('--contract','data/calibration/packing-contract.json'),calibration=loadResearchCalibration(contract),start=performance.now(),startedAt=new Date().toISOString()
mkdirSync(output,{recursive:true})
const engineFiles=['src/core/reconstruction-decoder.ts','src/core/reconstruction-pdf-seeds.ts','src/scripts/reconstruct-manual-worker.ts','src/scripts/reconstruct-manual.ts','src/scripts/reconstruct-manual-job.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/validation.ts','src/core/loading-profile.ts','src/core/greedy-algorithm.ts','src/core/solution-builder.ts','src/scripts/research-supervisor.ts'].map(path=>({path,sha256:researchFileHash(path)})),engineSha256=researchHash(engineFiles)
const provenance={...researchCalibrationProvenance(calibration),engineSha256,engineFiles,seed,startedAt,externalWallBudgetMs:budgetMs,externalPerContainerWallLimitMs:containerMs,assignment:'fixed original PDF 191-row allocation; no cross-container movement',rules:loadingRulesFor(calibration.items,calibration.config)}
const manifestPath=resolve(output,'manifest.json'),summaryPath=resolve(output,'summary.json')
if(existsSync(manifestPath)){const prior=JSON.parse(readFileSync(manifestPath,'utf8'));if(prior.provenance.calibrationHash!==calibration.calibrationHash||prior.provenance.engineSha256!==engineSha256)throw new Error('Resume provenance differs; select a new output directory')}
else writeFileSync(manifestPath,JSON.stringify({schemaVersion:1,provenance,config:calibration.config,allocation:calibration.pdfAllocation,sourceIds:calibration.items.map(i=>i.id)},null,2))
const records:unknown[]=[],selected=arg('--containers','').split(',').filter(Boolean).map(Number),order=[11,1,...calibration.pdfAllocation.map(c=>c.containerNumber).filter(n=>n!==11&&n!==1)].filter(n=>!selected.length||selected.includes(n))
function saveSummary(){writeFileSync(summaryPath+'.tmp',JSON.stringify({schemaVersion:1,stage:'fixed-allocation-reconstruction',startedAt,elapsedMs:Math.round(performance.now()-start),allElevenComplete:false,provenance,containers:records},null,2));renameSync(summaryPath+'.tmp',summaryPath)}
for(const number of order){
  const allocation=calibration.pdfAllocation.find(c=>c.containerNumber===number)!,originals=allocation.ids.map(id=>calibration.items.find(i=>i.id===id)!),path=resolve(output,`container-${number}.json`)
  if(existsSync(path)){const prior=JSON.parse(readFileSync(path,'utf8'));if(prior.provenance.calibrationHash!==calibration.calibrationHash||prior.provenance.engineSha256!==engineSha256)throw new Error(`Container ${number} resume provenance mismatch`);if(prior.complete&&validateSolution(prior.solution,originals,calibration.config).valid){records.push({sourceContainerNumber:number,status:'complete-resumed',loaded:originals.length,unpacked:0,path});saveSummary();continue}}
  const remaining=budgetMs-(performance.now()-start)-250
  if(remaining<=500){records.push({sourceContainerNumber:number,status:'not-run-total-wall-budget',sourceIds:allocation.ids});saveSummary();continue}
  console.log(JSON.stringify({event:'container-start',sourceContainerNumber:number,sourceItems:originals.length,remainingTotalMs:Math.floor(remaining)}))
  const limit=Math.min(containerMs,remaining),supervision=await superviseResearch({modulePath:new URL('./reconstruct-manual-worker.ts',import.meta.url),args:[String(number),output,String(Math.max(1,limit-1000)),engineSha256,String(seed),contract],budgetMs:limit,candidateWallLimitMs:Math.min(60000,limit),execArgv:['--import','tsx'],inheritOutput:true,isolateProcessGroup:false})
  let result: {complete?:boolean;solution?:PackingSolution;validation?:unknown;attemptsCompleted?:number}={}
  if(existsSync(path))result=JSON.parse(readFileSync(path,'utf8'))
  const validation=result.solution?validateSolution(result.solution,originals,calibration.config):null
  const record={sourceContainerNumber:number,status:result.complete&&validation?.valid?'complete':'partial-or-no-layout',loaded:result.solution?.stats?.placedItems??0,unpacked:result.solution?.unpackedItems.length??originals.length,path:existsSync(path)?path:null,independentValidation:validation,supervision}
  records.push(record);saveSummary();console.log(JSON.stringify({event:'container-finish',...record,independentValidation:validation?{valid:validation.valid,errors:validation.errors.slice(0,3)}:null}))
}
const solutions:Container[]=[]
for(const allocation of calibration.pdfAllocation){const path=resolve(output,`container-${allocation.containerNumber}.json`);if(existsSync(path)){const result=JSON.parse(readFileSync(path,'utf8'));for(const container of result.solution.containers)solutions.push({...container,loadingRules:loadingRulesFor(calibration.items,calibration.config)})}}
const placedIds=new Set(solutions.flatMap(c=>c.items.map(p=>p.item.id))),unpacked=calibration.items.filter(item=>!placedIds.has(item.id))
const combined=createPackingSolution(solutions,unpacked,'PDF-FIXED-ALLOCATION-RECONSTRUCTION',0,Math.round(performance.now()-start)),validation=validateSolution(combined,calibration.items,calibration.config),allocationUnchanged=allocationHash(solutions.map(c=>c.items.map(i=>i.item.id)))===calibration.pdfBaseline.allocationSha256
const complete=validation.valid&&unpacked.length===0&&solutions.length===11&&allocationUnchanged
writeFileSync(resolve(output,'combined.json'),JSON.stringify({schemaVersion:1,complete,allocationUnchanged,sourceContainerAssignments:calibration.pdfAllocation,solution:combined,validation,provenance,elapsedMs:Math.round(performance.now()-start),notAnInfeasibilityProof:!complete},null,2))
writeFileSync(summaryPath,JSON.stringify({schemaVersion:1,stage:'fixed-allocation-reconstruction',startedAt,elapsedMs:Math.round(performance.now()-start),allElevenComplete:complete,allocationUnchanged,loaded:combined.stats?.placedItems,unpacked:unpacked.length,independentValidation:validation,provenance,containers:records},null,2))
console.log(JSON.stringify({event:'reconstruction-finished',complete,loaded:combined.stats?.placedItems,unpacked:unpacked.length,elapsedMs:Math.round(performance.now()-start),output}))
