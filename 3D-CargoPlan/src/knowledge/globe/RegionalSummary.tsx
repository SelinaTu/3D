// #created 11/08/2026
import type { GlobeData, Port } from './model'
import { useState } from 'react'
import { countryName, safeSource } from './model'
import { localReviews, policiesFor, type RegionalPolicy } from './regional'

export function PolicyCard({rule}: {rule: RegionalPolicy}) {
  return <article className="atlas-rule regional-policy" data-policy-id={rule.id}>
    <div className="atlas-rule-head"><h4>{rule.title}</h4><span className="atlas-reviewed">{rule.ports.length ? '地区专属' : '国家规则'} · {rule.category === 'penalty' ? '法定责任' : '运输要求'}</span></div>
    <p>{rule.summary}</p><details className="regional-conditions"><summary>适用条件 · {rule.conditions.length} 项</summary><ul>{rule.conditions.map(s => <li key={s}>{s}</li>)}</ul></details>
    <div className="regional-action"><b>作业前要做</b><p>{rule.action}</p></div>
    <p className="regional-consequence">{rule.consequence}</p>
    <small>生效 / 版本：{rule.effective} · 来源核对 {rule.checked_at}</small>
    <div className="atlas-sources">{rule.sources.map(s => {const url = safeSource(s.url); return url ? <a key={url} href={url} target="_blank" rel="noreferrer">{s.title} ↗</a> : null})}</div>
  </article>
}
export function RegionalSummary({data, port}: {data: GlobeData; port: Port}) {
  const [category,setCategory]=useState('all')
  const rules = policiesFor(port), selected=rules.filter(r=>category==='all'||r.category===category), local = selected.filter(r => r.ports.length), inherited = selected.filter(r => !r.ports.length)
  const allReviews=localReviews(data,port),reviews=category==='all'?allReviews:[]
  return <section className="regional-summary" aria-label="地区差异与海陆衔接">
    <div className="regional-heading"><small>LOCAL OPERATIONS</small><h3>{port.name_zh ?? port.name} · 地区差异</h3><p>先看本地要求，再核对所在国家规则；国际通用问答在悬浮助手中查询。</p><button className="regional-ask" onClick={()=>{window.dispatchEvent(new CustomEvent('cargoplan-support-open'));window.webkit?.messageHandlers?.cargoPlan?.postMessage({type:'assistant-open',portCode:port.locode})}}>咨询当前港口 →</button></div>
    <div className="regional-coverage">本地 {rules.filter(r=>r.ports.length).length+allReviews.length} 条 · 国家继承 {rules.filter(r=>!r.ports.length).length} 条</div>
    <nav className="regional-filters" aria-label="筛选地区规则">{[['all','全部'],['access','道路通行'],['road','公路限重'],['penalty','处罚与整改']].map(([id,label])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}</nav>
    {local.map(rule => <PolicyCard key={rule.id} rule={rule} />)}
    {reviews.map(([id, r]) => <article className="atlas-rule" key={id}><div className="atlas-rule-head"><h4>{r.title}</h4><span className="atlas-reviewed">港别资料 · {r.kind}</span></div><p>{r.summary_zh}</p><ul>{r.conditions_zh?.map(s => <li key={s}>{s}</li>)}</ul><small>来源核对 {r.checked_at}</small><div className="atlas-sources">{safeSource(r.source) && <a href={safeSource(r.source)} target="_blank" rel="noreferrer">主管机构 / 港方原文 ↗</a>}</div></article>)}
    {!local.length && !reviews.length && <p className="atlas-gap">{category==='all'?'尚未录入该港已核对的地区专属条目。不会用 VGM、ISPM 15 等通用知识填充成当地差异。':'此分类尚无该港专属条目。以下国家规则单独列示。'}</p>}
    <h3 className="atlas-subtitle">海陆衔接 · {countryName(port.country, data.countries)}国家规则</h3>
    <p className="regional-scope">以下从国家层继承，适用于核查本地接驳；不是该港独有政策。</p>
    {inherited.map(rule => <PolicyCard key={rule.id} rule={rule} />)}
    {!inherited.length && <p className="atlas-gap">结构化公路处罚与接驳要求待补全。已有国别原始资料可在“国家法规”查看。</p>}
    <details className="atlas-raw"><summary>本港仍需确认的作业信息</summary><ul><li>具体码头、车辆预约、截关和承运人要求。</li><li>接驳道路 / 桥隧、车辆轴型与实际称重、通行凭证。</li><li>未收录的当地处罚裁量和商业收费。</li></ul></details>
  </section>
}
