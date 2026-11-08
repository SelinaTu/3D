// #created 11/08/2026
import { dimensionText } from './format-dimensions'
import { useMemo, useState } from 'react'
import type { CargoItem, Container, HandlingAccess } from '../types/packing'
import type { RouteProblem } from '../core/multistop/model'
import { inventoryBefore } from '../core/multistop/planning'
import { DEFAULT_HANDLING } from '../core/multistop/access'

export function emptyRoute(initial:Container,door:'x-min'|'x-max'):RouteProblem {
  return {schema:'cargoplan.route-problem/v1',seed:0,door,initial:structuredClone(initial),handling:{...DEFAULT_HANDLING},description:'用户手工编排的多站装卸计划。',stops:Array.from({length:3},(_,i)=>({name:`站点 ${i+1}`,unloadIds:[],pickup:[]}))}
}
const groupKey=(item:CargoItem)=>JSON.stringify([item.name,item.category,item.dimensions,item.rawData._sourceSheet,item.rawData._sourceRow])
function groups(items:CargoItem[]) {const map=new Map<string,CargoItem[]>();items.forEach(item=>{const key=groupKey(item);map.set(key,[...(map.get(key) ?? []),item])});return [...map.values()]}
const blank=():CargoItem=>({id:'draft',name:'新增货物',category:'包装箱',dimensions:{length:1000,width:800,height:800},weight:100,quantity:1,allowedOrientations:['standing'],canStackOnTop:false,canOffsetStack:false,hasGlass:false,colorTag:'#60a5fa',rawData:{}})

