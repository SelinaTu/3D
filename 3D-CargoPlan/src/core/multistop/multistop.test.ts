// #created 11/08/2026
import { describe,it,expect } from 'vitest'
import type { CargoItem } from '../../types/packing'
import { createEmptyContainer } from '../greedy-algorithm'
import { DEFAULT_CONFIG } from '../optimizer'
import { updateContainer } from '../packing-utils'
import { solveRoute } from './engine'
import { generateRouteProblem } from './scenarios'
import { parseRouteProblem } from './problem'
import { auditSimulation } from './replay'
import { buildPlayback,playbackFrame } from './playback'
import type { RouteProblem } from './model'
const cargo=(id:string):CargoItem=>({id,name:id,category:'箱',dimensions:{length:10,width:10,height:10},weight:1,quantity:1,allowedOrientations:['standing'],canStackOnTop:false,canOffsetStack:false,hasGlass:false,colorTag:'',rawData:{}})
function source() {
  const c=createEmptyContainer(0,{...DEFAULT_CONFIG,containerDimensions:{length:200,width:10,height:10}})
  c.items=Array.from({length:16},(_,i)=>({item:cargo(`original-${i}`),position:{x:i*10,y:0,z:0},orientation:'standing' as const,rotation:0,actualDimensions:{length:10,width:10,height:10}}));updateContainer(c);return c
}
describe('通用多站引擎与可移植题目',()=>{
  for(const count of [1,2,5,8,12]) for(const door of ['x-min','x-max'] as const) it(`${count} 站 / ${door}，不改代码即可求解并重放`,()=>{
    const initial=source(),snapshot=structuredClone(initial)
    const problem=generateRouteProblem(initial,{stopCount:count,seed:42,door,mode:'feasible'})
    const result=solveRoute(JSON.parse(JSON.stringify(problem)))
    expect(result.stops).toHaveLength(count)
    expect(result.stops.every(s=>!s.failedPickup.length && !s.blockedUnload.length && !s.cancelledDelivery.length)).toBe(true)
    expect(auditSimulation(result)).toEqual([])
    expect(initial).toEqual(snapshot)
  })
  it('空车开始、隔站交付、无作业站共用相同引擎',()=>{
    const initial=source();initial.items=[];updateContainer(initial)
    const problem:RouteProblem={schema:'cargoplan.route-problem/v1',seed:0,door:'x-max',initial,stops:[
      {name:'仓库取货',unloadIds:[],pickup:[cargo('a')]},
      {name:'中途集货',unloadIds:[],pickup:[cargo('b')]},
      {name:'经过站',unloadIds:[],pickup:[]},
      {name:'交付 A',unloadIds:['a'],pickup:[]},
      {name:'交付 B',unloadIds:['b'],pickup:[]},
    ]}
    const result=solveRoute(problem)
    expect(result.stops.map(s=>s.after.items.length)).toEqual([1,2,2,1,0])
    expect(result.initial.items).toHaveLength(0)
    expect(result.stops[0].loaded[0].item.unloadStop).toBe(4)
    expect(result.stops[1].loaded[0].item.unloadStop).toBe(5)
    expect(result.stops[1].operations.map(o=>o.action)).toEqual(['temporary-out','pickup','return'])
    expect(result.audit?.valid).toBe(true)
    expect(problem.stops[0].pickup[0].unloadStop).toBeUndefined()
  })
  it('固定种子的题目可保存、导入和重算，不依赖页面状态',()=>{
    const config={stopCount:5,seed:9,door:'x-max' as const,mode:'feasible' as const}
    const a=generateRouteProblem(source(),config),b=generateRouteProblem(source(),config)
    expect(a).toEqual(b)
    const parsed=parseRouteProblem(JSON.parse(JSON.stringify(a)))
    expect(solveRoute(a).stops).toEqual(solveRoute(parsed).stops)
  })
  it('原货可以使用任意 ID 前缀，补货 ID 不会和它们碰撞',()=>{
    const initial=source();initial.items.forEach((p,i)=>{p.item.id=`feasible-42-${i+1}-1`})
    const problem=generateRouteProblem(initial,{stopCount:5,seed:42,door:'x-max',mode:'feasible'})
    expect(solveRoute(problem).stops.every(s=>!s.failedPickup.length && !s.blockedUnload.length)).toBe(true)
    const ids=[...initial.items.map(p=>p.item.id),...problem.stops.flatMap(s=>s.pickup.map(i=>i.id))]
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('原车不存在、未来站才装入和重复交付的货物在求解前被拒绝',()=>{
    const p=generateRouteProblem(source(),{stopCount:5,seed:1,door:'x-max',mode:'feasible'})
    p.stops[0].unloadIds.push(p.stops[1].pickup[0].id)
    expect(()=>solveRoute(p)).toThrow('尚未提货')
    p.stops[0].unloadIds=['ghost']
    expect(()=>solveRoute(p)).toThrow('不存在')
  })
  it('错误格式、非正站数和起点碰撞都不能变成有效题目',()=>{
    expect(()=>parseRouteProblem({})).toThrow('题目格式')
    expect(()=>generateRouteProblem(source(),{stopCount:0,seed:1,door:'x-max',mode:'feasible'})).toThrow('正整数')
    const p=generateRouteProblem(source(),{stopCount:2,seed:1,door:'x-max',mode:'feasible'})
    p.initial.items[1].position.x=0
    expect(()=>solveRoute(p)).toThrow('起点装载无效')
  })
})

describe('装卸播放记录',()=>{
  for(const door of ['x-min','x-max'] as const) it(`${door} 动画端点与引擎状态一致，中间沿正确方向移出与填装`,()=>{
    const result=solveRoute(generateRouteProblem(source(),{stopCount:5,seed:42,door,mode:'feasible'})),snapshot=JSON.stringify(result)
    const steps=buildPlayback(result)
    expect(steps.filter(s=>!s.operation)).toHaveLength(5)
    for(const step of steps) {
      expect(playbackFrame(step,0,door)).toEqual(step.before)
      expect(playbackFrame(step,1,door)).toEqual(step.after)
      if(!step.operation)continue
      const p=playbackFrame(step,.5,door).items.find(p=>p.item.id===step.operation!.itemId)!
      expect(p.position.y).toBe(step.operation.placement.position.y)
      expect(p.position.z).toBe(step.operation.placement.position.z)
      expect(p.actualDimensions).toEqual(step.operation.placement.actualDimensions)
      expect(door==='x-max'?p.position.x>step.operation.placement.position.x:p.position.x<step.operation.placement.position.x).toBe(true)
      const outgoing=step.operation.action==='unload' || step.operation.action==='temporary-out'
      expect(step.after.items.length-step.before.items.length).toBe(outgoing?-1:1)
    }
    expect(steps.at(-1)!.after.items).toEqual(result.stops.at(-1)!.after.items)
    expect(JSON.stringify(result)).toBe(snapshot)
  })
})
