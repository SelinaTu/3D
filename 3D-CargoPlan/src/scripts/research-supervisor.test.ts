// #created 11/08/2026
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { superviseResearch } from './research-supervisor'

const directories:string[]=[]
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true})})
function fixture(code:string):string{const folder=mkdtempSync(join(tmpdir(),'packing-watchdog-'));directories.push(folder);const file=join(folder,'blocked.mjs');writeFileSync(file,code);return file}

describe('external research wall supervision',()=>{
  it('terminates a synchronously CPU-blocked child using the parent total timer',async()=>{
    const result=await superviseResearch({modulePath:fixture('while(true){}'),budgetMs:250})
    expect(result.executionStatus).toBe('timed-out')
    expect(result.timeoutReason).toBe('total-wall-limit')
    expect(result.elapsedMs).toBeLessThan(2500)
    expect(result.exitCode).not.toBe(0)
  })
  it('enforces the per-candidate wall limit while the child cannot process any timer',async()=>{
    const result=await superviseResearch({modulePath:fixture('process.send({type:"candidate-start",trial:7});while(true){}'),budgetMs:3000,candidateWallLimitMs:200})
    expect(result.executionStatus).toBe('timed-out')
    expect(result.timeoutReason).toBe('candidate-wall-limit')
    expect(result.lastCandidate).toBe(7)
    expect(result.elapsedMs).toBeLessThan(2500)
  })
  it('reports an ordinary child exit separately from a research budget exhaustion',async()=>{
    const result=await superviseResearch({modulePath:fixture('process.send({type:"research-finished",status:"trial-limit"});'),budgetMs:3000})
    expect(result.executionStatus).toBe('finished')
    expect(result.timeoutReason).toBeUndefined()
    expect(result.childReportedStatus).toBe('trial-limit')
  })
  it('does not label a child-reported budget exhaustion as ordinary completion',async()=>{
    const result=await superviseResearch({modulePath:fixture('process.send({type:"research-finished",status:"budget-exhausted"});'),budgetMs:3000})
    expect(result.executionStatus).toBe('budget-exhausted')
    expect(result.exitCode).toBe(0)
  })
  it('rejects an unbounded launcher configuration',()=>{
    expect(()=>superviseResearch({modulePath:'unused',budgetMs:600001})).toThrow('600000')
    expect(()=>superviseResearch({modulePath:'unused',budgetMs:1000,candidateWallLimitMs:60001})).toThrow('60000')
  })
  it('kills nested non-isolated workers with the outer process group',async()=>{
    if(process.platform==='win32')return
    const nested=fixture('setInterval(()=>{},1000);'),pidPath=nested+'.pid'
    const outer=fixture(`import{fork}from'node:child_process';import{writeFileSync}from'node:fs';const child=fork(${JSON.stringify(nested)},[],{detached:false,stdio:'ignore'});writeFileSync(${JSON.stringify(pidPath)},String(child.pid));setInterval(()=>{},1000);`)
    const result=await superviseResearch({modulePath:outer,budgetMs:350})
    expect(result.executionStatus).toBe('timed-out')
    const pid=Number(readFileSync(pidPath,'utf8'));let alive=true
    for(let i=0;i<20&&alive;i++){await new Promise(resolve=>setTimeout(resolve,20));try{process.kill(pid,0)}catch{alive=false}}
    expect(alive).toBe(false)
  })
})
