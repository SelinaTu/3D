// #created 11/08/2026
import { optimize, DEFAULT_CONFIG } from '../core/optimizer'
import { repairPacking } from '../core/repair-packing'
import { compareSolutions } from '../core/evaluator'
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'
import type { PackingProgress } from '../core/packing-progress'

type Input = { items: CargoItem[]; config: Partial<OptimizationConfig>; seed?: PackingSolution; mode?: 'quick' | 'compare' }
type Solvers = { repair: typeof repairPacking; search: typeof optimize }
export type PlanningProgress = PackingProgress & {percent:number;phase:'repair'|'search'|'done';elapsedMs:number}
export function planWithComparison(input: Input, progress: (stage: string, detail?:PlanningProgress) => void = () => {}, solvers: Solvers = { repair: repairPacking, search: optimize }) {
  const config = { ...DEFAULT_CONFIG, ...input.config }, start = Date.now()
  let percent=0
  const notify=(stage:string,phase:PlanningProgress['phase'],p:PackingProgress,offset=0,span=40)=>{
    percent=Math.max(percent,Math.min(100,offset+span*(p.total?p.processed/p.total:0)))
    progress(stage,{...p,percent,phase,elapsedMs:Date.now()-start})
  }
  const empty={processed:0,total:input.items.reduce((n,i)=>n+i.quantity,0),containers:0,placed:0,unpacked:0}
  notify('正在检查并修复旧方案','repair',empty)
  const repaired = input.seed ? solvers.repair(input.items,config,input.seed,p=>notify('正在检查并修复旧方案','repair',p)) : null
  if(input.mode==='quick' && repaired?.validation?.valid && !repaired.unpackedItems.length){
    const summary=`快速修复完成，耗时 ${((Date.now()-start)/1000).toFixed(1)} 秒。${repaired.totalContainers} 柜、0 件未装，已通过独立校验；未进行全量搜索，可主动选择深度优化。`
    notify('快速修复完成','done',{processed:empty.total,total:empty.total,containers:repaired.totalContainers,placed:empty.total,unpacked:0},100,0)
    return {solution:{...repaired,notes:[...(repaired.notes ?? []),summary]},summary}
  }
  const left = Math.max(0,(config.timeLimit ?? 30000) - (Date.now() - start))
  let candidate: PackingSolution | null = null, searchError = ''
  if (left > 0) {
    notify('正在重新搜索装载方案','search',empty,40,50)
    try { candidate = solvers.search(input.items, { ...config, timeLimit: left, deadline: undefined },p=>notify('正在重新搜索装载方案','search',p,40,50)) }
    catch (error) { searchError = error instanceof Error ? error.message : '搜索失败' }
  }
  const eligible = [repaired,candidate].filter((s): s is PackingSolution => !!s && !!s.validation?.valid)
  const solution = eligible.sort(compareSolutions)[0]
  if (!solution) throw new Error(searchError || '修复与重新搜索均未得到通过校验的方案，请检查输入后重试。')
  const elapsed = Date.now() - start
  const searchSummary = candidate ? `重新搜索候选：${candidate.totalContainers} 柜、${candidate.unpackedItems.length} 件未装${candidate.validation?.valid ? '' : '（校验未通过）'}。` : searchError ? `重新搜索失败：${searchError}。` : '修复已用完计算预算，本次没有继续搜索。'
  const decision = solution === repaired ? '已保留修复方案。' : '已采用重新搜索方案。'
  const summary = `计算完成，耗时 ${(elapsed / 1000).toFixed(1)} 秒。${searchSummary}${decision}当前 ${solution.totalContainers} 柜、${solution.unpackedItems.length} 件未装。`
  notify('结果已独立校验','done',{processed:empty.total,total:empty.total,containers:solution.totalContainers,placed:empty.total-solution.unpackedItems.length,unpacked:solution.unpackedItems.length},100,0)
  return { solution: { ...solution, notes: [...(solution.notes ?? []), summary] }, summary }
}
