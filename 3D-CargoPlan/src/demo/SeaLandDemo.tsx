// #created 11/08/2026
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import sampleWorkbookUrl from '../../data/sample-cargo.xlsx?url'
import { parseExcelBuffer } from '../core/data-parser'
import { downloadCargoTemplate } from '../core/export-utils'
import { scenarios, sampleNote, type Scenario } from './scenarios'
import { shipmentFromItems, type ExcelShipment } from './excel-shipment'
import { packPlan, planMarkdown, toContainer, unloadOrder, type PackPlan } from './priority-pack'
import type { Dimensions3D } from '../types/packing'
import './sea-land-demo.css'
import { loadProgress } from './hi3d-load-progress'
import type { CargoFocus } from '../components/ContainerViewer'
import { MultiStopEngineDemo } from './MultiStopEngineDemo'

const ContainerViewer = lazy(() => import('../components/ContainerViewer').then((module) => ({ default: module.ContainerViewer })))

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function kg(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
}

export function SeaLandDemo() {
  const [scenarioId, setScenarioId] = useState<Scenario['id']>('land')
  const [mode, setMode] = useState<'priority' | 'bulk'>('priority')
  const [omitted, setOmitted] = useState<string | null>(null)
  const [stopId, setStopId] = useState(scenarios[0].stops[0].id)
  const [selected, setSelected] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [webgl, setWebgl] = useState(true)
  const [focus, setFocus] = useState<CargoFocus>()
  const [shipment, setShipment] = useState<ExcelShipment | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dims, setDims] = useState<Dimensions3D>(scenarios[0].vehicle.dimensions)
  const [maxWeight, setMaxWeight] = useState(scenarios[0].vehicle.maxWeightKg)
  const [groupGap, setGroupGap] = useState(0)
  const [respectWeight, setRespectWeight] = useState(true)
  const [priorities, setPriorities] = useState<Record<string, number>>({})
  const fileInput = useRef<HTMLInputElement>(null)
  const scenario = scenarios.find((item) => item.id === scenarioId) || scenarios[0]
  const baseStops = shipment?.stops || scenario.stops
  const stops = useMemo(() => baseStops.map((stop) => ({ ...stop, priority: priorities[stop.id] ?? stop.priority })), [baseStops, priorities])
  const pieces = useMemo(() => {
    const source = shipment ? shipment.pieces : scenario.pieces
    return omitted ? source.filter((piece) => piece.item.id !== omitted) : source
  }, [shipment, scenario, omitted])
  const vehicle = useMemo(() => ({ ...scenario.vehicle, dimensions: dims, maxWeightKg: maxWeight }), [scenario.vehicle, dims, maxWeight])
  const plan = useMemo(
    () => packPlan(vehicle, pieces, stops, mode, { respectWeight, groupGapMm: groupGap }),
    [vehicle, pieces, stops, mode, respectWeight, groupGap],
  )
  const shown = Math.min(step, plan.loadOrder.length)
  const visible = useMemo(() => new Set(plan.loadOrder.slice(0, shown).map((piece) => piece.item.id)), [plan, shown])
  const container = useMemo(() => toContainer(plan, visible), [plan, visible])
  const progress = useMemo(() => loadProgress(plan, shown), [plan, shown])
  const destinations = useMemo(() => new Map(plan.placed.map(p => [p.item.id, plan.stops.find(s => s.id === p.stopId)?.name ?? p.stopId])), [plan])
  const newBlocks = progress.events.find(event => event.step === shown)?.itemIds.length ?? 0
  function focusObstruction(itemId = progress.active[0]?.itemId) {
    const row = progress.active.find(row => row.itemId === itemId)
    if (!row) return
    setSelected(row.itemId)
    setFocus({ key: Date.now(), ids: [row.itemId, ...row.blockedBy] })
  }
  function jumpToObstruction(nextStep: number, itemId: string) {
    const atStep = loadProgress(plan, nextStep)
    const row = atStep.active.find(row => row.itemId === itemId)
    setStep(nextStep); setSelected(itemId)
    setFocus({ key: Date.now(), ids: [itemId, ...(row?.blockedBy ?? [])] })
  }
  const unload = unloadOrder(plan, stopId)
  const stop = plan.stops.find((item) => item.id === stopId) || [...plan.stops].sort((a, b) => a.priority - b.priority)[0]
  const sourcePieces = shipment?.pieces || scenario.pieces
  const firstStop = [...stops].sort((a, b) => a.priority - b.priority)[0]
  const cut = sourcePieces.find((piece) => piece.stopId === firstStop?.id)

  function chooseScenario(id: Scenario['id']) {
    const next = scenarios.find((item) => item.id === id) || scenarios[0]
    setScenarioId(next.id)
    setDims(next.vehicle.dimensions)
    setMaxWeight(next.vehicle.maxWeightKg)
  }
  function applyItems(items: Parameters<typeof shipmentFromItems>[0], name: string) {
    const next = shipmentFromItems(items, name)
    setShipment(next)
    setPriorities({})
    setOmitted(null)
    setSelected(null)
    setStopId([...next.stops].sort((a, b) => a.priority - b.priority)[0]?.id || next.stops[0].id)
    setImportError(null)
  }
  async function loadSampleWorkbook() {
    setImporting(true)
    setImportError(null)
    try {
      const response = await fetch(sampleWorkbookUrl)
      if (!response.ok) throw new Error(`样例文件读取失败（${response.status}）`)
      applyItems(parseExcelBuffer(await response.arrayBuffer()), 'data/sample-cargo.xlsx')
    } catch (error) { setImportError(error instanceof Error ? error.message : '样例导入失败') }
    finally { setImporting(false) }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImporting(true)
    setImportError(null)
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('请上传不超过 20 MB 的 Excel')
      applyItems(parseExcelBuffer(await file.arrayBuffer()), file.name)
    } catch (error) { setImportError(error instanceof Error ? error.message : '导入失败') }
    finally { setImporting(false) }
  }
  function setDimension(key: keyof Dimensions3D, value: number) {
    if (Number.isFinite(value) && value > 0) setDims((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (!shipment) setStopId(scenario.stops[0].id)
    setSelected(null)
    setOmitted(null)
  }, [scenario, shipment])
  useEffect(() => { setStep(plan.loadOrder.length); setSelected(null); setFocus(undefined) }, [plan])

  const lashing = plan.placed.filter((piece) => piece.item.hasGlass || piece.actualDimensions.height >= 1000)

  return <div className="sea-land">
    <span className="eyebrow">SEA & LAND SAMPLE</span>
    <h1>3D装箱：同一批货，看陆运三站和海运一柜</h1>
    <p className="lead">{shipment ? `${shipment.name} 已展开 ${shipment.count} 件。改内廓、载重、优先级或组间空档会立刻重算这一舱。` : `${sampleNote} 当前是抽样子集。导入 Excel 后按工作表或“优先组”列分组。`}</p>
    <p className="lead">单舱结果不是 <code>output/reports/iraq-villa-current-best.html</code> 的 11 柜冻结方案。那份报告是历史多柜对照记录；这里用来改参数并查看示意清单。</p>
    <MultiStopEngineDemo />
    <div className="demo-switch">
      {scenarios.map((item) => <button key={item.id} className={item.id === scenario.id ? 'active' : ''} onClick={() => chooseScenario(item.id)}><strong>{item.title}</strong><span>{item.summary}</span></button>)}
    </div>
    <div className="demo-layout">
      <aside className="demo-side">
        <section className="demo-card">
          <h2>Excel 导入</h2>
          <p>支持这份项目的中文清单和下载模板。有“优先组 / 站点 / 目的地”列时按列分组，否则每个工作表是一组。辅材先卸，玻璃架靠封闭端。</p>
          <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden-input" aria-label="导入 Excel 货物清单" onChange={(event) => void importFile(event)} />
          <div className="mode-switch">
            <button disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? '正在读取…' : '导入 Excel'}</button>
            <button disabled={importing} onClick={() => void loadSampleWorkbook()}>载入伊拉克样例</button>
            <button onClick={() => downloadCargoTemplate()}>下载模板</button>
          </div>
          {shipment && <button className="text-button" onClick={() => { setShipment(null); setPriorities({}); setOmitted(null) }}>回到抽样子集</button>}
          {importError && <p className="warn">{importError}</p>}
        </section>
        <section className="demo-card">
          <h2>货舱参数</h2>
          <p>改数字立即重算，不用再点一次计算。</p>
          <div className="dim-grid">
            <NumberField label="内长 mm" value={dims.length} onChange={(value) => setDimension('length', value)} />
            <NumberField label="内宽 mm" value={dims.width} onChange={(value) => setDimension('width', value)} />
            <NumberField label="内高 mm" value={dims.height} onChange={(value) => setDimension('height', value)} />
            <NumberField label="载重 kg" value={maxWeight} onChange={(value) => { if (value > 0) setMaxWeight(value) }} />
            <NumberField label="组间空档 mm" value={groupGap} onChange={(value) => { if (value >= 0) setGroupGap(value) }} />
          </div>
          <label className="check-line"><input type="checkbox" checked={respectWeight} onChange={(event) => setRespectWeight(event.target.checked)} />遵守载重。取消后超重方案不能当作可执行。</label>
        </section>
        <section className="demo-card">
          <h2>怎么装</h2>
          <div className="mode-switch">
            <button className={mode === 'priority' ? 'active' : ''} onClick={() => setMode('priority')}>按卸货优先级</button>
            <button className={mode === 'bulk' ? 'active' : ''} onClick={() => setMode('bulk')}>忽略站点</button>
          </div>
          <p style={{ marginTop: 8 }}>{mode === 'priority' ? '先卸的最后装，整段靠近门。' : '厚的先从里端塞，用来看跨站阻挡。这不是推荐装法。'}</p>
        </section>
        <section className="demo-card">
          <h2>{shipment ? '卸货组' : scenario.id === 'land' ? '三个站点' : '三个卸货组'}</h2>
          <div className="stop-list">
            {[...plan.stops].sort((a, b) => a.priority - b.priority).map((item) => {
              const count = plan.placed.filter((piece) => piece.stopId === item.id).length
              return <div key={item.id} className={item.id === stop.id ? 'stop-row active' : 'stop-row'}>
                <button onClick={() => setStopId(item.id)}><span><i className="stop-swatch" style={{ background: item.color }} />{item.name}</span><span>{count} 件</span></button>
                <input aria-label={`${item.name} 卸货优先级，数字小的先卸`} type="number" min={1} step={1} value={item.priority} onChange={(event) => {
                  const value = Number(event.target.value)
                  if (Number.isInteger(value) && value > 0) setPriorities((current) => ({ ...current, [item.id]: value }))
                }} />
              </div>
            })}
          </div>
          <p>优先级数字小的先卸、靠近门。改优先级会立刻重算。</p>
        </section>
        <Checks plan={plan} sea={scenario.id === 'sea'} lashingCount={lashing.length} />
        <section className="demo-card">
          <h2>改一票</h2>
          <p>{omitted ? `已拿掉 ${cut?.item.name || '一件'}，这是第 2 版。` : '当前是第 1 版完整清单。'}</p>
          <div className="mode-switch" style={{ marginTop: 8 }}>
            <button disabled={!cut || omitted === cut.item.id} onClick={() => cut && setOmitted(cut.item.id)}>拿掉先卸组一件</button>
            <button disabled={!omitted} onClick={() => setOmitted(null)}>恢复</button>
          </div>
        </section>
      </aside>
      <div className="demo-main">
        <section className="viewer-card">
          <div className="card-header"><div><h2>{plan.vehicle.name}</h2></div><span className="muted">{plan.vehicle.doorLabel} · {plan.vehicle.dimensions.length}×{plan.vehicle.dimensions.width}×{plan.vehicle.dimensions.height} mm</span></div>
          <div className="metric-row" style={{ padding: '12px 16px 0' }}>
            <span><b>{shown}</b>已装 / {plan.placed.length} 件方案</span>
            <span><b>{plan.unpacked.length}</b>未装</span>
            <span><b>{kg(container.totalWeight)}</b>kg</span>
            <span><b>{(container.volumeUtilization * 100).toFixed(1)}%</b>体积</span>
            <span className={progress.active.length ? 'load-metric-danger' : 'ok'}><b>{progress.active.length}</b>件跨站阻挡</span>
          </div>
          <div className="viewer-stage demo-view">
            {webgl ? <Suspense fallback={<div className="viewer-fallback">正在打开 3D…</div>}>
              <ContainerViewer container={container} selectedId={selected} onSelect={setSelected} onError={() => setWebgl(false)} blockerIds={progress.blockerIds} blockedIds={progress.blockedIds} focus={focus} cargoDestinations={destinations} />
            </Suspense> : <TopView plan={plan} visible={visible} selected={selected} onSelect={setSelected} blockerIds={progress.blockerIds} blockedIds={progress.blockedIds} />}
          </div>
          <div className={`load-progress ${progress.active.length ? 'has-obstruction' : ''}`}>
            <div className="load-progress-title"><label htmlFor="cargo-load-step">装到第 {shown} / {plan.loadOrder.length} 件</label><span>{newBlocks ? `此步新增 ${newBlocks} 件卸货阻挡` : progress.active.length ? '卸货阻挡仍存在' : '当前未发现跨站卸货阻挡'}</span></div>
            <div className="load-slider"><input id="cargo-load-step" aria-label="装箱过程进度" type="range" min={0} max={plan.loadOrder.length} value={shown} onChange={event => { setStep(Number(event.target.value)); setSelected(null); setFocus(undefined) }} />
              <div className="load-event-track">{progress.events.map(event => <button key={event.step} className={event.step <= shown ? 'load-event active' : 'load-event'} style={{ left: `${event.step / Math.max(1, plan.loadOrder.length) * 100}%` }} title={`第 ${event.step} 件：新增 ${event.itemIds.length} 件卸货阻挡`} aria-label={`跳到第 ${event.step} 件，新增 ${event.itemIds.length} 件卸货阻挡`} onClick={() => jumpToObstruction(event.step, event.itemIds[0])} />)}</div>
            </div>
            <div className={`load-status ${progress.active.length ? 'danger' : 'clear'}`} role="status" aria-live="polite" data-blocked-count={progress.active.length}>
              <strong>{progress.active.length ? `⚠ 卸货受阻：${progress.active.length} 件先卸货物被挡` : `✓ 已装 ${shown} 件，跨站卸货阻挡 0 件`}</strong>
              <span>{progress.active.length ? '红框是挡路的晚卸货物，橙框是被挡的先卸货物。' : progress.events.length ? '红色刻度标出后续首次出现卸货阻挡的步骤。' : '本方案各装载步骤未发现跨站卸货阻挡。'}</span>
              {progress.active.length > 0 && <button onClick={() => focusObstruction()}>定位阻挡 · 从卸货口查看</button>}
            </div>
            {progress.active.length > 0 && <div className="load-block-list">{progress.active.map(row => <button key={row.itemId} onClick={() => focusObstruction(row.itemId)}>{plan.placed.find(p => p.item.id === row.itemId)?.item.name} · 被 {row.blockedBy.length} 件挡住</button>)}</div>}
            <p className="load-progress-note">按已装货物的门向投影检查卸货先后；不代表装入路径碰撞或现场搬运仿真。</p>
          </div>
        </section>
        <div className="lists">
          <section className="manifest-card">
            <div className="card-header"><h2>装载顺序</h2><button className="text-button" onClick={() => download(planMarkdown(plan, scenario.title), `${scenario.id}-plan.md`)}>导出清单</button></div>
            <div className="table-scroll"><table>
              <thead><tr><th>序</th><th>货物</th><th>去向</th><th>kg</th></tr></thead>
              <tbody>{plan.loadOrder.map((piece, index) => <tr key={piece.item.id} className={piece.item.id === selected ? 'selected' : ''} hidden={index >= shown} onClick={() => setSelected(piece.item.id)}><td>{index + 1}</td><td><strong>{piece.item.name}</strong><small>{piece.item.id}</small></td><td>{plan.stops.find((item) => item.id === piece.stopId)?.name}</td><td>{kg(piece.item.weight)}</td></tr>)}</tbody>
            </table></div>
          </section>
          <section className="manifest-card">
            <div className="card-header"><h2>卸货 · {stop.name}</h2><span className="muted">先拿靠近门的</span></div>
            <div className="table-scroll"><table>
              <thead><tr><th>序</th><th>货物</th><th>kg</th><th>阻挡</th></tr></thead>
              <tbody>{unload.map((piece, index) => {
                const block = plan.blocking.find((row) => row.itemId === piece.item.id)
                return <tr key={piece.item.id} className={piece.item.id === selected ? 'selected' : ''} onClick={() => setSelected(piece.item.id)}><td>{index + 1}</td><td><strong>{piece.item.name}</strong><small>{String(piece.item.rawData._sourceSheet)} 第 {String(piece.item.rawData._sourceRow)} 行</small></td><td>{kg(piece.item.weight)}</td><td>{block ? `${block.blockedBy.length} 件晚卸货挡在门外` : '无'}</td></tr>
              })}{!unload.length && <tr><td className="table-empty" colSpan={4}>这一组没有留下货物。</td></tr>}</tbody>
            </table></div>
          </section>
        </div>
        {plan.unpacked.length > 0 && <section className="demo-card"><h2>未装 {plan.unpacked.length} 件</h2><ul className="check-list">{reasonCounts(plan.unpacked).map(([reason, count]) => <li key={reason}>{count} 件：{reason}</li>)}</ul></section>}
      </div>
    </div>
  </div>
}

