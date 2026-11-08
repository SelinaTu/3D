// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import ports from '../../globe/data/ports.json'
import countries from '../../globe/data/countries.json'
import meta from '../../globe/data/meta.json'
import land from '../../globe/data/land.json'
import conventions from '../../globe/data/conventions.json'
import reviews from '../../globe/data/reviews.json'
import { type GlobeData } from '../knowledge/globe/model'
import { answerSupportQuestion } from './knowledge'
const data={ports,countries,meta,land,conventions,reviews,packs:{}} as GlobeData
describe('跨工作区问答与适用边界',()=>{
  it('支持产品操作帮助，而不要求先选海运港口',async()=>{
    const answer=await answerSupportQuestion('如何导入 Excel？',{workspace:'bench'})
    expect(answer.title).toBe('导入货物清单');expect(answer.text).toContain('.xlsx');expect(answer.text).toContain('重新计算')
  })
  it('返回实际 VGM 问答及来源，未知问题不伪造答案',async()=>{
    const answer=await answerSupportQuestion('没有 VGM 能装船吗？')
    expect(answer.topicId).toBe('T02_vgm_solas');expect(answer.sources.some(s=>s.url.includes('imo.org'))).toBe(true)
    expect((await answerSupportQuestion('zxqv1198 🦕')).missing).toBe(true)
  })
  it('天津限行回答附当地新规与生效日期，不套超重罚金',async()=>{
    const answer=await answerSupportQuestion('天津国四限行罚款多少？',{},data)
    expect(answer.text).toContain('2026-10-01');expect(answer.text).toContain('未列统一罚款金额')
    expect(answer.text).not.toContain('30,000');expect(answer.sources.some(s=>new URL(s.url).hostname==='www.tj.gov.cn')).toBe(true)
  })
  it('当前天津上下文可继承国家公路处罚，但明确不是港口专属',async()=>{
    const answer=await answerSupportQuestion('公路超限罚款怎么处理？',{portCode:'CNTXG'},data)
    expect(answer.scope).toContain('国家规则，非港口专属');expect(answer.text).toContain('30,000');expect(answer.text).toContain('不能把交罚款')
  })
  it('问题里明确印尼时覆盖当前天津上下文，禁止串国家',async()=>{
    const answer=await answerSupportQuestion('印尼超载处罚有哪些？',{portCode:'CNTXG'},data)
    expect(answer.scope).toContain('印度尼西亚');expect(answer.text).toContain('500,000');expect(answer.text).not.toContain('49 t');expect(answer.sources.every(s=>!s.url.includes('mot.gov.cn'))).toBe(true)
  })
  it('航运公司的港口规则能答到卡片，单价不抄进答复',async()=>{
    const hongKong=await answerSupportQuestion('香港爆炸品船的锚地在西面吗？')
    expect(hongKong.scope).toContain('香港');expect(`${hongKong.title}${hongKong.text}`).toContain('西面');expect(hongKong.scope).toContain('不自动裁决')
    const mundra=await answerSupportQuestion('蒙德拉进口重箱免费堆存几天？')
    expect(`${mundra.title}${mundra.text}`).toContain('两日');expect(`${mundra.title}${mundra.text}`).not.toMatch(/142|213|284/)
    const price=await answerSupportQuestion('蒙德拉CT2重箱基础处理费是多少美元？')
    expect(`${price.title}${price.text}`).not.toMatch(/142|213|284/);expect(price.text).toContain('不能当作本票报价')
    const durban=await answerSupportQuestion('德班硝酸铵按普通5.1可以吗？')
    expect(durban.text).toContain('不能把所有5.1一刀切');expect(durban.scope).toContain('德班')
    const staff=await answerSupportQuestion('上海两员记分按自然年怎么算？')
    expect(`${staff.title}${staff.text}`).toContain('1月1日');expect(staff.scope).toContain('上海')
  })
  it('没指定港口时不把一港的危货规则套到另一港',async()=>{
    const ambiguous=await answerSupportQuestion('硝酸铵有什么特别要求？')
    expect(ambiguous.title).toContain('需要指定港口');expect(ambiguous.text).toContain('德班');expect(ambiguous.text).toContain('洛杉矶')
    const tianjin=await answerSupportQuestion('硝酸铵有什么特别要求？',{portCode:'CNTXG'})
    expect(tianjin.text).not.toContain('德班');expect(tianjin.scope).not.toContain('德班')
  })
  it('未知地区、本地危货罚则与缺车辆条件时不凭空套表',async()=>{
    expect((await answerSupportQuestion('法国当地限行？',{},data)).missing).toBe(true)
    expect((await answerSupportQuestion('法国公路限重？',{portCode:'CNTXG'},data)).missing).toBe(true)
    expect((await answerSupportQuestion('天津危险品罚款多少钱？',{},data)).missing).toBe(true)
    expect((await answerSupportQuestion('超载罚款多少钱？',{},data)).missing).toBe(true)
  })
})
