// #created 11/08/2026
import { describe, expect, it, vi } from 'vitest'
import { planWithComparison } from './planning-runner'
import type { PackingSolution } from '../types/packing'
function solution(bins: number, pending = 0, valid = true): PackingSolution {
  return { id: String(bins), containers:[],totalContainers:bins,totalItems:10,avgVolumeUtilization:0,avgWeightUtilization:0,unpackedItems:Array(pending).fill({id:'pending'}),score:0,algorithm:'test',computeTime:0,validation:{valid,errors:[],warnings:[]} }
}
describe('手动重新计算',()=>{
  it('快速修复已全部装入时不再消耗剩余预算全量搜索',()=>{
    const repaired=solution(11),search=vi.fn(()=>solution(10))
    const result=planWithComparison({items:[],config:{timeLimit:20000},seed:repaired,mode:'quick'},()=>{},{repair:()=>repaired,search})
    expect(search).not.toHaveBeenCalled();expect(result.solution.totalContainers).toBe(11)
    expect(result.summary).toContain('未进行全量搜索')
  })
  it('快速修复仍有未装件时继续尝试搜索，进度包含实际分配且不倒退',()=>{
    const repaired=solution(11,1),candidate=solution(11),events:{percent:number;processed:number;placed:number}[]=[]
    const search=vi.fn((...args:Parameters<typeof import('../core/optimizer').optimize>)=>{args[2]?.({processed:5,total:10,containers:2,placed:4,unpacked:1});return candidate})
    const result=planWithComparison({items:[],config:{timeLimit:20000},seed:repaired,mode:'quick'},(_,p)=>{if(p)events.push(p)},{repair:()=>repaired,search})
    expect(search).toHaveBeenCalledOnce();expect(result.solution.unpackedItems).toHaveLength(0)
    expect(events.some(e=>e.processed===5&&e.placed===4)).toBe(true)
    expect(events.at(-1)?.percent).toBe(100);expect(events.every((e,i)=>i===0||e.percent>=events[i-1].percent)).toBe(true)
  })
  it('即使旧方案可以修复，也继续搜索并采用更少柜的有效候选',()=>{
    const repaired = solution(11), candidate = solution(10)
    const search = vi.fn(()=>candidate), stages:string[] = []
    const result = planWithComparison({items:[],config:{timeLimit:20000},seed:repaired},stage=>stages.push(stage),{repair:()=>repaired,search})
    expect(search).toHaveBeenCalledOnce()
    expect(result.solution.totalContainers).toBe(10)
    expect(result.summary).toContain('已采用重新搜索方案')
    expect(stages).toContain('正在重新搜索装载方案')
  })
  it('候选未通过校验时保留有效修复方案并向用户说明',()=>{
    const repaired=solution(11), candidate=solution(9,0,false)
    const result = planWithComparison({items:[],config:{timeLimit:20000},seed:repaired},()=>{},{repair:()=>repaired,search:()=>candidate})
    expect(result.solution.totalContainers).toBe(11)
    expect(result.summary).toContain('校验未通过')
    expect(result.summary).toContain('已保留修复方案')
  })
})