function reasonCounts(rows: PackPlan['unpacked']): [string, number][] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.reason, (counts.get(row.reason) || 0) + 1)
  return [...counts]
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="dim-field"><span>{label}</span><input type="number" min={0} step={1} value={value} onChange={(event) => {
    const next = Number(event.target.value)
    if (Number.isFinite(next)) onChange(next)
  }} /></label>
}

function Checks({ plan, sea, lashingCount }: { plan: PackPlan; sea: boolean; lashingCount: number }) {
  const over = plan.totalWeightKg > plan.vehicle.maxWeightKg
  const outerMm = plan.placed.length ? Math.max(...plan.placed.map((piece) => piece.position.x + piece.actualDimensions.length)) : 0
  const doorGapMm = Math.max(0, plan.vehicle.dimensions.length - outerMm)
  return <section className="demo-card">
    <h2>本票检查</h2>
    <ul className="check-list">
      <li className={over ? 'warn' : 'ok'}>{over ? '超过演示载重。' : `总重 ${kg(plan.totalWeightKg)} kg，未超过演示载重 ${plan.vehicle.maxWeightKg} kg。`}</li>
      <li>沿车长三段重量 {plan.thirdsKg.map((value) => kg(value)).join(' / ')} kg。这是分布示意，没有轴距，不算轴荷。</li>
      <li className={plan.crossStopBlocks ? 'warn' : 'ok'}>{plan.crossStopBlocks ? `${plan.crossStopBlocks} 件被更晚卸的货挡住。` : '跨组阻挡为 0。先卸的货在更靠门的一侧。'}</li>
      {doorGapMm > 200 && <li>最外侧货物离门还有 {kg(doorGapMm)} mm 空位。货是从封闭端往外排的，没有顶满门口。</li>}
      {sea && <li>VGM 草稿只含货物 {kg(plan.totalWeightKg)} kg。箱皮重未填，状态是待法定过磅，不是证书。</li>}
      {sea && <li>{plan.heavyOnLight.length ? `${plan.heavyOnLight.length} 处更重的件压在更轻的件上，CTU 待核对。` : '没有更重的件压在更轻的件上。这不是加固计算。'}</li>}
      {sea && <li>{lashingCount} 件带玻璃或高度达到 1 m，需固定。条数待工程确认。</li>}
      {sea && <li>上海港作业待办：VGM 未提交，装箱照片未采集，危险品声明未填。不表示码头或海关已放行。</li>}
    </ul>
  </section>
}

