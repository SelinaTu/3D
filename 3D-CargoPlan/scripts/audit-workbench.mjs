// #created 11/08/2026
// Run: node --import tsx scripts/audit-workbench.mjs
import fs from 'node:fs'
import { simulateThreeStops,simulateFeasibleThreeStops } from '../src/demo/multistop-simulation.ts'
const root=new URL('../',import.meta.url)
const solution=JSON.parse(fs.readFileSync(new URL('output/reports/iraq-villa-current-best.plan.json',root),'utf8')).solution
const original=JSON.stringify(solution), rows=[]
const output=new URL('output/validation/',root);fs.mkdirSync(output,{recursive:true})
for(const [index,c] of solution.containers.entries()) for(const door of ['x-max','x-min']) for(const seed of [0,42,20261030]) {
  const start=Date.now()
  try {
    const result=simulateFeasibleThreeStops(c,seed,door)
    const complete=result.stops.every(s=>!s.blockedUnload.length && !s.failedPickup.length && !s.cancelledDelivery.length)
    rows.push({mode:'feasible',bin:index+1,door,seed,ms:Date.now()-start,complete,audit:result.audit,stops:result.stops.map(s=>({unload:s.unloaded.length,pickup:s.loaded.length,blocked:s.blockedUnload.length,cancelled:s.cancelledDelivery.length,failedPickup:s.failedPickup.length}))})
    if(index===0 && door==='x-max' && seed===20261030) fs.writeFileSync(new URL('multistop-bin1-20261030.json',output),JSON.stringify(result,null,2))
  } catch(e) {rows.push({mode:'feasible',bin:index+1,door,seed,error:e.message})}
}
console.log(`可行任务批检 ${rows.filter(r=>r.complete).length}/${rows.length}`)
for(const index of [0,3,10]) {
  const start=Date.now()
  try {
    const result=simulateThreeStops(solution.containers[index],20261030,'x-max')
    const row={mode:'challenge',bin:index+1,door:'x-max',seed:20261030,ms:Date.now()-start,audit:result.audit,complete:result.stops.every(s=>!s.blockedUnload.length && !s.failedPickup.length && !s.cancelledDelivery.length),stops:result.stops.map(s=>({unload:s.unloaded.length,pickup:s.loaded.length,blocked:s.blockedUnload.length,cancelled:s.cancelledDelivery.length,failedPickup:s.failedPickup.length}))}
    rows.push(row);console.log(JSON.stringify(row))
  } catch(e) {rows.push({mode:'challenge',bin:index+1,error:e.message})}
}
const report={createdAt:new Date().toISOString(),initialCargo:solution.totalItems,sourceUnchanged:original===JSON.stringify(solution),rows}
fs.writeFileSync(new URL('workbench-20261030.json',output),JSON.stringify(report,null,2))
if(!report.sourceUnchanged || rows.some(r=>r.error || !r.audit?.valid || r.mode==='feasible' && !r.complete)) process.exitCode=1
