// #created 11/08/2026
// node --import tsx scripts/solve-route.mjs <problem.json> [result.json]
import fs from 'node:fs'
import path from 'node:path'
import { solveRoute } from '../src/core/multistop/index.ts'
const [input,output]=process.argv.slice(2)
if(!input){console.error('用法：node --import tsx scripts/solve-route.mjs <题目.json> [结果.json]');process.exit(2)}
try {
  const target=output ?? input.replace(/\.json$/i,'')+'.result.json'
  if(path.resolve(input)===path.resolve(target))throw new Error('结果路径不能覆盖题目文件')
  const problem=JSON.parse(fs.readFileSync(input,'utf8'))
  const start=Date.now(),result=solveRoute(problem,stage=>console.log(stage))
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2))
  console.log(JSON.stringify({output:target,stations:result.stops.length,ms:Date.now()-start,audit:result.audit,uncompleted:result.stops.reduce((n,s)=>n+s.failedPickup.length+s.blockedUnload.length+s.cancelledDelivery.length,0)}))
}catch(error){console.error(error.message);process.exitCode=1}