function TopView({ plan, visible, selected, onSelect, blockerIds, blockedIds }: { plan: PackPlan; visible: Set<string>; selected: string | null; onSelect: (id: string) => void; blockerIds: ReadonlySet<string>; blockedIds: ReadonlySet<string> }) {
  const length = plan.vehicle.dimensions.length
  const width = plan.vehicle.dimensions.width
  const colors = new Map(plan.stops.map((stop) => [stop.id, stop.color]))
  return <svg className="top-view" viewBox={`-80 -100 ${length + 1100} ${width + 200}`} role="img" aria-label="俯视图">
    <rect x={0} y={0} width={length} height={width} fill="#e7eef0" stroke="#647981" />
    {plan.placed.filter((piece) => visible.has(piece.item.id)).map((piece) => <rect key={piece.item.id} x={piece.position.x} y={piece.position.y} width={piece.actualDimensions.length} height={piece.actualDimensions.width} fill={piece.item.id === selected ? '#f2cf6c' : colors.get(piece.stopId)} opacity={0.9} stroke={blockerIds.has(piece.item.id) ? '#dc303e' : blockedIds.has(piece.item.id) ? '#e69b26' : '#fff'} strokeWidth={blockerIds.has(piece.item.id) || blockedIds.has(piece.item.id) ? 22 : 5} onClick={() => onSelect(piece.item.id)} />)}
    <path d={`M ${length} 0 V ${width} M ${length + 80} ${width / 2} H ${length + 850} l -150 -100 m 150 100 l -150 100`} stroke="#148b7a" strokeWidth="25" fill="none" />
    <text x={length + 100} y={width / 2 - 160} fontSize="145" fill="#116c64">卸货口 →</text>
  </svg>
}
