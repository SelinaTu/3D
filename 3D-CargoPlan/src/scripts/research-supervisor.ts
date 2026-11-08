// #created 11/08/2026
import { fork } from 'node:child_process'
import { performance } from 'node:perf_hooks'

export interface SupervisionResult {
  executionStatus:'finished'|'budget-exhausted'|'timed-out'|'failed'
  timeoutReason?:'total-wall-limit'|'candidate-wall-limit'
  elapsedMs:number
  exitCode:number|null
  signal:string|null
  lastCandidate:number|null
  childReportedStatus?:string
  error?:string
}
export interface SupervisionOptions {
  modulePath:string|URL
  args?:string[]
  budgetMs:number
  candidateWallLimitMs?:number
  execArgv?:string[]
  inheritOutput?:boolean
  /** False for nested workers; the outer process group then owns whole-tree termination. */
  isolateProcessGroup?:boolean
}
/** The parent never executes geometry: synchronous CPU blocking stays in a killable child. */
export function superviseResearch(options:SupervisionOptions):Promise<SupervisionResult>{
  if(!Number.isFinite(options.budgetMs)||options.budgetMs<=0||options.budgetMs>600000)throw new Error('Research wall budget must be between 1 and 600000 milliseconds')
  if(options.candidateWallLimitMs!==undefined&&(!Number.isFinite(options.candidateWallLimitMs)||options.candidateWallLimitMs<=0||options.candidateWallLimitMs>60000))throw new Error('Candidate wall limit must not exceed 60000 milliseconds')
  const started=performance.now()
  return new Promise(resolve=>{
    const isolated=options.isolateProcessGroup!==false&&process.platform!=='win32'
    const child=fork(options.modulePath,options.args??[],{execArgv:options.execArgv??[],detached:isolated,stdio:['ignore',options.inheritOutput?'inherit':'ignore',options.inheritOutput?'inherit':'ignore','ipc']})
    let timeoutReason:SupervisionResult['timeoutReason'],candidateTimer:ReturnType<typeof setTimeout>|undefined
    let lastCandidate:number|null=null,childReportedStatus:string|undefined,error:string|undefined,settled=false
    const kill=(signal:NodeJS.Signals)=>{
      if(child.pid===undefined)return
      try{if(isolated)process.kill(-child.pid,signal);else child.kill(signal)}catch{try{child.kill(signal)}catch{/* The child may already have exited. */}}
    }
    const stop=(reason:NonNullable<SupervisionResult['timeoutReason']>)=>{
      if(timeoutReason||settled)return
      timeoutReason=reason
      // No cooperative handler is required in the CPU-bound child.
      kill('SIGKILL')
    }
    const totalTimer=setTimeout(()=>stop('total-wall-limit'),options.budgetMs)
    const finish=(exitCode:number|null,signal:string|null)=>{
      if(settled)return;settled=true
      clearTimeout(totalTimer);clearTimeout(candidateTimer)
      resolve({executionStatus:timeoutReason?'timed-out':exitCode===0?(childReportedStatus==='budget-exhausted'?'budget-exhausted':'finished'):'failed',...(timeoutReason?{timeoutReason}:{}),elapsedMs:Math.round(performance.now()-started),exitCode,signal,lastCandidate,...(childReportedStatus?{childReportedStatus}:{}),...(error?{error}:{})})
    }
    child.on('message',(message:unknown)=>{
      if(!message||typeof message!=='object')return
      const data=message as{type?:string;trial?:number;status?:string}
      if(data.type==='candidate-start'){
        lastCandidate=typeof data.trial==='number'?data.trial:null
        clearTimeout(candidateTimer)
        if(options.candidateWallLimitMs)candidateTimer=setTimeout(()=>stop('candidate-wall-limit'),options.candidateWallLimitMs)
      }else if(data.type==='candidate-finish')clearTimeout(candidateTimer)
      else if(data.type==='research-finished')childReportedStatus=data.status
    })
    child.on('error',err=>{error=err.message;finish(null,null)})
    child.on('exit',(code,signal)=>finish(code,signal))
  })
}
