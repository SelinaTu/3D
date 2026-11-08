// #created 11/08/2026
import { dimensionText } from './format-dimensions'
import { useCallback,useEffect,useMemo,useRef,useState,type ChangeEvent } from 'react'
import type { CargoItem,Container,PackingSolution } from '../types/packing'
import type { RouteProblem,Simulation,SolveOptions } from '../core/multistop/model'
import type { ScenarioOptions } from '../core/multistop/scenarios'
import { parseRouteProblem } from '../core/multistop/problem'
import { DEFAULT_HANDLING } from '../core/multistop/access'
import { RoutePlayer,type StationFocus } from './RoutePlayer'
import { RouteVehicleEditor } from './RouteVehicleEditor'
import { routeVehicle } from '../core/multistop/vehicles'
import { RouteComposer,emptyRoute } from './RouteComposer'
import { createRouteDemoContainer } from './route-demo'
import { loadIraqBaseline } from './iraq-baseline'
import './route-workspace.css'
const dims=(item:CargoItem)=>`${item.dimensions.length} × ${item.dimensions.width} × ${item.dimensions.height} mm`
const download=(name:string,value:unknown)=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}))
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
type PlanSource='assembly'|'independent'|'iraq'
type Request={type:'generate';container:Container;options:ScenarioOptions;source:PlanSource}|{type:'solve';problem:RouteProblem;options:SolveOptions}
export function MultiStopTest({container,dirty,door}:{container?:Container;dirty:boolean;door:'x-min'|'x-max'}) {
  const [problem,setProblem]=useState<RouteProblem|null>(null),[result,setResult]=useState<Simulation|null>(null)
  const [count,setCount]=useState(5),[seed,setSeed]=useState(20261030),[mode,setMode]=useState<ScenarioOptions['mode']>('feasible'),[seconds,setSeconds]=useState(8),[repack,setRepack]=useState(true)
  const [station,setStation]=useState(0),[focus,setFocus]=useState<StationFocus>({station:0,token:0}),[view,setView]=useState<'plan'|'execute'>('plan')
  const [demoOpen,setDemoOpen]=useState(false),[demoSource,setDemoSource]=useState<PlanSource>('iraq'),[basis,setBasis]=useState<PlanSource>('assembly')
  const basisRef=useRef<PlanSource>('assembly')
  const [iraq,setIraq]=useState<PackingSolution|null>(null),[iraqIndex,setIraqIndex]=useState(0),[iraqError,setIraqError]=useState(''),[reloadIraq,setReloadIraq]=useState(0)
  useEffect(()=>{let alive=true;setIraqError('');loadIraqBaseline().then(value=>{if(alive)setIraq(value)}).catch(error=>{if(alive)setIraqError(error instanceof Error?error.message:'读取伊拉克基线失败')});return()=>{alive=false}},[reloadIraq])
  const assemblyBlocked=dirty && basis==='assembly'
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[generationNotice,setGenerationNotice]=useState(''),[draft,setDraft]=useState('')
  const generationBlocked=busy || (demoSource==='assembly' && (!container || dirty)) || (demoSource==='iraq' && !iraq)
  const demoPanel=useRef<HTMLElement|null>(null)
  const task=useRef<Worker|null>(null),independentRequest=useRef(false),fileInput=useRef<HTMLInputElement>(null),resultSection=useRef<HTMLDivElement|null>(null)
  useEffect(()=>()=>task.current?.terminate(),[])
  useEffect(()=>{if(demoOpen && view==='plan')demoPanel.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})},[demoOpen,view])
  useEffect(()=>{if(view==='execute' && result)resultSection.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})},[view,result])
  useEffect(()=>{if(basisRef.current!=='assembly' || independentRequest.current)return;const interrupted=Boolean(task.current);task.current?.terminate();task.current=null;setBusy(false);if(dirty){if(interrupted)setError('装配数据发生变化，已取消当前柜的计算；计划保留，请重新计算装配后重试，或使用独立演示。');return}setProblem(container?emptyRoute(container,door):null);setResult(null);setError(interrupted?'装配货柜已变化，当前柜任务已取消，请重新生成题目。':'');setGenerationNotice('');setDraft('');setStation(0);setView('plan')},[container,door,dirty])
  const accept=(next:RouteProblem,source:PlanSource='independent')=>{basisRef.current=source;setBasis(source);setProblem(next);setResult(null);setStation(0);setDraft(JSON.stringify(next.stops,null,2));setError('');setView('plan')}
  const edit=(next:RouteProblem)=>{setProblem(next);setResult(null);setDraft(JSON.stringify(next.stops,null,2));setError('');setGenerationNotice('')}
  const run=(request:Request)=>{
    if(busy)return
    let worker:Worker
    try { worker=new Worker(new URL('./simulation-worker.ts',import.meta.url),{type:'module'}) }
    catch {setError('无法启动计算线程，请刷新页面后重试。');return}
    independentRequest.current=request.type==='generate' ? request.source!=='assembly' : basisRef.current!=='assembly'
    task.current=worker;setBusy(true);setProgress(request.type==='generate'?'正在创建示例计划':'正在计算装卸方案');setError('');setGenerationNotice('')
    worker.onmessage=(e:MessageEvent<{problem?:RouteProblem;result?:Simulation;error?:string;stage?:string}>)=>{
      if(task.current!==worker)return
      if(e.data.stage){setProgress(e.data.stage);return}
      if(e.data.error)setError(e.data.error)
      else if(e.data.problem){
        const source=request.type==='generate'?request.source:'assembly'
        const independent=source!=='assembly'
        accept({...e.data.problem,
          handling:e.data.problem.initial.handlingAccess ?? {...DEFAULT_HANDLING},
          vehicle:independent ? {id:source==='iraq'?'iraq-report-'+(iraqIndex+1):'independent-demo-42',name:source==='iraq'?'伊拉克完整基线 · 第 '+(iraqIndex+1)+' 柜':'4.2 米独立演示厢车',dimensions:{...e.data.problem.initial.dimensions},maxWeight:e.data.problem.initial.maxWeight,doors:[e.data.problem.door]}:basis==='assembly'?problem?.vehicle:undefined,
          door:e.data.problem.door
        },source)
        const generated=e.data.problem.stops
        setGenerationNotice(`题目已生成：${generated.length} 站，计划卸货 ${generated.reduce((n,stop)=>n+stop.unloadIds.length,0)} 件次、装货 ${generated.reduce((n,stop)=>n+stop.pickup.length,0)} 件。请检查各站任务，再点击计算装卸方案。`)
      }
      else if(e.data.result){setResult(e.data.result);setStation(0);setFocus(old=>({station:0,token:old.token+1}));setView('execute')}
      else setError('引擎未返回计划或结果')
      worker.terminate();task.current=null;independentRequest.current=false;setBusy(false)
    }
    worker.onerror=()=>{if(task.current!==worker)return;setError('计算线程意外退出，计划已保留');worker.terminate();task.current=null;independentRequest.current=false;setBusy(false)}
    worker.onmessageerror=()=>{if(task.current!==worker)return;setError('计算结果无法读取，计划已保留，请重试。');worker.terminate();task.current=null;independentRequest.current=false;setBusy(false)}
    try {worker.postMessage(request)} catch {worker.terminate();task.current=null;independentRequest.current=false;setBusy(false);setError('无法发送计算任务，请检查输入后重试。')}
  }
  const generate=(nextSeed=seed)=>{
    if(generationBlocked)return
    const selected=demoSource==='iraq'?iraq?.containers[iraqIndex]:demoSource==='independent'?createRouteDemoContainer():container
    if(!selected)return
    const source=structuredClone(selected),targetDoor=demoSource==='assembly'?door:'x-max'
    source.handlingAccess=demoSource==='independent'?{...DEFAULT_HANDLING}:{...DEFAULT_HANDLING,...problem?.handling}
    source.routeDoors=demoSource==='assembly' && basis==='assembly'?problem?.vehicle?.doors ?? [targetDoor]:[targetDoor]
    setSeed(nextSeed);run({type:'generate',container:source,source:demoSource,options:{stopCount:count,seed:nextSeed,mode,door:targetDoor}})
  }
  const solve=()=>{
    if(!problem)return
    if(!problem.stops.some(stop=>stop.unloadIds.length || stop.pickup.length)){setError('各站尚未设置装卸任务。请填写卸货数量、添加装货，或先生成题目。');return}
    run({type:'solve',problem,options:{perStopTimeLimitMs:seconds*1000,repackInitial:repack}})
  }
  const loadFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return
    try{if(file.size>20*1024*1024)throw new Error('计划文件请控制在 20 MB 以内');const parsed=parseRouteProblem(JSON.parse(await file.text()));accept({...parsed,handling:parsed.handling ?? parsed.initial.handlingAccess ?? {...DEFAULT_HANDLING}})}catch(e){setError(e instanceof Error?e.message:'计划导入失败')}
  }
  const choose=(index:number)=>{setStation(index);setFocus(old=>({station:index,token:old.token+1}))}
  const onStationChange=useCallback((index:number)=>setStation(index),[])
  const selected=problem?.stops[station],actual=result?.stops[station]
  const cargoById=useMemo(()=>new Map<string,CargoItem>(problem?[...problem.initial.items.map(p=>p.item),...problem.stops.flatMap(s=>s.pickup)].map(i=>[i.id,i]):[]),[problem])
  const destination=(id:string)=>{const at=problem?.stops.findIndex(s=>s.unloadIds.includes(id)) ?? -1;return at<0?'本段结束后留车':`${at+1}. ${problem!.stops[at].name}`}
  const unresolved=result?.stops.reduce((n,s)=>n+s.blockedUnload.length+s.failedPickup.length+s.cancelledDelivery.length,0) ?? 0
  return <section className="studio-card studio-route route-test route-workbench" aria-label="多站点作业计划">
    <header className="route-command-bar"><div><h2>多站点作业计划</h2><p>输入需求，计算摆放与装卸顺序</p></div><div className="route-header-actions"><button data-action="route-demo" className="route-demo-toggle" disabled={generationBlocked} onClick={()=>generate(crypto.getRandomValues(new Uint32Array(1))[0])}>自动出题</button><button className="route-demo-settings-toggle" aria-expanded={demoOpen} disabled={busy} onClick={()=>{setDemoOpen(v=>view==='execute'?true:!v);setView('plan')}}>出题设置</button><button disabled={busy} onClick={()=>fileInput.current?.click()}>导入计划</button><input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={loadFile}/>{problem && <button disabled={busy} onClick={()=>download('多站装卸计划.json',problem)}>导出计划</button>}<button className="route-play-primary route-calculate" disabled={!problem || busy || assemblyBlocked} onClick={solve}>{busy?'计算中…':'计算装卸方案'}</button></div></header>{busy && <p className="route-header-progress" role="status">{progress} · 结果将在完成后自动显示</p>}
    {problem && <div className="route-problem-summary" data-seed={problem.seed} data-plan-source={basis}><b>{problem.stops.length} 个站点</b>{basis!=='assembly' && <span className="route-independent-badge">{basis==='iraq'?'伊拉克完整柜 · 不修改装配':'八件练习 · 不修改装配'}</span>}<span>起点 {problem.initial.items.length} 件</span><span>卸货 {problem.stops.reduce((n,s)=>n+s.unloadIds.length,0)} 件次</span><span>装货 {problem.stops.reduce((n,s)=>n+s.pickup.length,0)} 件</span><span>{routeVehicle(problem).name}</span><span>{dimensionText(routeVehicle(problem).dimensions)} mm</span></div>}
    <div className="route-workbench-toolbar"><div className="route-view-switch"><button className={view==='plan'?'active':''} onClick={()=>setView('plan')}>编排需求</button><button disabled={!result} className={view==='execute'?'active':''} onClick={()=>setView('execute')}>执行方案{result?` · ${unresolved?'待处理 '+unresolved:'已校验'}`:''}</button></div>{container && basis==='assembly' && <label className="route-origin">起点载货<select aria-label="起点载货" disabled={busy} value={problem?.initial.items.length?'current':'empty'} onChange={e=>{if(!problem)return;const next=structuredClone(problem),ids=new Set(container.items.map(p=>p.item.id));next.initial=structuredClone(container);if(e.target.value==='empty'){next.initial.items=[];next.stops.forEach(s=>s.unloadIds=s.unloadIds.filter(id=>!ids.has(id)))}edit(next)}}><option value="current">当前装配货柜</option><option value="empty">空车开始</option></select></label>}<label className="route-check"><input type="checkbox" checked={repack} disabled={busy} onChange={e=>setRepack(e.target.checked)}/>出发前按站序优化摆放</label><label className="route-budget">每站 <input aria-label="每站搜索秒数" type="number" min="1" max="120" value={seconds} disabled={busy} onChange={e=>setSeconds(Number(e.target.value))}/> 秒</label></div>
    {demoOpen && <section ref={demoPanel} className="route-advanced route-random" aria-label="自动出题演示设置"><h3>自动出题演示</h3><p>先生成装卸清单，再点击「计算装卸方案」查看真实求解与 3D 播放。默认继承与 HTML 相同的伊拉克 1,371 件 / 11 柜完整基线，整柜保留摆放与约束，不修改你的装配和待装池。</p><div className="route-test-settings"><label>出题数据<select aria-label="出题数据来源" value={demoSource} disabled={busy} onChange={e=>setDemoSource(e.target.value as PlanSource)}><option value="iraq">伊拉克完整基线 · 与 HTML 同源</option><option value="assembly">当前装配货柜 · 已重算方案</option><option value="independent">八件小样例 · 可选练习</option></select></label>{demoSource==='iraq' && <label>伊拉克基线货柜<select aria-label="伊拉克基线货柜" value={iraqIndex} disabled={busy || !iraq} onChange={e=>setIraqIndex(Number(e.target.value))}>{iraq?iraq.containers.map((c,i)=><option key={c.id} value={i}>第 {i+1} 柜 · {c.items.length} 件</option>):<option value={0}>正在加载 11 柜…</option>}</select></label>}<label>生成站点数<input aria-label="生成站点数" type="number" min="1" value={count} disabled={busy} onChange={e=>setCount(Number(e.target.value))}/></label><label>随机种子<input aria-label="随机种子" type="number" value={seed} disabled={busy} onChange={e=>setSeed(Number(e.target.value))}/></label><label>示例类型<select aria-label="多站验证场景" value={mode} disabled={busy} onChange={e=>setMode(e.target.value as ScenarioOptions['mode'])}><option value="feasible">几何可行参考</option><option value="challenge">随机挑战 · 可能不可行</option><option value="training">六件小批量练习</option></select></label></div><div className="route-test-actions"><button className="route-play-primary" disabled={generationBlocked} onClick={()=>generate()}>生成题目</button><button disabled={generationBlocked} onClick={()=>generate(crypto.getRandomValues(new Uint32Array(1))[0])}>换一题</button><button disabled={!container || busy} onClick={()=>{if(container)accept(emptyRoute(container,door),'assembly')}}>使用当前柜新建计划</button></div>{demoSource==='assembly' && !container && <p>当前柜出题需要已校验的装配方案；独立演示无需此条件。</p>}{demoSource==='assembly' && dirty && <p>当前装配尚未重算；可切换伊拉克完整基线，或先完成装配重算。</p>}{demoSource==='iraq' && <p className="route-baseline-source" role="status">{iraq?'已加载 11 柜 / 1,371 件；本次完整继承第 '+(iraqIndex+1)+' 柜 '+iraq.containers[iraqIndex].items.length+' 件，包括门窗、框体、玻璃架及辅材的原始属性和实际摆放。':'正在读取与 HTML 相同的伊拉克完整基线…'}</p>}{iraqError && demoSource==='iraq' && <p role="alert">{iraqError} <button onClick={()=>setReloadIraq(v=>v+1)}>重新读取基线</button></p>}<small>基线使用已确认的 PDF 建模口径及专项例外；按已选人员 / 设备方式出题和求解，随机挑战可能无解。</small></section>}
    {problem && problem.stops.some(s=>s.name.startsWith('模拟站点') && !s.unloadIds.length && !s.pickup.length) && <p className="route-notice warning">部分模拟站点没有装卸任务：当前起点货物已分配完。可以减少站点数或增加起点货物后重新出题。</p>}
    {assemblyBlocked && <p className="route-notice warning">装配有未重算修改，当前柜计划暂不可计算。可在「出题设置」选择独立演示车辆，或先完成装配重算。</p>}
    {busy && <div role="status" className="route-computing"><span className="route-spinner"/><div><strong>{progress}</strong><small>正在检查库存、人员可达、通道与承托；输入暂时锁定。</small></div><button onClick={()=>{task.current?.terminate();task.current=null;independentRequest.current=false;setBusy(false);setError('已取消计算，输入计划保留。')}}>取消</button></div>}
    {error && <p role="alert" className="route-notice warning">{error}</p>}
    {generationNotice && !busy && <p role="status" className="route-notice">{generationNotice}</p>}
    {view==='plan' && problem && <RouteVehicleEditor problem={problem} busy={busy} onChange={edit}/>}
    {view==='plan' && problem && <RouteComposer problem={problem} station={station} busy={busy} onChange={edit} onStation={choose}/>}
    {!problem && <div className="route-empty">请先在装配工作台完成装载，或导入包含起点清单的计划。</div>}
    {view==='execute' && result && problem && <div className="route-execution" ref={resultSection} tabIndex={-1}>
      <div role="status" className={`route-test-status ${unresolved?'partial':'complete'}`}><strong>{unresolved?`有 ${unresolved} 项需求待处理`:`${result.stops.length} 站全部任务完成`}</strong><span>逐步重放校验通过 · {result.stops.reduce((n,s)=>n+s.rehandled.length*2,0)} 次临移 / 放回</span></div>
      {result.initialPlanning && <p className="route-notice">{result.initialPlanning.note}</p>}
      <nav className="studio-route-tabs" aria-label="选择装卸站点">{problem.stops.map((s,i)=><button key={i} disabled={busy} className={station===i?'active':''} onClick={()=>choose(i)}>{i+1}. {s.name}<small>卸 {result.stops[i].unloaded.length}/{s.unloadIds.length} · 装 {result.stops[i].loaded.length}/{s.pickup.length}</small></button>)}</nav>
      {!busy && <RoutePlayer result={result} focus={focus} onStationChange={onStationChange}/>}
      {selected && <div className="route-station-manifest"><h3>{station+1}. {selected.name} · 作业核对</h3><div className="route-manifest-columns"><div><strong>交付 · {selected.unloadIds.length} 件</strong>{selected.unloadIds.map(id=>{const item=cargoById.get(id),cancelled=actual?.cancelledDelivery.includes(id),done=actual?.unloaded.some(p=>p.item.id===id);return <div className="studio-task-row" key={id}><b>{item?.name ?? id}</b><small>{id} · {item?dims(item):'未知货物'}</small><em>{cancelled?'上游未装入，未下发卸货':done?'已卸':'未能卸出'}</em>{actual?.unloadIssues[id] && <small>{actual.unloadIssues[id]}</small>}</div>})}{!selected.unloadIds.length && <p>本站无卸货需求</p>}</div><div><strong>取货 · {selected.pickup.length} 件</strong>{selected.pickup.map(item=><div className="studio-task-row" key={item.id}><b>{item.name}</b><small>{dims(item)} · {item.weight} kg · {destination(item.id)}</small><em>{actual?.loaded.some(p=>p.item.id===item.id)?'已装':'未能装入'}</em>{actual?.pickupIssues[item.id] && <small>{actual.pickupIssues[item.id]}</small>}</div>)}{!selected.pickup.length && <p>本站无装货需求</p>}</div></div></div>}
      <button onClick={()=>download('多站装卸执行记录.json',result)}>导出执行记录</button>
    </div>}
    {problem && <details className="route-task-editor"><summary>高级 JSON 编辑</summary><textarea aria-label="站点任务 JSON" spellCheck={false} value={draft || JSON.stringify(problem.stops,null,2)} disabled={busy} onChange={e=>setDraft(e.target.value)}/><button disabled={busy} onClick={()=>{try{accept(parseRouteProblem({...problem,stops:JSON.parse(draft).map((s:RouteProblem['stops'][number])=>({...s,pickupPlacements:undefined}))}))}catch(e){setError(e instanceof Error?e.message:'JSON 无效')}}}>应用任务修改</button></details>}
  </section>
}
