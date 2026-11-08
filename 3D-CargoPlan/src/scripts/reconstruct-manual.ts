// #created 11/08/2026
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {superviseResearch} from './research-supervisor'
const arg=(name:string,fallback:string)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1]}
const budget=Math.min(600000,Number(arg('--budget-ms','600000'))),output=resolve(arg('--output','delivery-output/reconstruction'))
mkdirSync(output,{recursive:true})
const result=await superviseResearch({modulePath:new URL('./reconstruct-manual-job.ts',import.meta.url),args:process.argv.slice(2),budgetMs:budget,execArgv:['--import','tsx'],inheritOutput:true})
writeFileSync(resolve(output,'total-supervision.json'),JSON.stringify({...result,scope:'Entire job including decode, independent validation and aggregation; nested workers share the outer killable process group.'},null,2))
console.log(JSON.stringify({event:'total-supervision-finished',...result}))
if(result.executionStatus==='failed')process.exitCode=1
