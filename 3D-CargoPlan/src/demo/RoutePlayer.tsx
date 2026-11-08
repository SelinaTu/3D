// #created 11/08/2026
import { doorLabel,doorAxis } from '../core/multistop/doors'
import { dimensionText } from './format-dimensions'
import { lazy,Suspense,useEffect,useMemo,useRef,useState } from 'react'
import type { Simulation } from '../core/multistop/model'
import { buildPlayback,playbackFrame } from '../core/multistop/playback'
const Viewer=lazy(()=>import('../components/ContainerViewer').then(m=>({default:m.ContainerViewer})))
const actions={unload:'卸货','temporary-out':'临时移出',return:'放回车内',pickup:'装入车内'} as const
const short={unload:'卸','temporary-out':'移',return:'回',pickup:'装'} as const
const colors={unload:'#d47532','temporary-out':'#3c78b1',return:'#3c78b1',pickup:'#168766'} as const
export type StationFocus={station:number;token:number}

export function RoutePlayer({result,focus,onStationChange}:{result:Simulation;focus:StationFocus;onStationChange:(station:number)=>void}) {
  const steps=useMemo(()=>buildPlayback(result),[result])
  const [cursor,setCursor]=useState(0),[phase,setPhase]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[labels,setLabels]=useState(true)
  const phaseRef=useRef(0)
  const fraction=(n:number)=>{phaseRef.current=n;setPhase(n)}
  const jump=(index:number)=>{setPlaying(false);setCursor(Math.max(0,Math.min(steps.length,index)));fraction(0)}
  useEffect(()=>{setPlaying(false);setCursor(0);fraction(0)},[result])
  useEffect(()=>{
    const index=steps.findIndex(s=>s.stationIndex===focus.station)
    if(index>=0){setPlaying(false);setCursor(index);fraction(0)}
  },[focus,steps])
  const step=steps[cursor],stationIndex=step?.stationIndex ?? result.stops.length-1,stop=result.stops[stationIndex]
  useEffect(()=>onStationChange(stationIndex),[stationIndex,onStationChange])
  useEffect(()=>{
    if(!playing || !step) return
    const duration=(step.operation ? 1800:650)/speed,start=performance.now()-phaseRef.current*duration
    let request=0,last=0
    const tick=(now:number)=>{
      const next=Math.min(1,(now-start)/duration)
      if(next>=1){fraction(0);setCursor(c=>c+1);if(cursor+1>=steps.length)setPlaying(false);return}
      if(now-last>=32){fraction(next);last=now}
      request=requestAnimationFrame(tick)
    }
    request=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(request)
  },[playing,step,speed,cursor,steps.length])
  const frame=useMemo(()=>step ? playbackFrame(step,phase,result.door):result.stops.at(-1)!.after,[step,phase,result])
  const op=step?.operation,face=op?.door ?? result.initial.routeDoors?.[0] ?? result.door
  const nextOperations=stop.operations.slice(Math.max(0,step?.operationIndex ?? stop.operations.length))
  const tags=new Map<string,{id:string;label:string;title:string;color:string}>()
  nextOperations.forEach((next,i)=>{if(!tags.has(next.itemId))tags.set(next.itemId,{id:next.itemId,label:`${short[next.action]}${Math.max(0,step?.operationIndex ?? 0)+i+1}`,title:`${actions[next.action]} · ${next.name} · ${next.itemId}`,color:colors[next.action]})})
  const annotated=labels && step ? [...tags.values()]:[]
  const display={...frame,centerOfGravity:undefined,items:frame.items.map(p=>({...p,item:{...p.item,colorTag:p.item.id===op?.itemId?colors[op.action]:tags.has(p.item.id)?'#b9cec3':'#c1ccca'}}))}
  const moving=op?frame.items.find(p=>p.item.id===op.itemId):undefined
  const extension=useMemo(()=>Math.max(1000,...steps.flatMap(s=>s.operation?[Math.max(...Object.values(s.operation.placement.actualDimensions))*1.35+300]:[])),[steps])
  const chooseCargo=(id:string)=>{
    const target=steps.findIndex((s,i)=>i>=cursor && s.stationIndex===stationIndex && s.operation?.itemId===id)
    if(target>=0) jump(target)
  }
  return <div className="route-player">
    <div className="route-player-heading"><div><small>EXECUTION PLAYER / 同一份引擎作业记录驱动</small><h3>{stationIndex+1}. {stop.name}</h3><p aria-live="polite">{!step?'全程播放结束':op?`第 ${step.operationIndex+1} / ${stop.operations.length} 步 · ${actions[op.action]} · ${op.name}`:'到达站点 · 查看待卸和待装清单'}</p></div><label><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)} />显示 3D 作业序号</label></div>
    <div className="route-player-viewport" data-testid="route-animation" data-station={stationIndex+1} data-step={step?.operationIndex ?? -1} data-phase={phase.toFixed(3)} data-moving-x={moving?.position.x.toFixed(2) ?? ''}>
      <Suspense fallback={<div className="studio-placeholder">加载 3D 播放器…</div>}><Viewer tone={new URLSearchParams(location.search).has('native')?'dark':'light'} container={display} selectedId={null} onSelect={chooseCargo} annotations={annotated} viewExtension={{door:face,distanceMm:extension}} /></Suspense>
      <div className="route-player-overlay"><b>{op?`本步方向 · ${doorLabel[face]}`:`可用方向 · ${(result.initial.routeDoors ?? [result.door]).map(d=>doorLabel[d]).join(' / ')}`} </b><span>橙：卸出　绿：装入　蓝：临移 / 放回</span>{result.initial.handlingAccess && <span>{result.initial.handlingAccess.mode==='worker-aisle'?`人员进舱 · 通道 ${result.initial.handlingAccess.aisleWidthMm} mm · 取货 ${result.initial.handlingAccess.reachMm} mm`:result.initial.handlingAccess.mode==='door-only'?`仅门外取货 ${result.initial.handlingAccess.reachMm} mm`:'设备抽取 · 未校验人员通道'}</span>}{op && <span>{step.before.items.length} → {step.after.items.length} 件 · 稳定状态库存</span>}</div>
    </div>
    <div className="route-player-controls"><button onClick={()=>jump(0)} aria-label="回到全程起点">↺ 起点</button><button disabled={cursor===0} onClick={()=>jump(cursor-1)}>上一步</button><button className="route-play-primary" onClick={()=>{if(cursor>=steps.length){setCursor(0);fraction(0)}setPlaying(v=>!v)}}>{playing?'暂停':cursor>=steps.length?'重播全程':'播放全程'}</button><button disabled={cursor>=steps.length} onClick={()=>jump(cursor+1)}>下一步</button><label>速度 <select aria-label="播放速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,1,2,4].map(n=><option value={n} key={n}>{n}×</option>)}</select></label><output>{cursor} / {steps.length} 段（含到站）</output></div>
    <label className="route-player-seek">全程进度<input type="range" aria-label="全程作业进度" min="0" max={steps.length} step="1" value={cursor} onChange={e=>jump(Number(e.target.value))} /></label>
    <label className="route-player-seek">当前动作 {Math.round(phase*100)}%<input type="range" aria-label="当前动作进度" min="0" max="1" step="0.01" value={phase} disabled={!op} onChange={e=>{setPlaying(false);fraction(Number(e.target.value))}} /></label>
    {op && <p className="route-player-coordinate">{op.itemId} · {({standing:'立放',lying:'侧放',flat:'平放'})[op.placement.orientation]} / 水平 {op.placement.rotation}° · 实占 {dimensionText(op.placement.actualDimensions)} mm<br />目标位置 X {op.placement.position.x} / Y {op.placement.position.y} / Z {op.placement.position.z} mm{moving && <> · 动画中 {doorAxis(face).toUpperCase()} {moving.position[doorAxis(face)].toFixed(0)} mm</>}</p>}
    <p className="studio-hint">序号对应本站实际作业步骤，含临时倒货；点击模型标记或下方步骤可定位。动画按各步记录沿后门、侧面或顶部方向进出，不能替代机器人轨迹和现场门洞校核。</p>
    <ol className="studio-operation-cards">{stop.operations.map((item,i)=><li key={`${i}-${item.itemId}`}><button className={step?.operationIndex===i?'active':''} onClick={()=>jump(steps.findIndex(s=>s.stationIndex===stationIndex && s.operationIndex===i))}><span className="studio-step-number">{i+1}</span><span><strong>{actions[item.action]} · {item.name}</strong><small>{doorLabel[item.door ?? result.door]}</small><small>{item.itemId}</small><small>X {item.placement.position.x} / Y {item.placement.position.y} / Z {item.placement.position.z} mm</small></span></button></li>)}</ol>
    {!stop.operations.length && <p>本站没有可执行操作；播放将继续下一站。未完成需求见任务清单。</p>}
  </div>
}