export function RouteComposer({problem,station,busy,onChange,onStation}:{problem:RouteProblem;station:number;busy:boolean;onChange:(p:RouteProblem)=>void;onStation:(i:number)=>void}) {
  const [search,setSearch]=useState(''),[draft,setDraft]=useState<CargoItem>(blank),[quantity,setQuantity]=useState(1),[destination,setDestination]=useState(-1),[message,setMessage]=useState('')
  const stop=problem.stops[station],handling=problem.handling ?? DEFAULT_HANDLING
  const inventory=useMemo(()=>groups(inventoryBefore(problem,station)),[problem,station])
  const catalog=useMemo(()=>groups(problem.initial.items.map(p=>p.item)),[problem.initial])
  const change=(edit:(p:RouteProblem)=>void)=>{const next=structuredClone(problem);edit(next);onChange(next)}
  const setUnload=(items:CargoItem[],count:number)=>{
    const ids=items.slice(0,Math.max(0,Math.min(items.length,Math.floor(count)))).map(i=>i.id)
    change(p=>{p.stops.forEach(s=>s.unloadIds=s.unloadIds.filter(id=>!ids.includes(id)));p.stops[station].unloadIds=p.stops[station].unloadIds.filter(id=>!items.some(i=>i.id===id)).concat(ids)})
  }
  const removePickup=(items:CargoItem[])=>change(p=>p.stops.forEach(s=>{s.pickup=s.pickup.filter(i=>!items.some(o=>o.id===i.id));s.unloadIds=s.unloadIds.filter(id=>!items.some(o=>o.id===id))}))
  const assign=(ids:string[],at:number)=>change(p=>{p.stops.forEach(s=>s.unloadIds=s.unloadIds.filter(id=>!ids.includes(id)));if(at>station && p.stops[at])p.stops[at].unloadIds.push(...ids)})
  const addPickup=()=>{
    if(!draft.name.trim() || !Number.isInteger(quantity) || quantity<1 || quantity>1000 || ![...Object.values(draft.dimensions),draft.weight].every(Number.isFinite) || Object.values(draft.dimensions).some(n=>n<=0) || draft.weight<0){setMessage('请填写有效名称、尺寸、重量和 1–1000 件数量');return}
    const units=Array.from({length:quantity},()=>({...structuredClone(draft),id:`pickup-${crypto.randomUUID()}`,quantity:1}))
    change(p=>{p.stops[station].pickup.push(...units);if(destination>station && p.stops[destination])p.stops[destination].unloadIds.push(...units.map(i=>i.id))});setMessage('')
  }
  const setHandling=(patch:Partial<HandlingAccess>)=>change(p=>{p.handling={...handling,...patch}})
  return <fieldset className="route-composer" disabled={busy}>
    <aside className="route-stop-rail"><div className="route-section-label">行程站序 <span>{problem.stops.length} 站</span></div>
      {problem.stops.map((s,i)=><button key={i} type="button" className={`route-stop-card ${i===station?'active':''}`} onClick={()=>onStation(i)}><span className="route-stop-index">{String(i+1).padStart(2,'0')}</span><span><strong>{s.name}</strong><small>卸 {s.unloadIds.length} 件 · 装 {s.pickup.length} 件</small></span><span className="route-stop-arrow">›</span></button>)}
      <button className="route-add-stop" onClick={()=>change(p=>p.stops.push({name:`站点 ${p.stops.length+1}`,unloadIds:[],pickup:[]}))}>＋ 添加站点</button>
      <div className="route-rail-note">按行程顺序填写每站需求。计划清单只描述需求，点击计算后才产生实际装卸步骤。</div>
    </aside>
    <div className="route-stop-body">
      <div className="route-stop-heading"><label>站点名称<input aria-label="站点名称" value={stop.name} onChange={e=>change(p=>{p.stops[station].name=e.target.value})}/></label><button className="route-danger" disabled={problem.stops.length===1} onClick={()=>{const ids=stop.pickup.map(i=>i.id);const next=structuredClone(problem);next.stops.splice(station,1);next.stops.forEach(s=>s.unloadIds=s.unloadIds.filter(id=>!ids.includes(id)));onStation(Math.max(0,station-1));onChange(next)}}>删除站点</button></div>
      <div className="route-order-controls"><span>移动站序</span>{[-1,1].map(delta=><button key={delta} disabled={!problem.stops[station+delta]} onClick={()=>{change(p=>{[p.stops[station],p.stops[station+delta]]=[p.stops[station+delta],p.stops[station]]});onStation(station+delta)}}>{delta<0?'↑ 前移':'↓ 后移'}</button>)}</div>
      <section className="route-manifest-editor"><div className="route-section-label">本站卸货 <span>{stop.unloadIds.length} 件</span></div><p>仅列出本站到达前计划在车的货物；填写件数即分配到本站，原有后站分配会随之移动。</p><input className="route-search" aria-label="搜索在车货物" placeholder="搜索名称或货号" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="route-inventory-list">{inventory.filter(items=>items[0].name.toLowerCase().includes(search.toLowerCase()) || items.some(i=>i.id.includes(search))).map(items=>{const item=items[0],selected=items.filter(i=>stop.unloadIds.includes(i.id)).length;return <div className="route-inventory-row" key={groupKey(item)}><i className="route-cargo-swatch" style={{background:item.colorTag.startsWith('#')?item.colorTag:'#76a6b9'}}/><span><strong>{item.name}</strong><small>{dimensionText(item.dimensions)} mm · 在车 {items.length} 件</small></span><label>卸<input aria-label={`卸货数量 ${item.name}`} type="number" min="0" max={items.length} step="1" value={selected} onChange={e=>setUnload(items,Number(e.target.value))}/></label><button onClick={()=>setUnload(items,selected===items.length?0:items.length)}>{selected===items.length?'清空':'全选'}</button></div>})}{!inventory.length && <div className="route-empty">到站前为空车，可在下方添加取货需求。</div>}</div>
      </section>
      <section className="route-manifest-editor"><div className="route-section-label">本站装货 <span>{stop.pickup.length} 件</span></div>
        {groups(stop.pickup).map(items=>{const item=items[0],at=problem.stops.findIndex(s=>s.unloadIds.includes(item.id));return <div className="route-pickup-row" key={groupKey(item)}><span><strong>{item.name} × {items.length}</strong><small>{dimensionText(item.dimensions)} mm · {item.weight} kg / 件</small></span><select aria-label={`目的站 ${item.name}`} value={at} onChange={e=>assign(items.map(i=>i.id),Number(e.target.value))}><option value={-1}>本段结束后留车</option>{problem.stops.map((s,i)=>i>station?<option key={i} value={i}>{i+1}. {s.name}</option>:null)}</select><button className="route-danger" onClick={()=>removePickup(items)}>移除</button></div>})}
        <div className="route-pickup-form"><label>货物模板<select aria-label="取货模板" value="" onChange={e=>{setDraft(e.target.value?structuredClone(catalog[Number(e.target.value)][0]):blank())}}><option value="">自定义货物 / 选择现有规格…</option>{catalog.map((items,i)=><option key={i} value={i}>{items[0].name} · {dimensionText(items[0].dimensions)}</option>)}</select></label><div className="route-input-grid"><label className="route-input-wide">货物名称<input aria-label="取货名称" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>{(['length','width','height'] as const).map((key,i)=><label key={key}>{['长','宽','高'][i]} mm<input aria-label={`取货${['长','宽','高'][i]}`} type="number" min="1" value={draft.dimensions[key]} onChange={e=>setDraft({...draft,dimensions:{...draft.dimensions,[key]:Number(e.target.value)}})}/></label>)}<label>重量 kg / 件<input aria-label="取货重量" type="number" min="0" value={draft.weight} onChange={e=>setDraft({...draft,weight:Number(e.target.value)})}/></label><label>数量<input aria-label="取货数量" type="number" min="1" max="1000" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label><label>交付站<select aria-label="取货交付站" value={destination>station && problem.stops[destination]?destination:-1} onChange={e=>setDestination(Number(e.target.value))}><option value={-1}>本段结束后留车</option>{problem.stops.map((s,i)=>i>station?<option key={i} value={i}>{i+1}. {s.name}</option>:null)}</select></label></div><label className="route-check"><input type="checkbox" checked={draft.canStackOnTop} onChange={e=>setDraft({...draft,canStackOnTop:e.target.checked})}/>允许其他货物堆在上方</label><button className="route-add-pickup" onClick={addPickup}>＋ 加入本站装货清单</button>{message && <p role="alert">{message}</p>}<p>新建货物默认原姿态直立；选择现有模板会保留其方向、承重与空腔约束。</p></div>
      </section>
      <details className="route-handling" open><summary>人员可达与作业方式</summary><div className="route-input-grid"><label className="route-input-wide">作业方式<select aria-label="作业方式" value={handling.mode} onChange={e=>setHandling({mode:e.target.value as HandlingAccess['mode']})}><option value="worker-aisle">工人进舱 · 校验连通走道</option><option value="door-only">仅门外取货 · 禁止深入</option><option value="mechanical">设备直线抽取 · 不校验人员通道</option></select></label>{(['aisleWidthMm','aisleHeightMm','reachMm','maxReachHeightMm'] as const).map((key,i)=><label key={key}>{['通道宽度','通道净高','水平取货距离','可触及高度'][i]} mm<input aria-label={['通道宽度','通道净高','水平取货距离','可触及高度'][i]} type="number" min="100" max="10000" value={handling[key]} onChange={e=>setHandling({[key]:Number(e.target.value)})}/></label>)}</div><p>数值为可调整的规划假设。走道使用地面方形占位与净高检查，不允许攀爬或穿过低矮货物；不替代搬运重量、门洞、设备或现场安全校核。</p></details>
    </div>
  </fieldset>
}
