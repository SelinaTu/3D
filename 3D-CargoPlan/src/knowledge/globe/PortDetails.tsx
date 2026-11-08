// #created 11/08/2026
import { useState,type ReactNode } from 'react'
import { countryName,packStatus,safeSource,uniqueFees,type Check,type Fine,type GlobeData,type Port,type Source,type Vgm } from './model'
import { RegionalSummary } from './RegionalSummary'
import { appliesToPort } from './regional'
const axleNames:Record<string,string>={'2-axle truck':'二轴货车','3-axle truck':'三轴货车','3-axle combination':'三轴汽车列车','4-axle truck':'四轴货车','4-axle combination':'四轴汽车列车','5-axle combination':'五轴汽车列车','6+-axle combination':'六轴及以上汽车列车','6+-axle combo (drive axle single)':'六轴及以上列车 · 单驱动轴'}
const confidenceNames:Record<string,string>={primary:'附原始来源',official_secondary:'官方及二级资料整理',industry:'行业资料整理',unverified:'尚未核实'}
const titles:Record<string,string>={vgm_before_load:'装船前提供核实总质量 VGM',cn_road_gross_mass:'按车辆轴型核对公路车货总质量',road_gross_mass_vs_axles:'按车辆轴型核对公路车货总质量',customs_packing_list_align:'装箱单与装载方案保持一致',ispm15_if_wood:'木质包装核查 ISPM 15 标识',id_vgm_required:'核查 PM 25/2022 的 VGM 要求',id_csc_max_gross:'核查 CSC 铭牌最大总质量',id_vgm_deviation_5pct:'复称偏差门槛与重新申报要求',id_road_mst_class:'道路等级与 MST 轴载限制',id_jbi_vehicle_plate:'向车队取得 KIR 铭牌及 JBI/JBKI',id_odol_pasal277_307:'区分超限与非法改装的处罚条款',id_ispm15_wood:'木质包装处理及标识'}
function Sources({items=[]}:{items?:Source[]}) {
  return <div className="atlas-sources">{items.map((s,i)=>{const url=typeof s==='string'?s:s.url,link=safeSource(url);return link?<a key={i} href={link} target="_blank" rel="noreferrer">↗ {typeof s==='string'?new URL(link).hostname:s.title ?? new URL(link).hostname}</a>:<span key={i}>整理分册：{url}</span>})}</div>
}
function RawNotes({items}:{items?:string[]}){return items?.length?<details className="atlas-raw"><summary>原始整理备注（含待核实线索）</summary><ul>{items.map((n,i)=><li key={i}>{n}</li>)}</ul></details>:null}
function Checklists({items=[]}:{items?:Check[]}) {
  return <div className="atlas-checks">{items.map(c=><article key={c.id}><span className={`atlas-severity ${c.severity}`}>{c.severity==='block'?'装船 / 作业条件':c.severity==='warn'?'重点核查':'资料核对'}</span><h4>{titles[c.id] ?? c.title ?? c.id}</h4>{c.detail && <p>{c.detail}</p>}<Sources items={c.sources} />{!c.evidence_refs?.length && <small className="atlas-pending">证据库指针待核实</small>}{c.evidence_refs?.map(e=><details className="atlas-raw" key={e.source_id}><summary>查看来源文件指纹 · 适用性待核实</summary><p>{e.locator} · {e.page ? `第 ${e.page} 页` : "网页来源，无页码"}</p><p>source_id: {e.source_id}<br />SHA-256: {e.sha256}</p></details>)}</article>)}</div>
}
function VGM({value}:{value?:Vgm}){return value?<div className="atlas-rule"><h4>集装箱核实总质量 VGM</h4><p>{value.required_for_load?'资料记录为装船前置条件；适用范围和本地执行细则需核对。':'本层未录入装船条件。'}</p>{value.statute && <p>法规线索：{value.statute}</p>}{(value.tolerance_note || value.note) && <details className="atlas-raw"><summary>当地容差 / 执行线索（待复核）</summary><p>{value.tolerance_note ?? value.note}</p></details>}<Sources items={value.sources} /></div>:null}
function Fines({items=[]}:{items?:Fine[]}){return <>{items.length?items.map((f,i)=>{const traceable=f.sources?.some(s=>safeSource(typeof s==='string'?s:s.url));return <article className="atlas-rule" key={`${f.id}-${i}`}><div className="atlas-rule-head"><h4>{f.id}</h4><span className="atlas-pending">整理记录 · 待业务复核</span></div>{f.cap!==undefined && traceable && <p className="atlas-fine-amount">记录上限 {f.currency} {f.cap.toLocaleString()}<small>不是自动计算的罚单；需确认条文、主体和适用情形。</small></p>}{traceable?<details className="atlas-raw"><summary>原始条文整理摘要</summary><p>{f.formula_note}</p></details>:<p>尚无可直接核验的外部出处，不展示金额结论。</p>}<Sources items={f.sources} /></article>}):<p className="atlas-gap">未录入可追溯的处罚条目。不代表没有处罚。</p>}</>}
const docs=import.meta.glob('../../../docs/port-knowledge/**/*.md',{eager:true,query:'?raw',import:'default'})
function Topics({data,port,layer}:{data:GlobeData;port:Port;layer:string}) {
  return <>{Object.entries(data.reviews).filter(([,r])=>r.layer===layer && appliesToPort(r,port)).map(([id,r])=><article className="atlas-rule" key={id}><div className="atlas-rule-head"><h4>{r.title}</h4><span className="atlas-reviewed">{r.kind ?? '官方页面已核对'} · {r.checked_at}</span></div><p>{r.summary_zh}</p>{r.conditions_zh && <ul>{r.conditions_zh.map(c=><li key={c}>{c}</li>)}</ul>}<Sources items={[r.source]} /></article>)}</>
}

