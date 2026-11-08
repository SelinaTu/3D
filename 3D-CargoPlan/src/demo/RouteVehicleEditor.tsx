// #created 11/08/2026
import type { RouteProblem,RouteVehicle,Door } from '../core/multistop/model'
import { VEHICLES,routeVehicle } from '../core/multistop/vehicles'
import { DOORS,doorLabel } from '../core/multistop/doors'
import { DEFAULT_HANDLING } from '../core/multistop/access'
export function RouteVehicleEditor({problem,busy,onChange}:{problem:RouteProblem;busy:boolean;onChange:(p:RouteProblem)=>void}) {
  const v=routeVehicle(problem),preset=VEHICLES.find(p=>p.id===v.id),handling=problem.handling ?? DEFAULT_HANDLING
  const update=(next:RouteVehicle)=>onChange({...problem,vehicle:next,door:next.doors[0]})
  const toggle=(face:Door)=>{
    const doors=v.doors.includes(face)?v.doors.filter(d=>d!==face):[...v.doors,face]
    if(!doors.length)return
    onChange({...problem,vehicle:{...v,doors},door:doors[0],handling:face==='z-max' && doors.includes(face)?{...handling,mode:'mechanical'}:handling})
  }
  return <fieldset className="route-vehicle-editor" disabled={busy}>
    <div className="route-vehicle-icon" aria-hidden="true"><svg viewBox="0 0 128 65" fill="none"><path d="M9 13h76v34H9z" fill="#324b68" stroke="#8aa7cb" strokeWidth="1.5"/>{preset?.body==='flatbed'?<path d="M9 13h76v29H9z" fill="#151e28"/>:preset?.body==='curtain'?Array.from({length:7},(_,i)=><path key={i} d={`M${18+i*9} 16v27`} stroke="#7395bd"/>):null}<path d="M85 29h19l15 15v3H85V29Z" fill="#46688f" stroke="#8aa7cb"/><path d="M89 31h12l9 10H89V31Z" fill="#a1c3e0"/><path d="M6 48h116" stroke="#8aa7cb" strokeWidth="3"/>{[25,71,105].map(x=><g key={x}><circle cx={x} cy="51" r="8" fill="#101720" stroke="#7892af"/><circle cx={x} cy="51" r="3" fill="#8aa7cb"/></g>)}</svg><span>{v.doors.map(d=>doorLabel[d]).join(' / ')}</span></div>
    <div className="route-vehicle-controls"><div className="route-vehicle-title"><label>车型模板<select aria-label="选择车型" value={preset?.id ?? 'custom'} onChange={e=>{const p=VEHICLES.find(v=>v.id===e.target.value);if(p)onChange({...problem,vehicle:structuredClone(p),door:p.doors[0],handling:{...handling,mode:p.mode}});else onChange({...problem,vehicle:undefined,door:problem.initial.unloadingDoor ?? 'x-max',handling:{...handling,mode:'worker-aisle'}})}}><option value="custom">当前装配 / 自定义货舱</option>{VEHICLES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>装卸作业<select aria-label="车辆作业方式" value={handling.mode} onChange={e=>onChange({...problem,handling:{...handling,mode:e.target.value as typeof handling.mode}})}><option disabled={v.doors.every(d=>d==='z-max')} value="worker-aisle">工人进舱 · 检查走道</option><option disabled={v.doors.every(d=>d==='z-max')} value="door-only">仅门外取货</option><option value="mechanical">设备抽取 / 吊装</option></select></label><div className="route-vehicle-faces"><span>可用装卸面</span><div>{DOORS.map(d=><button type="button" key={d} aria-pressed={v.doors.includes(d)} disabled={v.doors.length===1 && v.doors[0]===d} className={v.doors.includes(d)?'active':''} onClick={()=>toggle(d)}>{doorLabel[d]}</button>)}</div></div></div>
      <div className="route-vehicle-dimensions">{(['length','width','height'] as const).map((key,i)=><label key={key}>{['内长','内宽','内高 / 装高'][i]} <small>mm</small><input aria-label={`车辆${['内长','内宽','内高'][i]}`} type="number" min="100" max="50000" value={v.dimensions[key] || ''} onChange={e=>update({...v,dimensions:{...v.dimensions,[key]:Number(e.target.value)}})}/></label>)}<label>额定载货 <small>kg</small><input aria-label="车辆额定载货" type="number" min="1" value={v.maxWeight || ''} onChange={e=>update({...v,maxWeight:Number(e.target.value)})}/></label><div className="route-vehicle-volume"><strong>{(v.dimensions.length*v.dimensions.width*v.dimensions.height/1e9).toFixed(1)}<small> m³</small></strong><span>货舱几何容积</span></div></div>
      <p>{preset?.hint ?? '按实际车辆净空配置。'} · 模板规格与载重为可编辑示例，不代表法规限值。更换车型保留清单，主动计算后生效。装卸面按整面开启模拟，门洞、侧柱及吊具净空尚未校核。</p>
    </div>
  </fieldset>
}
