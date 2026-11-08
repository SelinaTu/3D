// #created 11/08/2026
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { superviseResearch } from './research-supervisor'

const output=process.argv[2]||'delivery-output/research/pdf-projection-consolidate'
const budget=Number(process.argv[3]||600000)
if(!Number.isFinite(budget)||budget<=0||budget>600000)throw new Error('Research wall budget must be <=600000ms')
const result=await superviseResearch({modulePath:new URL('./research-consolidate-child.ts',import.meta.url),args:[output,String(budget)],budgetMs:budget,candidateWallLimitMs:60000,execArgv:['--import','tsx'],inheritOutput:true})
mkdirSync(output,{recursive:true})
const bestPath=join(output,'best-complete.json')
const report={...result,requestedBudgetMs:budget,candidateWallLimitMs:60000,bestCompleteSnapshotAvailable:existsSync(bestPath),bestCompleteSnapshotPath:existsSync(bestPath)?bestPath:null,note:'Execution status is separate from candidate completeness. A timeout never promotes an incomplete candidate.'}
const destination=join(output,'supervision.json'),temporary=`${destination}.${process.pid}.tmp`
writeFileSync(temporary,JSON.stringify(report,null,2));renameSync(temporary,destination)
console.log(JSON.stringify({event:'research-supervision-finished',...report}))
if(result.executionStatus==='timed-out'||result.executionStatus==='budget-exhausted')process.exitCode=124
else if(result.executionStatus==='failed')process.exitCode=1