export function PortDetails({data,port,onClose}:{data:GlobeData;port:Port;onClose:()=>void}) {
  const [tab,setTab]=useState<'regional'|'convention'|'country'|'port'|'carrier'>('regional')
  const pack=data.packs[port.locode],country=data.countries[port.country],fees=uniqueFees(pack,country)
  let content:ReactNode
  if(tab==='regional')content=<RegionalSummary data={data} port={port} />
  else if(tab==='convention')content=<>{data.conventions.items.map(item=>{
    const review=data.reviews[item.id]
    return <article className="atlas-rule" key={item.id}><div className="atlas-rule-head"><h4>{item.title_zh ?? item.title}</h4><span className={review?'atlas-reviewed':'atlas-pending'}>{review?'官方页面已核对':'已有出处 · 待业务复核'}</span></div><p>{review?.summary_zh ?? item.summary_zh ?? item.summary}</p>{review?.conditions_zh && <ul>{review.conditions_zh.map(c=><li key={c}>{c}</li>)}</ul>}{(review?.effective ?? item.effective) && <small>生效 / 公告：{review?.effective ?? item.effective}</small>}<Sources items={item.sources} /></article>
  })}<p className="atlas-gap">这里是通用参考，不是自动判定某票货物适用全部公约。</p></>
  else if(tab==='country')content=country?<>
    <div className="atlas-layer-note">{countryName(port.country,data.countries)} · {country.depth==='thick'?'已有较多结构化条目':'国别骨架，待补全'}<br />资料日期 {country.as_of} · {confidenceNames[country.confidence] ?? '来源待复核'}；不代表已逐条核验。</div>
    <Topics data={data} port={port} layer="country" />
    <VGM value={country.vgm} />
    {country.road_limits && <article className="atlas-rule"><h4>海陆衔接 · 公路限重</h4><p>车货总质量、道路轴载与集装箱净载重分别核对。</p>{country.road_limits.table_kg && <table><thead><tr><th>车辆轴型</th><th>车货总质量 kg</th></tr></thead><tbody>{Object.entries(country.road_limits.table_kg).map(([k,v])=><tr key={k}><td>{axleNames[k] ?? k}</td><td>{v.toLocaleString()}</td></tr>)}</tbody></table>}{country.road_limits.mst_t && <ul>{Object.entries(country.road_limits.mst_t).map(([k,v])=><li key={k}>{k} · MST 轴载参考 {v} t</li>)}</ul>}<RawNotes items={[country.road_limits.statute,country.road_limits.note,country.road_limits.jbi_note].filter((s):s is string=>!!s)} /><Sources items={country.road_limits.sources} /></article>}
    <h3 className="atlas-subtitle">处罚与执法线索</h3><Fines items={country.fine_refs} /><Checklists items={country.checklists} /><RawNotes items={country.notes} /><Sources items={country.sources} />
  </>:<div className="atlas-gap">{countryName(port.country,data.countries)}尚无国别规则包。目前只能查看该港基础资料与通用公约参考。</div>
  else if(tab==='port')content=pack?<>
    <div className="atlas-layer-note">{packStatus(pack)} · 资料日期 {pack.as_of}<br />“已有知识包”不表示档案完整或所有条目已经核验。</div>
    <Topics data={data} port={port} layer="port" />
    <VGM value={pack.vgm} /><h3 className="atlas-subtitle">港口作业核查清单</h3><Checklists items={pack.checklists} />
    <h3 className="atlas-subtitle">处罚线索</h3><Fines items={pack.fine_refs} /><RawNotes items={pack.notes} /><Sources items={pack.sources} />
    {pack.knowledge_paths?.map(path=>{const raw=docs[`../../../docs/${path}`];return typeof raw==='string'?<details className="atlas-raw atlas-dossier" key={path}><summary>阅读整理分册 · {path.split('/').at(-1)}</summary><pre>{raw}</pre></details>:null})}
    <p className="atlas-gap">未录入港别机器可读装箱禁令；不能据此推断不存在当地规定。</p>
  </>:<div className="atlas-gap"><h4>此港尚无专属作业知识包</h4><p>已有 UN/LOCODE、港名、国别和坐标。没有核验码头、集装箱作业能力、截关时间、危货许可、罚款与本地收费。</p><p>可以先查看通用公约与已有国别资料。</p><code>Function {port.functions || '未记录'}</code></div>
  else content=<><div className="atlas-commercial">港口收费、船司商业附加费与政府行政罚款分别列示。</div><Topics data={data} port={port} layer="fees" />{fees.length?fees.map(f=>{
    const review=data.reviews[f.id]
    return <article className="atlas-rule" key={`${f.carrier}-${f.id}`}><div className="atlas-rule-head"><h4>{f.carrier ?? '承运人'} · {f.id}</h4><span className={review?'atlas-reviewed':'atlas-pending'}>{review?'承运人公告已核对':'待核实'}</span></div>{f.amount_usd!==undefined && <p className="atlas-fine-amount">USD {f.amount_usd.toLocaleString()} / {f.per==='container'?'柜':f.per}</p>}<p>{review?.summary_zh ?? f.note}</p>{review?.conditions_zh && <><h4>公告所列触发条件</h4><ul>{review.conditions_zh.map(c=><li key={c}>{c}</li>)}</ul></>}{review && <small>{review.effective} · 页面核对 {review.checked_at}</small>}<Sources items={f.sources} /></article>
  }):<p className="atlas-gap">本港 / 本国尚无已整理的船司商业附加费条目。未覆盖的船公司、堆存、滞箱和附加费须向承运人及码头核实。</p>}</>
  return <aside className="atlas-details" aria-label="港口知识详情"><header><div><small>PORT DOSSIER / 港口档案</small><h2>{port.name_zh ?? port.name}</h2><p>{[port.name_zh?port.name:'',port.locode,countryName(port.country,data.countries)].filter(Boolean).join(' · ')}</p></div><button onClick={onClose} aria-label="关闭港口详情">×</button></header><div className="atlas-port-facts"><span className={pack?'has-pack':''}>{packStatus(pack)}</span><span>{port.lat.toFixed(4)}°, {port.lon.toFixed(4)}°</span></div><nav aria-label="知识层级">{([['regional','\u5730\u533a\u5dee\u5f02'],['country','\u56fd\u5bb6\u6cd5\u89c4'],['port','\u6e2f\u53e3\u4f5c\u4e1a'],['carrier','\u5546\u4e1a\u8d39\u7528'],['convention','\u901a\u7528\u516c\u7ea6']] as const).map(([id,label])=><button className={tab===id?'active':''} key={id} onClick={()=>setTab(id)}>{label}</button>)}</nav><div className="atlas-detail-body" key={`${port.locode}-${tab}`}>{content}</div><footer>数据整理截至 {data.meta.as_of}。仅“已核对”条目标示本次来源检查；金额与当地执行须在实际业务前复核。</footer></aside>
}
