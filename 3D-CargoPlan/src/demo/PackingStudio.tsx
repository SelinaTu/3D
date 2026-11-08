// #created 11/08/2026
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { loadIraqBaseline } from './iraq-baseline'
import type { CargoItem, Dimensions3D, PackingSolution } from '../types/packing'
import { colorForGroup, createCargoBatch, groupKey, type NewCargo } from './studio-cargo'
import { FrameEditor } from './FrameEditor'
import { MultiStopTest } from './MultiStopTest'
import './packing-studio.css'
import type { PlanningProgress } from './planning-runner'

const Viewer = lazy(() => import('../components/ContainerViewer').then(m => ({ default: m.ContainerViewer })))
type Group = { key: string; item: CargoItem; count: number }
const emptyCargo = (): NewCargo => ({ name: '', category: '纸箱', dimensions: { length: 600, width: 400, height: 300 }, weight: 10, quantity: 1 })
function groupItems(items: CargoItem[]): Group[] {
  const map = new Map<string, Group>()
  for (const item of items) {
    const key = groupKey(item), group = map.get(key)
    if (group) group.count++
    else map.set(key, { key, item, count: 1 })
  }
  return [...map.values()]
}
const display = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const originalDimensions = { length: 11600, width: 2250, height: 2500 }

export function PackingStudio() {
  const [items, setItems] = useState<CargoItem[]>([])
  const [baseline, setBaseline] = useState<PackingSolution | null>(null)
  const [solution, setSolution] = useState<PackingSolution | null>(null)
  const [dims, setDims] = useState<Dimensions3D>(originalDimensions)
  const [maxWeight, setMaxWeight] = useState(28000)
  const [clearance, setClearance] = useState(0)
  const [profile, setProfile] = useState<'villa-pdf' | 'custom'>('villa-pdf')
  const [group, setGroup] = useState('')
  const [query, setQuery] = useState('')
  const [containerIndex, setContainerIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [multiStop, setMultiStop] = useState(false)
  const [noCrossStack, setNoCrossStack] = useState(false)
  const [door, setDoor] = useState<'x-min' | 'x-max'>('x-max')
  const [ranks, setRanks] = useState<Record<string, number>>({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [preview, setPreview] = useState<PackingSolution | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [runStage, setRunStage] = useState('正在准备计算')
  const [computeMode,setComputeMode]=useState<'quick'|'compare'>('quick')
  const [computeProgress,setComputeProgress]=useState<PlanningProgress|null>(null)
  const [shelfNotice, setShelfNotice] = useState('')
  const [deletedBatches, setDeletedBatches] = useState<Array<Array<{item: CargoItem; index: number}>>>([])
  const [error, setError] = useState('')
  const [runNote, setRunNote] = useState('')
  const [viewError, setViewError] = useState(false)
  const [sourceName, setSourceName] = useState('伊拉克项目 · 历史方案')
  const [fileBusy, setFileBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingFrame, setEditingFrame] = useState(false)
  const [newCargo, setNewCargo] = useState<NewCargo>(emptyCargo)
  const fileInput = useRef<HTMLInputElement>(null)
  const worker = useRef<Worker | null>(null)
  const revision = useRef(0)
  const load = () => {
    setError('')
    loadIraqBaseline().then((saved: PackingSolution) => {
      const cargo = [...saved.containers.flatMap(c => c.items.map(p => p.item)), ...saved.unpackedItems]
      if (cargo.length !== 1371 || saved.totalContainers !== 11) throw new Error('伊拉克冻结方案数据不完整')
      setItems(cargo); setBaseline(saved); setSolution(saved); setDims(originalDimensions); setMaxWeight(saved.containers[0].maxWeight)
      setProfile('villa-pdf'); setClearance(0); setSourceName('伊拉克项目 · 历史方案'); setDirty(false); setPreview(null); setDeletedBatches([]); setMultiStop(false); setNoCrossStack(false); setRanks({}); setContainerIndex(0); setSelected(null); setRunNote('')
      setGroup(groupKey(cargo[0])); setShelfNotice(''); setPreviewBusy(false); setQuery(''); setAdding(false); setEditingFrame(false)
    }).catch(e => setError(e instanceof Error ? e.message : '加载失败'))
  }
  useEffect(() => { load(); return () => worker.current?.terminate() }, [])
  const groups = useMemo(() => groupItems(items), [items])
  const visibleGroups = useMemo(() => groups.filter(g => `${g.item.name} ${g.item.category} ${g.key}`.toLowerCase().includes(query.toLowerCase())), [groups, query])
  const active = groups.find(g => g.key === group)
  const presented = dirty ? preview : solution
  const current = presented?.containers[containerIndex]
  const pending = presented?.unpackedItems ?? (dirty && !solution ? items : [])
  const pendingGroups = useMemo(() => groupItems(pending), [pending])
  const groupColors = useMemo(() => new Map(groups.map((g, index) => [g.key, colorForGroup(index)])), [groups])
  const groupIds = useMemo(() => new Set(current?.items.filter(p => groupKey(p.item) === group).map(p => p.item.id) ?? []), [current, group])
  const displayContainer = useMemo(() => current ? { ...current, items: current.items.map(p => ({ ...p, item: { ...p.item, colorTag: groupColors.get(groupKey(p.item)) ?? '#8c9e97' } })) } : undefined, [current, groupColors])
  const changed = () => { revision.current++; setDirty(true); setPreview(null); setPreviewBusy(true); setError(''); setRunNote('') }
  const setDimension = (key: keyof Dimensions3D, value: number) => {
    if (!Number.isFinite(value) || value <= 0) return
    setDims(current => ({ ...current, [key]: value })); setProfile('custom'); changed()
  }
  const deletePending = (key: string, singleId?: string) => {
    const ids = new Set(pending.filter(item=>groupKey(item) === key && (!singleId || item.id === singleId)).map(item=>item.id))
    const removed = items.flatMap((item,index)=>ids.has(item.id) ? [{item,index}] : [])
    if (!removed.length) return
    setShelfNotice(`已从清单删除 ${removed.length} 件，可以撤销。`); setDeletedBatches(old=>[...old,removed]); setItems(old=>old.filter(item=>!ids.has(item.id))); setSelected(null); changed()
  }
  const undoDelete = () => {
    const removed = deletedBatches.at(-1); if (!removed) { setShelfNotice('当前没有可撤销的删除记录。修改规格造成的待装货物，可点击对应批次的“撤回参数”。'); return }
    setItems(old=>{ const next = [...old], ids = new Set(old.map(item=>item.id)); for (const entry of removed) if (!ids.has(entry.item.id)) next.splice(Math.min(entry.index,next.length),0,entry.item); return next })
    setDeletedBatches(old=>old.slice(0,-1)); setShelfNotice(`已恢复 ${removed.length} 件货物。`); changed()
  }
  const revertBatch = (key: string) => {
    if (!solution) return
    const original = new Map([...solution.containers.flatMap(c=>c.items.map(p=>p.item)),...solution.unpackedItems].map(item=>[item.id,item]))
    setItems(old=>old.map(item=>groupKey(item) === key ? original.get(item.id) ?? item : item)); changed()
  }
  const addCargo = () => {
    try {
      const added = createCargoBatch(newCargo, crypto.randomUUID(), items.length)
      setItems(old => [...old, ...added]); setGroup(groupKey(added[0])); setSelected(null); setAdding(false); setNewCargo(emptyCargo()); setQuery(''); changed()
    } catch (error) { setError(error instanceof Error ? error.message : '无法添加货物') }
  }
  const importExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFileBusy(true); setError('')
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('请选择不超过 20 MB 的 Excel 文件')
      const { parseExcelBuffer } = await import('../core/data-parser')
      const cargo = parseExcelBuffer(await file.arrayBuffer())
      if (!cargo.length) throw new Error('未识别到货物，请检查导入模板与单位')
      worker.current?.terminate(); worker.current = null; setBusy(false); revision.current++
      setItems(cargo); setGroup(groupKey(cargo[0])); setSourceName(file.name); setProfile('custom'); setClearance(0)
      setSolution(null); setDirty(true); setPreview(null); setDeletedBatches([]); setShelfNotice(''); setPreviewBusy(false); setMultiStop(false); setNoCrossStack(false); setRanks({}); setContainerIndex(0); setSelected(null); setRunNote('')
    } catch (error) { setError(error instanceof Error ? error.message : 'Excel 导入失败') }
    finally { setFileBusy(false) }
  }
  const exportExcel = async () => {
    if (!solution) return
    try { const { exportSolutionExcel } = await import('../core/export-utils'); exportSolutionExcel(solution) }
    catch (error) { setError(error instanceof Error ? error.message : '导出失败') }
  }
  const template = async () => {
    try { const { downloadCargoTemplate } = await import('../core/export-utils'); downloadCargoTemplate() }
    catch (error) { setError(error instanceof Error ? error.message : '模板下载失败') }
  }
  const run = () => {
    if (!items.length || busy) return
    const planned = items.map(item => multiStop ? { ...item, unloadStop: ranks[groupKey(item)] ?? 1 } : item)
    const requestedRevision = revision.current
    const task = new Worker(new URL('./planning-worker.ts', import.meta.url), { type: 'module' })
    worker.current = task; setBusy(true);setComputeProgress(null); setRunStage('正在准备计算'); setRunNote(''); setError('')
    task.onmessage = (event: MessageEvent<{ solution?: PackingSolution; error?: string; stage?: string; summary?: string; detail?:PlanningProgress }>) => {
      if (worker.current !== task) return
      if (event.data.stage) { setRunStage(event.data.stage);if(event.data.detail)setComputeProgress(event.data.detail); return }
      if (event.data.error || !event.data.solution) setError(event.data.error ?? '计算未返回结果')
      else {
        setSolution(event.data.solution); setPreview(null); setContainerIndex(0); setSelected(null); setDirty(revision.current !== requestedRevision)
        setRunNote(event.data.summary ?? '计算完成。')
      }
      task.terminate(); worker.current = null; setBusy(false)
    }
    task.onerror = () => { setError('计算线程意外退出，请缩小清单后重试。'); task.terminate(); worker.current = null; setBusy(false) }
    task.postMessage({ mode:computeMode, items: planned, seed: solution ?? undefined, config: { algorithm: 'greedy', containerDimensions: dims, containerMaxWeight: maxWeight, timeLimit:computeMode==='compare'?20000:Math.min(5000,Math.max(1500,items.length*2)), loadingProfile: profile, ...(profile === 'villa-pdf' ? { verticalSupport: 'pdf-clearance-projection', supportCriterion: 'centroid-hull', offsetStackScope: 'item-only' } : { clearanceMm: clearance }), ...(multiStop ? { unloadingDoor: door, preventCrossStopStacking: noCrossStack } : {}) } })
  }
  useEffect(() => {
    if (!dirty || busy || editingFrame || !solution) { if (!solution) setPreviewBusy(false); return }
    let disposed = false, task: Worker | undefined
    const timer = setTimeout(() => {
      task = new Worker(new URL('./preview-worker.ts',import.meta.url),{ type:'module' })
      task.onmessage = (e: MessageEvent<{result?: PackingSolution; error?: string}>) => { if (disposed) return; if (e.data.result) { setPreview(e.data.result); setContainerIndex(0) } else setError(e.data.error ?? '原位置检查失败'); setPreviewBusy(false); task?.terminate() }
      task.onerror = () => { if (!disposed) { setError('原位置检查失败，请主动重新计算'); setPreviewBusy(false) }; task?.terminate() }
      const planned = items.map(item => multiStop ? { ...item, unloadStop: ranks[groupKey(item)] ?? 1 } : item)
      task.postMessage({ items: planned, seed: solution, config: { algorithm:'greedy', containerDimensions:dims, containerMaxWeight:maxWeight, loadingProfile:profile, ...(profile === 'villa-pdf' ? { verticalSupport:'pdf-clearance-projection', supportCriterion:'centroid-hull', offsetStackScope:'item-only' } : { clearanceMm:clearance }), ...(multiStop ? { unloadingDoor:door, preventCrossStopStacking:noCrossStack } : {}) } })
    },300)
    return () => { disposed = true; clearTimeout(timer); task?.terminate() }
  }, [dirty, busy, editingFrame, items, dims, maxWeight, clearance, profile, ranks, multiStop, door, noCrossStack, solution])
  useEffect(() => {
    if (!busy) return
    const start = Date.now(); setElapsed(0)
    const timer = setInterval(() => setElapsed(Date.now() - start), 200)
    return () => clearInterval(timer)
  }, [busy])
  const cancel = () => { worker.current?.terminate(); worker.current = null; setBusy(false); setError('计算已取消；修改尚未重新计算。') }
  const reset = () => { worker.current?.terminate(); worker.current = null; setBusy(false); load() }
  const selectGroup = (next: string) => { setGroup(next); setSelected(null) }
  const selectCargo = (id: string) => {
    const placed = current?.items.find(p => p.item.id === id)
    if (placed) { setGroup(groupKey(placed.item)); setSelected(id) }
  }
  const chosenItem = current?.items.find(p => p.item.id === selected)
  const isFrozen = !dirty && solution?.id === baseline?.id

  return <main className="studio">
    {busy && <div className="studio-loading-backdrop" role="dialog" aria-modal="true" aria-label="正在重新计算装载方案"><div className="studio-loading-card"><div className="studio-spinner" /><strong>{runStage}</strong><p>旧方案已冻结，计算和独立校验完成后更新。</p><div className="studio-progress-caption"><span>实际阶段进度 · {(elapsed/1000).toFixed(1)} 秒</span><b>{Math.floor(computeProgress?.percent ?? 0)}%</b></div><progress aria-label="实际计算阶段进度" value={computeProgress?.percent ?? 0} max={100} />{computeProgress && <p>已检查 {computeProgress.processed} / {computeProgress.total} 件<br />本候选 {computeProgress.containers} 柜 · 已分配 {computeProgress.placed} · 待装 {computeProgress.unpacked}</p>}<small>按实际检查与候选分配更新；百分比不表示全局最优程度。</small><button autoFocus onClick={cancel}>取消计算</button></div></div>}
    {editingFrame && active && <FrameEditor key={active.key} item={active.item} count={active.count} onCancel={() => setEditingFrame(false)} onSave={draft => { setItems(old => old.map(item => groupKey(item) === group ? { ...item, dimensions: { ...draft.dimensions }, weight: draft.weight, allowedOrientations:[...draft.allowedOrientations], forbiddenOrientations:draft.forbiddenOrientations, canStackOnTop:draft.canStackOnTop, maxStackWeight:draft.maxStackWeight, maxStackCount:draft.maxStackCount, canOffsetStack:draft.canOffsetStack, constraints:structuredClone(draft.constraints), cavity: structuredClone(draft.cavity) } : item)); setEditingFrame(false); changed() }} />}
    <div className="studio-heading"><div><div className="studio-kicker">3D CARGOPLAN / LOAD PLANNER</div><h1>3D装载规划工作台</h1><p>调整货舱、货物与卸货顺序，重新计算并检查每件货物的摆放。</p></div><div className="studio-actions"><select aria-label={'\u88c5\u914d\u8ba1\u7b97\u6a21\u5f0f'} value={computeMode} disabled={busy} onChange={e=>setComputeMode(e.target.value as 'quick'|'compare')}><option value="quick">{'\u5feb\u901f\u4fee\u590d'}</option><option value="compare">{'\u6df1\u5ea6\u4f18\u5316'}</option></select><button onClick={reset}>恢复伊拉克基线</button><button onClick={() => void exportExcel()} disabled={!solution || dirty}>导出 Excel 方案</button><button className="studio-primary" onClick={run} disabled={busy || !items.length}>{busy ? '正在计算…' : '▶  重新计算'}</button></div></div>
    {error && <div className="studio-alert" role="alert">计算或检查失败：{error}</div>}
    {runNote && !dirty && <div className="studio-result-notice" role="status">{runNote}</div>}
    <div className="studio-grid">
      <aside className="studio-left">
        <section className="studio-card studio-vehicle"><div className="studio-card-title"><div><small>01 / EQUIPMENT</small><h2>货舱规格</h2></div><span className="studio-badge">自定义</span></div>
          <div className="studio-fieldgrid">{(['length','width','height'] as const).map((key, i) => <label key={key}><span>{['内长','内宽','内高'][i]} <em>mm</em></span><input aria-label={['内长','内宽','内高'][i]} type="number" min="1" value={dims[key]} onChange={e => setDimension(key, Number(e.target.value))} /></label>)}<label><span>额定载重 <em>kg</em></span><input aria-label="额定载重" type="number" min="1" value={maxWeight} onChange={e => { const n = Number(e.target.value); if (n > 0) { setMaxWeight(n); changed() } }} /></label></div>
          <div className="studio-profile">{profile === 'villa-pdf' ? '原 PDF 净空及 W02 例外' : '自定义货舱 · 无 W02 高度例外'}</div><p className="studio-hint">修改内尺寸自动切换为自定义货舱，重新计算不再采用 PDF 高度例外。</p><div className="studio-gap"><label>货物三轴间距 <em>mm</em><input aria-label="货物三轴间距" type="number" min="0" max="1000" value={profile === 'villa-pdf' ? 5 : clearance} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value) && value >= 0 && value <= 1000) { setClearance(value); setProfile('custom'); changed() } }} /></label><p className="studio-hint">自定义间距作用于三轴；大于 0 时不假定隔垫承托，不能直接接触叠放。</p></div>
        </section>
        <section className="studio-card studio-goods"><div className="studio-card-title"><div><small>02 / CARGO</small><h2>货物清单</h2></div><span className="studio-badge">{display(items.length)} 件</span></div>
          <div className="studio-file-actions"><button className="studio-add-button" onClick={() => setAdding(value => !value)}>{adding ? '取消添加' : '＋ 新增货物'}</button><input ref={fileInput} type="file" accept=".xlsx,.xls" aria-label="选择 Excel 货物清单" hidden onChange={event => void importExcel(event)} /><button disabled={fileBusy} onClick={() => fileInput.current?.click()}>{fileBusy ? '读取中…' : '导入 Excel'}</button><button onClick={() => void template()}>下载模板</button></div>
          {adding && <div className="studio-add-form"><strong>新增货物批次</strong><label>货物名称<input aria-label="新增货物名称" value={newCargo.name} placeholder="例如：设备箱 A" onChange={e => setNewCargo(v => ({ ...v, name: e.target.value }))} /></label><label>分类<input aria-label="新增货物分类" value={newCargo.category} onChange={e => setNewCargo(v => ({ ...v, category: e.target.value }))} /></label><div className="studio-fieldgrid">{(['length','width','height'] as const).map((key, i) => <label key={key}>{['长','宽','高'][i]} mm<input aria-label={`新增货物${['长','宽','高'][i]}`} type="number" min="1" value={newCargo.dimensions[key]} onChange={e => setNewCargo(v => ({ ...v, dimensions: { ...v.dimensions, [key]: Number(e.target.value) } }))} /></label>)}<label>单件重量 kg<input aria-label="新增货物单件重量" type="number" min="0" value={newCargo.weight} onChange={e => setNewCargo(v => ({ ...v, weight: Number(e.target.value) }))} /></label><label>数量<input aria-label="新增货物数量" type="number" min="1" step="1" value={newCargo.quantity} onChange={e => setNewCargo(v => ({ ...v, quantity: Number(e.target.value) }))} /></label></div><p>默认允许正交旋转，顶部不承重；添加后需重新计算。</p><button className="studio-confirm-add" onClick={addCargo}>添加到货物清单</button></div>}
          <p className="studio-hint studio-source">当前：{sourceName} · 色块对应货物批次</p><input className="studio-search" aria-label="搜索货物" placeholder="⌕  搜索货物或分类" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="studio-group-list">{visibleGroups.map(g => <button className={g.key === group ? 'selected' : ''} key={g.key} onClick={() => selectGroup(g.key)}><span className="studio-group-label"><i style={{ background: groupColors.get(g.key) }} /><span><strong>{g.item.name}</strong><small>{g.item.dimensions.length} × {g.item.dimensions.width} × {g.item.dimensions.height} mm</small></span></span><b>{g.count}<em>件</em></b></button>)}</div>
          {active && <div className="studio-editor"><div className="studio-editor-head"><strong>{active.item.name}</strong><span>同源 {active.count} 件</span></div><p>{active.item.dimensions.length} × {active.item.dimensions.width} × {active.item.dimensions.height} mm · {active.item.weight} kg</p><p>允许方向：{active.item.allowedOrientations.filter(o=>!active.item.forbiddenOrientations?.includes(o)).map(o=>({standing:'立放',lying:'侧放',flat:'平放'})[o]).join('、')} · 顶部{active.item.canStackOnTop ? '允许承托' : '禁止叠放'}</p><button className="studio-frame-button" onClick={()=>setEditingFrame(true)}>编辑完整参数（尺寸、方向、承重、空腔）</button><button className="studio-frame-button" disabled={!solution} onClick={()=>revertBatch(group)}>撤回此批次参数修改</button></div>}
        </section>
      </aside>
      <div className="studio-main">
        <section className="studio-card studio-result"><div className="studio-result-top"><div><small>03 / LOAD PLAN</small><h2>{dirty ? '原位置检查 · 待重新计算' : isFrozen ? '伊拉克项目 · 11 柜冻结方案' : solution ? '本次计算方案' : '准备计算'}</h2><p>{dirty ? previewBusy ? '正在检查原位置；不会自动重新计算' : preview ? '仅保留仍满足条件的原位置；待装区货物等待重新计算' : '设置货舱和货物后，点击重新计算' : isFrozen ? '1,371 件完整货物 · 历史研究口径' : `${solution?.algorithm === 'REPAIR-EXISTING' ? '基于原方案局部修复' : '贪心计算'} · ${solution?.terminationReason === 'time-limit' ? '达到时间预算' : '搜索结束'}`}</p></div><span className={`studio-status ${dirty || solution?.unpackedItems.length || solution?.validation?.valid === false ? 'pending' : ''}`}>{dirty ? '● 等待重新计算' : solution?.validation?.valid === false ? '● 校验未通过' : solution?.unpackedItems.length ? `● 部分结果 · ${solution.unpackedItems.length} 件未装` : '● 方案已载入'}</span></div>
          <div className="studio-metrics"><div><span>车辆 / 箱数</span><strong>{presented?.totalContainers ?? '—'} <small>柜</small></strong></div><div><span>已装 / 总件数</span><strong>{presented ? display(items.length - pending.length) : '—'} <small>/ {display(items.length)}</small></strong></div><div><span>当前柜利用率</span><strong>{current ? pct(current.volumeUtilization) : '—'}</strong></div><div><span>当前柜重量</span><strong>{current ? display(current.totalWeight / 1000) : '—'} <small>t</small></strong></div></div>
          <div className="studio-view-head"><div><b>三维装载视图</b><span>拖动旋转 · 滚轮缩放 · 点击选择货物</span></div><div><span className="studio-dot" /> 按货物批次着色 · 选中同批高亮</div></div>
          <div className="studio-view-wrap"><div className="studio-viewer">{displayContainer && !viewError ? <Suspense fallback={<div className="studio-placeholder">正在加载 3D 视图…</div>}><Viewer container={displayContainer} selectedId={selected} selectedIds={groupIds} onSelect={selectCargo} onError={() => setViewError(true)} /></Suspense> : <div className="studio-placeholder">{viewError ? '3D 暂不可用，请查看下方明细' : '尚无已装载货物'}</div>}</div>
            {chosenItem && active && <div className="studio-float-editor"><div className="studio-editor-head"><strong>{active.item.name}</strong><button onClick={()=>setSelected(null)} aria-label="关闭货物编辑">×</button></div><p>同源 {active.count} 件 · 参数统一在完整编辑器中修改</p><button className="studio-frame-button" onClick={()=>setEditingFrame(true)}>编辑完整参数（尺寸、方向、承重、空腔）</button></div>}
          </div>
          <div className="studio-cabin"><span>选择货柜</span><div>{presented?.containers.map((c, i) => <button key={c.id} title={`第 ${i+1} 柜 · 利用率 ${pct(c.volumeUtilization)} · ${c.items.length} 件`} aria-label={`第 ${i+1} 柜，利用率 ${pct(c.volumeUtilization)}，${c.items.length} 件`} className={i === containerIndex ? 'active' : ''} onClick={() => { setContainerIndex(i); setSelected(null); setViewError(false) }}>{String(i + 1).padStart(2, '0')}</button>)}</div><b>{current?.items.length ?? 0} 件</b></div>
          <div className="studio-shelf"><div><strong>待装区</strong><span>{previewBusy ? '正在检查…' : `${display(pending.length)} 件`}</span></div><p>原位置不能保留或新添加的货物暂放这里。删除只移除该批待装件，且会从本次货物清单删除；可撤销删除。撤回参数会将该批恢复到上次计算的规格。</p><button className="studio-shelf-undo" onClick={undoDelete}>撤销上次删除{deletedBatches.length ? `（${deletedBatches.at(-1)?.length} 件）` : ''}</button>{shelfNotice && <p className="studio-shelf-notice" role="status">{shelfNotice}</p>}{pendingGroups.length > 0 && <div className="studio-shelf-list">{pendingGroups.map(g => <div className="studio-shelf-item" key={g.key}><button className="studio-shelf-select" onClick={() => selectGroup(g.key)}><i style={{background:groupColors.get(g.key)}} /><span>{g.item.name}<small>{g.item.dimensions.length} × {g.item.dimensions.width} × {g.item.dimensions.height} mm</small></span><b>{g.count} 件</b></button><div><button disabled={!solution} onClick={() => revertBatch(g.key)}>撤回参数</button><button onClick={() => deletePending(g.key)}>删除待装 {g.count} 件</button></div></div>)}</div>}</div>
          <div className="studio-note"><b>口径说明</b> {isFrozen ? '历史方案采用 PDF 几何预留与承托投影假设；5 mm 空隙不代表已证明实际承托。' : current?.loadingRules?.supportMechanism === 'pdf-clearance-projection' ? '本次采用 PDF 承托投影假设及 W02 专项高度例外，现场承托仍需确认。' : '自定义车厢按长方体内净空计算，不使用伊拉克高度例外；现场门洞、轴荷与系固尚未校核。'} 框体在图中按外包盒显示，空腔内货物可能看起来重叠；几何计算按空腔实体处理。{presented?.unpackedItems.length ? `有 ${presented.unpackedItems.length} 件未装载，不能视为完整方案。` : ''}{presented?.validation && !presented.validation.valid ? ` 校验未通过：${presented.validation.errors.slice(0, 2).join('；')}` : ''}{!dirty && solution?.notes?.length ? ` ${solution.notes.join(' ')}` : ''}</div>
          {!!pending.length && <details className="studio-note"><summary>查看待装货物逐件明细（{pending.length} 件）</summary><div className="studio-unpacked">{pending.map(item => <div className="studio-pending-unit" key={item.id}><span>{item.name} · {item.id}{item.constraints?.requiresManualReview?.length ? `：${item.constraints.requiresManualReview.join('；')}` : ''}</span><button onClick={()=>deletePending(groupKey(item),item.id)}>删除这 1 件</button></div>)}</div></details>}
        </section>
        <MultiStopTest container={current} dirty={dirty || solution?.validation?.valid === false} door={door} />
        <section className="studio-card studio-order"><div className="studio-card-title"><div><small>04 / DELIVERY ORDER</small><h2>卸货顺序</h2></div><label className="studio-toggle"><input type="checkbox" checked={multiStop} onChange={e => { setMultiStop(e.target.checked); changed() }} /> 启用站点排序</label></div><p>为选中的货物批次填写站序，数字越小越早卸；重新计算时优先少车，再减少潜在遮挡。伊拉克原数据不含站点，默认未启用。</p>{multiStop && active && <><div className="studio-order-input"><label>当前批次「{active.item.name}」卸货站序 <input aria-label="卸货站序" type="number" min="1" step="1" value={ranks[group] ?? 1} onChange={e => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n >= 1) { setRanks(r => ({ ...r, [group]: n })); changed() } }} /></label><label>车门位置 <select value={door} onChange={e => { setDoor(e.target.value as typeof door); changed() }}><option value="x-max">X 最大端</option><option value="x-min">X 最小端</option></select></label></div><label className="studio-toggle studio-stack-rule"><input type="checkbox" checked={noCrossStack} onChange={e => { setNoCrossStack(e.target.checked); changed() }} /> 不同卸货站货物禁止直接叠放</label><p>这是一项硬约束；当前不保证不同站的货物形成完全隔离的区域。</p></>}{solution?.unloadAnalysis && !dirty && <p>当前方案：{solution.unloadAnalysis.blockerPairCount} 组跨站潜在阻挡。该数值不是实际倒货次数。</p>}</section>
        <section className="studio-card studio-manifest"><div className="studio-card-title"><div><small>05 / MANIFEST</small><h2>当前柜货物明细</h2></div><span className="studio-badge">{current?.items.length ?? 0} 件</span></div>{chosenItem && <p>已选：{chosenItem.item.name} · {chosenItem.item.id} · X {display(chosenItem.position.x)} / Y {display(chosenItem.position.y)} / Z {display(chosenItem.position.z)} mm</p>}<div className="studio-table"><table><thead><tr><th>货物</th><th>摆放尺寸 mm</th><th>坐标 X / Y / Z</th><th>重量</th></tr></thead><tbody>{current?.items.map(p => <tr key={p.item.id} className={selected === p.item.id ? 'active' : ''} onClick={() => selectCargo(p.item.id)}><td><strong>{p.item.name}</strong><small>{p.item.id}</small></td><td>{p.actualDimensions.length} × {p.actualDimensions.width} × {p.actualDimensions.height}</td><td>{display(p.position.x)} / {display(p.position.y)} / {display(p.position.z)}</td><td>{display(p.item.weight)} kg</td></tr>)}</tbody></table></div></section>
      </div>
    </div>
  </main>
}
