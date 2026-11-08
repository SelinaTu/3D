// #created 11/08/2026
import { lazy,Suspense,useEffect,useMemo,useState } from 'react'
import { loadGlobeData } from './data'
import { countryName,packStatus,searchPorts,type GlobeData,type Port } from './model'
import { PortDetails } from './PortDetails'
import './globe.css'
const Scene=lazy(()=>import('./GlobeScene').then(m=>({default:m.GlobeScene})))

export function KnowledgeGlobe({standalone=false, initialPort=''}:{standalone?:boolean; initialPort?:string}) {
  const [data,setData]=useState<GlobeData|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  const [query,setQuery]=useState(''),[country,setCountry]=useState(''),[onlyPacks,setOnlyPacks]=useState(false),[limit,setLimit]=useState(50)
  const [selectedId,setSelectedId]=useState(initialPort),[hovered,setHovered]=useState<Port|null>(null),[spin,setSpin]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{let alive=true;setError('');loadGlobeData().then(d=>{if(alive)setData(d)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'知识数据加载失败')});return()=>{alive=false}},[attempt])
  useEffect(()=>setLimit(50),[query,country,onlyPacks])
  useEffect(()=>{if(initialPort)setSelectedId(initialPort)},[initialPort])
  const filtered=useMemo(()=>data?searchPorts(data,query,country,onlyPacks):[],[data,query,country,onlyPacks])
  const countries=useMemo(()=>data?[...new Set(data.ports.map(p=>p.country))].sort((a,b)=>Number(!!data.countries[b])-Number(!!data.countries[a]) || countryName(a,data.countries).localeCompare(countryName(b,data.countries),'zh-CN')):[],[data])
  const selected=data?.ports.find(p=>p.locode===selectedId)
  useEffect(()=>{if(!selected)return;window.dispatchEvent(new CustomEvent('cargoplan-port-selected',{detail:{portCode:selected.locode}}));window.webkit?.messageHandlers?.cargoPlan?.postMessage({type:'port-selected',portCode:selected.locode})},[selected])
  const thickCount=data?Object.values(data.countries).filter(c=>c.depth==='thick').length:0
  const points=useMemo(()=>selected && !filtered.some(p=>p.locode===selected.locode)?[...filtered,selected]:filtered,[filtered,selected])
  const choose=(p:Port)=>{setSelectedId(p.locode);setSpin(false)}
  const quick=(id:string)=>{const p=data?.ports.find(p=>p.locode===id);if(p){setQuery('');setCountry('');setOnlyPacks(false);choose(p)}}
  if(!data)return <main className="port-atlas atlas-loading" data-standalone={standalone}><div><small>3D CARGOPLAN / MARITIME INTELLIGENCE</small><h1>3D全球港口知识地球仪</h1><p role={error?'alert':'status'}>{error || '正在加载本地港点、国别包与作业知识…'}</p>{error && <button onClick={()=>setAttempt(n=>n+1)}>重新加载</button>}</div></main>
  return <main className="port-atlas" data-standalone={standalone}>
    <header className="atlas-heading"><div><small>MARITIME INTELLIGENCE / 海运作业知识库</small><h1>3D全球港口知识地球仪<span>KNOWLEDGE GLOBE</span></h1><p>从一个港点，查看装船要求、海陆衔接、处罚线索与承运人费用。</p></div><div className="atlas-date"><i />本地知识快照<strong>{data.meta.as_of}</strong></div></header>
    <div className="atlas-metrics"><div><strong>{data.ports.length.toLocaleString()}</strong><span>UN/LOCODE 港口地点</span></div><div><strong>{Object.keys(data.packs).length}</strong><span>已建港口知识包 · 含待完善</span></div><div><strong>{Object.keys(data.countries).length}</strong><span>国别包 · {thickCount} 个较厚 / {Object.keys(data.countries).length-thickCount} 个骨架</span></div><div><strong>{data.conventions.items.length}</strong><span>通用公约 / 装箱参考</span></div><p>港口功能编码不代表均有集装箱码头。<br />坐标覆盖 ≠ 合规资料覆盖。</p></div>
    <div className={`atlas-layout ${selected?'with-selection':''}`}>
      <aside className="atlas-discovery" aria-label="搜索和筛选港口"><div className="atlas-search"><label htmlFor="atlas-search-input">寻找一个港口</label><input id="atlas-search-input" aria-label="搜索港口" placeholder="上海 / CNSHA / 印度尼西亚" value={query} onChange={e=>setQuery(e.target.value)} /><div className="atlas-filter-row"><select aria-label="筛选国家地区" value={country} onChange={e=>setCountry(e.target.value)}><option value="">全部国家 / 地区</option>{countries.map(c=><option key={c} value={c}>{countryName(c,data.countries)} · {c}{data.countries[c]?' · 有国别包':''}</option>)}</select></div><label className="atlas-packs-toggle"><input type="checkbox" checked={onlyPacks} onChange={e=>setOnlyPacks(e.target.checked)} />只看已有知识包的港口</label></div>
        <div className="atlas-list-heading"><strong>港口索引</strong><span>{filtered.length.toLocaleString()} 个匹配</span></div><div className="atlas-port-list">{filtered.slice(0,limit).map(p=><button key={p.locode} className={p.locode===selectedId?'active':''} onClick={()=>choose(p)}><span className={data.packs[p.locode]?'atlas-dot has-pack':'atlas-dot'} /><span><b>{p.name_zh ?? p.name}</b><small>{p.locode} · {countryName(p.country,data.countries)}</small></span><em>{data.packs[p.locode]?'有资料':'坐标'}</em></button>)}{!filtered.length && <p className="atlas-no-match">没有匹配港点。试试 UN/LOCODE、英文名或国家名。</p>}{filtered.length>limit && <button className="atlas-show-more" onClick={()=>setLimit(n=>n+50)}>继续显示（已显示 {limit} / {filtered.length.toLocaleString()}）</button>}</div>
      </aside>
      <section className="atlas-earth-panel" aria-label="三维港口地球仪"><div className="atlas-globe-toolbar"><div><span className="atlas-dot has-pack" />已有知识包 <span className="atlas-dot" />基础坐标</div><button aria-pressed={spin} onClick={()=>setSpin(v=>!v)}>{spin?'暂停自转':'开启自转'}</button></div><div className="atlas-canvas"><Suspense fallback={<div className="atlas-globe-fallback">正在加载本地 3D 地球仪…</div>}><Scene data={data} ports={points} selected={selected} spin={spin} onSelect={choose} onHover={setHovered} /></Suspense></div><div className="atlas-hover-info">{hovered?<><b>{hovered.name_zh ?? hovered.name}</b><span>{hovered.locode} · {packStatus(data.packs[hovered.locode])}</span></>:<><b>拖动探索世界 · 滚轮缩放</b><span>点击亮点，打开对应港口的知识档案</span></>}</div><div className="atlas-quick-ports"><span>快速定位</span>{[['CNSHA','上海'],['CNSZX','深圳'],['IDTPP','丹戎不碌'],['SGSIN','新加坡'],['NLRTM','鹿特丹']].map(([id,label])=><button key={id} onClick={()=>quick(id)}>{label}</button>)}</div></section>
      {selected?<PortDetails key={selected.locode} data={data} port={selected} onClose={()=>setSelectedId('')} />:<aside className="atlas-empty-detail"><span className="atlas-compass">◎</span><small>SELECT A PORT</small><h2>点亮港口<br />读懂作业要求</h2><p>点击地球上的港点，或从左侧索引选择。</p><ol><li><b>01 公约</b><span>SOLAS · CTU · CSC · ISPM 15 · IMDG</span></li><li><b>02 国家</b><span>VGM、公路限制与执法线索</span></li><li><b>03 港口</b><span>作业核查清单与本地资料</span></li><li><b>04 费用</b><span>承运人商业费用，单独标记</span></li></ol><p className="atlas-empty-note">多数港点只有坐标；资料缺口会明确标出，未收录不代表没有规定。</p></aside>}
    </div>

    <footer className="atlas-footer"><span>港点：UN/LOCODE 开放镜像 · 地理底图：<a href={data.land.url} target="_blank" rel="noreferrer">Natural Earth</a> · 仅作位置参考</span><span>知识只作业务核查参考，不自动作为装配引擎的硬约束；以主管机关、码头及承运人最新要求为准。</span></footer>
  </main>
}
