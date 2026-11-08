// #created 11/08/2026
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { reconstructOneContainer, reconstructionDiagnostics, reconstructionPolicies } from '../core/reconstruction-decoder'
import { validateSolution } from '../core/validation'
import { solidVolume } from '../core/solid-geometry'
import { loadingRulesFor } from '../core/loading-profile'
import { reconstructionPdfSeed, reconstructionRackSeed } from '../core/reconstruction-pdf-seeds'
import type { PackingSolution, ValidationReport } from '../types/packing'

if(!process.send)throw new Error('Reconstruction worker requires the external process supervisor')
const number=Number(process.argv[2]),output=resolve(process.argv[3]),budgetMs=Number(process.argv[4]),engineSha256=process.argv[5],seed=Number(process.argv[6]??20261017)
const calibration=loadResearchCalibration(process.argv[7]??'data/calibration/packing-contract.json'),allocation=calibration.pdfAllocation.find(c=>c.containerNumber===number)
if(!allocation)throw new Error(`PDF manifest not found: ${number}`)
mkdirSync(output,{recursive:true})
const expected=new Set(allocation.ids),items=allocation.ids.map(id=>calibration.items.find(i=>i.id===id)!),attemptsPath=resolve(output,`container-${number}.attempts.jsonl`),resultPath=resolve(output,`container-${number}.json`)
if(items.some(i=>!i)||expected.size!==items.length)throw new Error('Invalid fixed allocation')
const started=Date.now(),deadline=started+budgetMs-1000,policies=reconstructionPolicies(seed+number*1000),pdfSeed=reconstructionPdfSeed(number,items,calibration.config)
writeFileSync(resolve(output,`container-${number}.seed.json`),JSON.stringify(pdfSeed,null,2))
const provenance={...researchCalibrationProvenance(calibration),engineSha256,seed:seed+number*1000,startedAt:new Date().toISOString(),rules:loadingRulesFor(items,calibration.config),assignment:'immutable original PDF normalizedIds',scope:'geometry-and-load-assumptions'}
let best:{solution:PackingSolution;validation:ValidationReport;unpackedVolume:number}|undefined,attempt=0,successful=0
if(existsSync(resultPath)){const prior=JSON.parse(readFileSync(resultPath,'utf8'));if(prior.provenance?.calibrationHash===calibration.calibrationHash&&prior.provenance?.engineSha256===engineSha256){const validation=validateSolution(prior.solution,items,calibration.config);if(validation.valid)best={solution:prior.solution,validation,unpackedVolume:prior.solution.unpackedItems.reduce((s:number,i:typeof items[number])=>s+solidVolume(i),0)}}}
process.send?.({type:'candidate-start',trial:number})
for(const policy of policies){
  if(Date.now()>=deadline||best?.solution.unpackedItems.length===0)break
  const attemptStart=Date.now(),until=Math.min(deadline,attemptStart+3500),initial=pdfSeed.accepted?pdfSeed:policy.order==='rack-first'?reconstructionRackSeed(items,calibration.config,policy.rackYaw,policy.columnMode!=='mixed',until):undefined,solution=reconstructOneContainer(items,calibration.config,policy,until,initial?.container)
  if(solution.containers[0])solution.containers[0].id=`pdf-container-${number}`
  const validation=validateSolution(solution,items,calibration.config),unpackedVolume=solution.unpackedItems.reduce((s,i)=>s+solidVolume(i),0)
  const complete=validation.valid&&solution.unpackedItems.length===0&&solution.totalItems===items.length&&solution.totalContainers===1
  const improved=validation.valid&&(!best||solution.unpackedItems.length<best.solution.unpackedItems.length||solution.unpackedItems.length===best.solution.unpackedItems.length&&unpackedVolume<best.unpackedVolume)
  if(validation.valid)successful++
  const record={attempt:attempt++,policy,startedAt:new Date(attemptStart).toISOString(),elapsedMs:Date.now()-attemptStart,loaded:solution.stats?.placedItems,unpacked:solution.unpackedItems.length,unpackedMaterialVolumeMm3:unpackedVolume,valid:validation.valid,complete,improved,errors:validation.errors.slice(0,8)}
  appendFileSync(attemptsPath,JSON.stringify(record)+'\n')
  if(improved){
    best={solution,validation,unpackedVolume}
    const result={schemaVersion:1,sourceContainerNumber:number,sourceIds:allocation.ids,config:calibration.config,solution,validation,complete,provenance,attemptsPath,attemptsCompleted:attempt,validAttempts:successful,elapsedMs:Date.now()-started,policy,diagnostics:complete?null:reconstructionDiagnostics(solution,items,calibration.config)}
    writeFileSync(resultPath+'.tmp',JSON.stringify(result,null,2));renameSync(resultPath+'.tmp',resultPath)
    console.log(JSON.stringify({container:number,...record}))
  }
}
writeFileSync(resolve(output,`container-${number}.worker-summary.json`),JSON.stringify({sourceContainerNumber:number,attemptsCompleted:attempt,validAttempts:successful,elapsedMs:Date.now()-started,complete:best?.solution.unpackedItems.length===0,bestPlaced:best?.solution.stats?.placedItems,bestUnpacked:best?.solution.unpackedItems.length,sourceIds:allocation.ids,provenance},null,2))
process.send?.({type:'candidate-finish',trial:number});process.send?.({type:'research-finished',status:Date.now()>=deadline?'budget-exhausted':'trial-limit'})
