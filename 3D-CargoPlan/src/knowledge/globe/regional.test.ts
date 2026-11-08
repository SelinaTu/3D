// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { appliesToPort, policiesFor, regionalPolicies } from './regional'
import { safeSource } from './model'
describe('港别差异与国家继承',()=>{
  it('港口级范围优先，不因同属中国把天津规则分给上海',()=>{
    expect(appliesToPort({ports:['CNTXG'],countries:['CN']},{locode:'CNSHA',country:'CN'})).toBe(false)
    expect(policiesFor({locode:'CNTXG',country:'CN'}).some(r=>r.id==='TJ-ACCESS-202610')).toBe(true)
    expect(policiesFor({locode:'CNSHA',country:'CN'}).some(r=>r.id==='TJ-ACCESS-202610')).toBe(false)
    expect(policiesFor({locode:'CNSHA',country:'CN'}).some(r=>r.id==='CN-ROAD-MASS')).toBe(true)
  })
  it('国别处罚相互隔离，港别数据和通用话题不混为一谈',()=>{
    expect(policiesFor({locode:'IDTPP',country:'ID'}).map(r=>r.id)).toEqual(['ID-ROAD-PENALTY'])
    expect(policiesFor({locode:'ZZXYZ',country:'ZZ'})).toEqual([])
  })
  it('新规则均包含条件、动作、后果、时间与可追溯官方来源',()=>{
    for(const rule of regionalPolicies){
      expect(rule.conditions.length).toBeGreaterThan(0);expect(rule.action.length).toBeGreaterThan(0)
      expect(rule.consequence.length).toBeGreaterThan(0);expect(rule.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(rule.sources.every(s=>safeSource(s.url)&&/(\.gov\.cn|\.go\.id)$/.test(new URL(s.url).hostname))).toBe(true)
    }
  })
})
