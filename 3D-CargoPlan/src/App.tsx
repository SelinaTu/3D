// #created 11/08/2026
import { FloatingAssistant, NativeSupportWidget, useSupportContext } from './support/SupportAssistant'
import { NativePortDossier } from './knowledge/globe/NativePortDossier'
import { NativeCargoEditor } from './demo/NativeCargoEditor'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { NativeRouteWorkspace } from './demo/NativeRouteWorkspace'
import { PackingStudio } from './demo/PackingStudio'
import { CustomerValue } from './demo/CustomerValue'
import { useAppStore, useSelectedSolution } from './store/app-store'
import type { CargoItem, Container, OptimizationConfig, PackingSolution } from './types/packing'
import './app.css'
import './demo/native-app.css'

const PortKnowledge = lazy(() => import('./knowledge/globe/KnowledgeGlobe').then(m => ({ default: m.KnowledgeGlobe })))
const ContainerViewer = lazy(() => import('./components/ContainerViewer').then((module) => ({ default: module.ContainerViewer })))
const algorithmLabels: Record<string, string> = {
  greedy: '贪心算法 · FFD', genetic: '遗传算法', tabu: '禁忌搜索', 'ant-colony': '蚁群算法',
  'branch-bound': '分支定界', hybrid: '混合优化', compare: '多算法对比',
  'GREEDY-FFD': '贪心 · FFD', 'GREEDY-BFD': '贪心 · BFD', GENETIC: '遗传算法',
  'TABU-SEARCH': '禁忌搜索', 'ANT-COLONY': '蚁群算法', 'BRANCH-BOUND': '分支定界', HYBRID: '混合优化'
}
const algorithmLabel = (value: string) => algorithmLabels[value] || value
const number = (value: number, digits = 0) => value.toLocaleString('zh-CN', { maximumFractionDigits: digits })
const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const errorText = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试'
const placedCount = (solution: PackingSolution) => solution.containers.reduce((sum, container) => sum + container.items.length, 0)
const terminationLabels: Record<string, string> = { completed: '搜索完成', 'time-limit': '达到时间预算', 'iteration-limit': '达到迭代上限', 'size-limit': '采用大规模启发式搜索' }

class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

type Job = {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: { progress: number; message: string; algorithm: string }
  solutions?: PackingSolution[]
  error?: string
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  let data
  try { data = await response.json() } catch { throw new Error(`服务响应异常（${response.status}），请确认后端已启动`) }
  if (!response.ok || data.success === false) throw new ApiError(data.error || `请求失败（${response.status}）`, response.status)
  return data as T
}
function Icon({ name, size = 20 }: { name: 'box' | 'upload' | 'play' | 'download' | 'check' | 'arrow' | 'layers' | 'close'; size?: number }) {
  const paths = {
    box: <><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" /></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" /></>,
    play: <path d="m8 4 12 8-12 8V4Z" />,
    download: <path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5" />,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    layers: <><path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}{hint && <small>{hint}</small>}</span>{children}</label>
}
function Meter({ value, tone = '' }: { value: number; tone?: string }) {
  return <div className={`meter ${tone}`}><span style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>
}
function App() {
  const { cargoItems, solutions, config, isOptimizing, progress, error, setCargoItems, setSolutions, selectSolution, setConfig, setOptimizing, setProgress, setError } = useAppStore()
  const selectedSolution = useSelectedSolution()
  const [source, setSource] = useState('尚未导入货物')
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobMessage, setJobMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedContainer, setSelectedContainer] = useState(0)
  const [selectedCargo, setSelectedCargo] = useState<string | null>(null)
  const [view, setView] = useState<'3d' | 'top'>('3d')
  const [webgl, setWebgl] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [workspace, setWorkspace] = useState<'bench' | 'demo' | 'ports' | 'value'>(() => location.hash === '#demo' ? 'demo' : location.hash === '#ports' ? 'ports' : location.hash === '#value' ? 'value' : 'bench')
  const [knowledgePort, setKnowledgePort] = useState('')
  const nativeSupport=useSupportContext()
  useEffect(()=>{if(new URLSearchParams(location.search).get('native')==='1' && nativeSupport.portCode)setKnowledgePort(nativeSupport.portCode)},[nativeSupport.portCode])
  const [demoVisited, setDemoVisited] = useState(location.hash === '#demo')
  useEffect(() => {
    const sync = () => {
      const hash = location.hash.slice(1)
      const next = hash === 'demo' || hash === 'ports' || hash === 'value' ? hash : 'bench'
      if (next === 'demo') setDemoVisited(true)
      setWorkspace(next)
      if (hash && next === 'bench') history.replaceState(null, '', location.pathname + location.search)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => window.cargoPlanDesktop?.onNavigate(next => {
    if (!['bench', 'demo', 'ports', 'value'].includes(next)) return
    if (next === 'demo') setDemoVisited(true)
    setWorkspace(next)
    history.replaceState(null, '', next === 'bench' ? '/' : `/#${next}`)
  }), [])
  function showWorkspace(next: 'bench' | 'demo' | 'ports' | 'value') {
    if (new URLSearchParams(location.search).get('native') === '1') window.webkit?.messageHandlers?.cargoPlan?.postMessage({type:'navigate',workspace:next})
    if (next === 'demo') setDemoVisited(true)
    setWorkspace(next)
    const url = new URL(location.href)
    url.hash = next === 'bench' ? '' : next
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }
  const [cancelling, setCancelling] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const configTouched = useRef(false)
  const busy = loading || isOptimizing

  useEffect(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!context) { setWebgl(false); setView('top') }
    else context.getExtension('WEBGL_lose_context')?.loseContext()
    const controller = new AbortController()
    request<{ defaults?: OptimizationConfig; config?: OptimizationConfig }>('/api/config', { signal: controller.signal })
      .then((data) => {
        const defaults = data.defaults || data.config
        if (defaults && !configTouched.current && useAppStore.getState().cargoItems.length === 0) setConfig(defaults)
      }).catch(() => { /* Editable local defaults also support starting the API later. */ })
    return () => controller.abort()
  }, [setConfig])

  useEffect(() => {
    setSelectedContainer(0); setSelectedCargo(null); setQuery(''); setPage(0)
  }, [selectedSolution?.id])
  useEffect(() => { setSelectedCargo(null); setPage(0); setQuery('') }, [selectedContainer])

  useEffect(() => {
    if (!jobId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let failures = 0
    let stopped = false
    async function poll() {
      try {
        const job = await request<Job>(`/api/jobs/${jobId}`, { signal: controller.signal, cache: 'no-store' })
        if (stopped) return
        if (failures) setError(null)
        failures = 0
        if (job.progress) { setProgress(job.progress.progress); setJobMessage(job.progress.message || algorithmLabel(job.progress.algorithm)) }
        if (job.status === 'completed') {
          setSolutions(job.solutions || []); setProgress(100); setOptimizing(false); setJobId(null)
          setNotice(`优化完成，已生成 ${job.solutions?.length || 0} 个真实装箱方案。`)
          return
        }
        if (job.status === 'failed' || job.status === 'cancelled') {
          setOptimizing(false); setJobId(null)
          if (job.status === 'failed') setError(job.error || '优化失败，请检查货物和参数后重试')
          else setNotice('优化任务已取消，可调整参数后重新运行。')
          return
        }
      } catch (pollError) {
        if (stopped || controller.signal.aborted) return
        if (pollError instanceof ApiError && pollError.status === 404) {
          setError('优化任务已过期或服务已重启，请重新运行优化。')
          setOptimizing(false); setJobId(null)
          return
        }
        failures += 1
        if (failures >= 3) setError(`连接中断，正在重试：${errorText(pollError)}`)
      }
      if (!stopped) timer = setTimeout(poll, failures ? 2500 : 650)
    }
    void poll()
    return () => { stopped = true; controller.abort(); clearTimeout(timer) }
  }, [jobId, setError, setOptimizing, setProgress, setSolutions])

  const totals = useMemo(() => cargoItems.reduce((sum, item) => ({
    weight: sum.weight + item.weight,
    volume: sum.volume + item.dimensions.length * item.dimensions.width * item.dimensions.height,
    glass: sum.glass + Number(item.hasGlass),
    review: sum.review + Number(Boolean(item.constraints?.requiresManualReview?.length))
  }), { weight: 0, volume: 0, glass: 0, review: 0 }), [cargoItems])
  const containerVolume = config.containerDimensions.length * config.containerDimensions.width * config.containerDimensions.height
  const lowerBound = Math.max(Math.ceil(totals.volume / containerVolume), Math.ceil(totals.weight / config.containerMaxWeight))
  const currentContainer = selectedSolution?.containers[selectedContainer]
  const manifest = useMemo(() => {
    const rows = currentContainer?.items || []
    const term = query.trim().toLowerCase()
    return term ? rows.filter(({ item }) => `${item.id} ${item.name} ${item.category}`.toLowerCase().includes(term)) : rows
  }, [currentContainer, query])
  const pageCount = Math.max(1, Math.ceil(manifest.length / 20))
  const actualPage = Math.min(page, pageCount - 1)
  const selectedPlaced = currentContainer?.items.find(({ item }) => item.id === selectedCargo)

  async function loadDemo() {
    setLoading(true); setError(null); setNotice('')
    try {
      const result = await request<{ data: CargoItem[] }>('/api/load-demo')
      if (!Array.isArray(result.data) || !result.data.length) throw new Error('示例货物为空')
      setCargoItems(result.data); setSource('伊拉克 Villa · 完整货物清单')
      setNotice(`已加载 ${number(result.data.length)} 件货物，请运行优化生成方案。`)
    } catch (loadError) { setError(errorText(loadError)) }
    finally { setLoading(false) }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLoading(true); setError(null); setNotice('')
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('请上传不超过 20 MB 的 Excel 文件')
      const { parseExcelBuffer } = await import('./core/data-parser')
      const items = parseExcelBuffer(await file.arrayBuffer())
      if (!items.length) throw new Error('未识别到有效货物，请使用导入模板检查表头和单位')
      setCargoItems(items); setSource(file.name); setNotice(`导入成功：${number(items.length)} 个货物单元，数量已展开。`)
    } catch (importError) { setError(errorText(importError)) }
    finally { setLoading(false) }
  }
  async function startOptimization() {
    setError(null); setNotice('')
    if (!cargoItems.length) { setError('请先导入货物数据'); return }
    const values = [...Object.values(config.containerDimensions), config.containerMaxWeight, config.timeLimit || 0]
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) { setError('柜体尺寸、最大载重和时间预算必须是大于零的数值'); return }
    if ((config.timeLimit || 0) < 1000 || (config.timeLimit || 0) > 120000) { setError('计算时间预算须在 1–120 秒之间'); return }
    setOptimizing(true); setProgress(0); setJobMessage('正在创建优化任务…')
    try {
      const result = await request<{ jobId: string }>('/api/optimize', { method: 'POST', body: JSON.stringify({ items: cargoItems, config }) })
      if (!result.jobId) throw new Error('服务未返回任务编号')
      setJobId(result.jobId)
    } catch (startError) { setError(errorText(startError)); setOptimizing(false) }
  }
  async function cancelOptimization() {
    if (!jobId) return
    setCancelling(true)
    try {
      const outcome = await request<{ status: Job['status'] }>(`/api/jobs/${jobId}`, { method: 'DELETE' })
      if (outcome.status === 'completed') {
        const completed = await request<Job>(`/api/jobs/${jobId}`)
        setSolutions(completed.solutions || []); setProgress(100)
        setNotice('任务已在取消前完成，结果已保留。')
      } else setNotice('优化任务已取消，可调整参数后重新运行。')
      setJobId(null); setOptimizing(false); setError(null)
    } catch (cancelError) { setError(errorText(cancelError)) }
    finally { setCancelling(false) }
  }
  function updateConfig(next: Partial<OptimizationConfig>) { configTouched.current = true; setConfig({ ...config, ...next }); setNotice('') }
  async function exportAction(action: 'json' | 'excel' | 'report' | 'template') {
    setError(null); setExporting(true)
    try {
      const helpers = await import('./core/export-utils')
      if (action === 'template') helpers.downloadCargoTemplate()
      else if (selectedSolution) {
        if (action === 'json') helpers.exportSolutionJSON(selectedSolution)
        else if (action === 'excel') helpers.exportSolutionExcel(selectedSolution)
        else helpers.exportSolutionReport(selectedSolution)
      }
    } catch (exportError) { setError(errorText(exportError)) }
    finally { setExporting(false) }
  }

  return <div className="app-shell">
    <header className="app-header">
      <div className="brand"><span className="brand-icon"><Icon name="box" size={25} /></span><div><strong>3D舱策 <span>3D CargoPlan</span></strong><small>3D集装箱装载优化工作台</small></div></div>
      <div className="header-actions"><div className="header-switch"><button className={workspace === 'bench' ? 'active' : ''} onClick={() => showWorkspace('bench')}>3D装箱工作台</button><button className={workspace === 'demo' ? 'active' : ''} onClick={() => showWorkspace('demo')}>海陆样例</button><button className={workspace === 'value' ? 'active' : ''} onClick={() => showWorkspace('value')}>客户价值</button><button className={workspace === 'ports' ? 'active' : ''} onClick={() => showWorkspace('ports')}>海运知识库</button></div><span className="workspace-label"><span /> 项目工作区</span><button className="button ghost" disabled={!selectedSolution || exporting || workspace !== 'bench'} onClick={() => void exportAction('report')}><Icon name="download" size={16} /> 导出报告</button></div>
    </header>
    {demoVisited && <div hidden={workspace !== 'demo'}>{new URLSearchParams(location.search).get('native') === '1' ? <NativeRouteWorkspace /> : <PackingStudio />}</div>}
    {workspace === 'ports' && <Suspense fallback={<div className="viewer-fallback">正在加载海运知识…</div>}><PortKnowledge initialPort={knowledgePort} /></Suspense>}
    {workspace === 'value' && <CustomerValue />}
    {workspace === 'bench' && <div className="app-layout">
      <aside className="setup-panel">
        <div className="panel-title"><span className="step">01</span><h2>准备货物</h2><span className="eyebrow">DATA</span></div>
        <input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={(event) => void importFile(event)} className="hidden-input" disabled={busy} aria-label="上传 Excel 货物清单" />
        <button className="upload-zone" disabled={busy} onClick={() => fileInput.current?.click()}><span className="upload-symbol"><Icon name="upload" size={22} /></span><strong>{loading ? '正在读取货物…' : '导入货物清单'}</strong><small>选择 Excel 文件 · .xlsx / .xls</small></button>
        <div className="data-actions"><button disabled={busy} onClick={() => void loadDemo()}>加载示例数据</button><span>·</span><button disabled={exporting} onClick={() => void exportAction('template')}>下载导入模板</button></div>
        {cargoItems.length > 0 && <div className="source-card"><Icon name="check" size={17} /><div><strong title={source}>{source}</strong><small>{number(cargoItems.length)} 件货物已就绪</small></div></div>}
        <div className="panel-divider" />
        <div className="panel-title"><span className="step">02</span><h2>设置装载条件</h2><span className="eyebrow">CONFIG</span></div>
        <fieldset disabled={busy} className="config-fields">
          <Field label="集装箱规格"><select value="custom" onChange={(event) => {
            if (event.target.value === '40hc') updateConfig({ containerDimensions: { length: 12032, width: 2352, height: 2698 }, containerMaxWeight: 28000 })
            if (event.target.value === '20gp') updateConfig({ containerDimensions: { length: 5898, width: 2352, height: 2393 }, containerMaxWeight: 28000 })
          }}><option value="custom">自定义 / 当前规格</option><option value="40hc">40HC · 40 尺高柜</option><option value="20gp">20GP · 20 尺普柜</option></select></Field>
          <div className="dimension-fields">{(['length', 'width', 'height'] as const).map((key, index) => <Field key={key} label={['内长', '内宽', '内高'][index]} hint="mm"><input type="number" min="1" step="1" value={config.containerDimensions[key]} onChange={(event) => updateConfig({ containerDimensions: { ...config.containerDimensions, [key]: Number(event.target.value) } })} /></Field>)}</div>
          <Field label="最大载重" hint="kg"><input type="number" min="1" value={config.containerMaxWeight} onChange={(event) => updateConfig({ containerMaxWeight: Number(event.target.value) })} /></Field>
          <div className="panel-divider" />
          <div className="panel-title"><span className="step">03</span><h2>选择优化策略</h2></div>
          <Field label="优化算法"><select value={config.algorithm} onChange={(event) => updateConfig({ algorithm: event.target.value as OptimizationConfig['algorithm'] })}>{['greedy', 'hybrid', 'genetic', 'tabu', 'ant-colony', 'branch-bound', 'compare'].map((algorithm) => <option key={algorithm} value={algorithm}>{algorithmLabel(algorithm)}</option>)}</select></Field>
          <Field label="计算时间预算" hint="1–120 秒"><input type="number" min="1" max="120" value={(config.timeLimit ?? 30000) / 1000} onChange={(event) => updateConfig({ timeLimit: Number(event.target.value) * 1000 })} /></Field>
        </fieldset>
        <p className="config-note">以完整装载和减少柜数为优先目标，检查边界、碰撞、支撑与载重约束。</p>
        <div className="run-area"><button className="button primary run-button" disabled={busy || !cargoItems.length} onClick={() => void startOptimization()}>{isOptimizing ? <span className="spinner" /> : <Icon name="play" size={16} />}{isOptimizing ? '正在优化装载方案' : '开始优化'}{!isOptimizing && <Icon name="arrow" size={17} />}</button>
          {isOptimizing && <div className="job-progress" role="status"><div><span>{jobMessage}</span><strong>{progress.toFixed(0)}%</strong></div><Meter value={progress / 100} /><button disabled={!jobId || cancelling} onClick={() => void cancelOptimization()}>{cancelling ? '正在取消…' : '取消任务'}</button></div>}
          {!cargoItems.length && <small className="run-hint">先导入一份货物清单，即可开始</small>}
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> 本地计算 · 货物数据保留在本机</div>
      </aside>
      <main className="workspace">
        <div className="workspace-heading"><div><span className="eyebrow">LOAD PLANNING / 工作台</span><h1>3D装箱，让每一方空间更有价值。</h1></div><span className={`pill ${isOptimizing ? 'working' : cargoItems.length ? 'ready' : ''}`}>{isOptimizing ? '优化计算中' : selectedSolution ? '方案已生成' : cargoItems.length ? '数据已就绪' : '等待导入'}</span></div>
        {error && <div className="message error" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="关闭错误提示"><Icon name="close" size={16} /></button></div>}
        {notice && <div className="message success" role="status"><Icon name="check" size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="关闭提示"><Icon name="close" size={16} /></button></div>}
        <div className="summary-grid"><Metric label="货物总件数" value={number(cargoItems.length)} unit="件" note={cargoItems.length ? `${number(totals.glass)} 件含玻璃` : '等待导入货物'} /><Metric label="货物总体积" value={(totals.volume / 1e9).toFixed(2)} unit="m³" note="按外包尺寸计算" /><Metric label="货物总重量" value={(totals.weight / 1000).toFixed(2)} unit="t" note={`${number(totals.weight, 1)} kg`} /><Metric label="理论柜数下界" value={cargoItems.length && Number.isFinite(lowerBound) ? String(lowerBound) : '—'} unit="柜" note="仅基于体积与载重估算" /></div>
        {selectedSolution && selectedSolution.unpackedItems.length > 0 && <div className="incomplete-banner" role="status"><strong>未全装载 · {number(selectedSolution.unpackedItems.length)} 件待处理</strong><span>请查看右侧未装货物与复核说明，确认后重新计算。当前方案可导出审阅。</span></div>}
        <section className="viewer-card">
          <div className="card-header"><div><Icon name="layers" size={18} /><h2>3D装载可视化</h2>{currentContainer && <span className="muted">柜 {selectedContainer + 1} / {selectedSolution?.totalContainers}</span>}</div><div className="segmented"><button className={view === '3d' ? 'active' : ''} disabled={!webgl} onClick={() => setView('3d')}>3D 视图</button><button className={view === 'top' ? 'active' : ''} onClick={() => setView('top')}>俯视图</button></div></div>
          <div className="viewer-stage">
            {currentContainer ? <>
              {view === '3d' && webgl ? <Suspense fallback={<div className="viewer-fallback"><span className="spinner" /> 正在加载 3D 视图…</div>}><ContainerViewer container={currentContainer} selectedId={selectedCargo} onSelect={setSelectedCargo} onError={() => { setWebgl(false); setView('top') }} /></Suspense> : <TopView container={currentContainer} selectedId={selectedCargo} onSelect={setSelectedCargo} />}
              <>{view === 'top' && <div className="view-caption"><span className="status-dot" />长 × 宽俯视投影 · 同位置高层覆盖低层</div>}</>
            </> : <div className="empty-state"><div className="empty-container"><svg viewBox="0 0 300 160" aria-hidden="true"><path d="m25 67 175-40 75 29v65L99 151 25 117V67Z" /><path d="m25 67 74 31 176-42M99 98v53M200 27v64l75 30" /><path d="m43 75 1 47m18-39 1 46m18-38 1 46M116 96v48m19-53v49m19-53v50m19-55v51m19-55v52m19-56v53m19-57v54m19-58v54" /></svg><span><Icon name="box" size={28} /></span></div><h3>{isOptimizing ? '正在寻找更合适的装载方式' : cargoItems.length ? '货物已就绪，开始生成装载方案' : '从一份货物清单开始'}</h3><p>{isOptimizing ? '计算在后台运行，你可以随时取消任务。' : cargoItems.length ? '在左侧选择策略，点击「开始优化」查看真实结果。' : '导入 Excel 或加载项目样例，查看空间、重量与装载约束。'}</p>{!cargoItems.length && <button className="button outline" disabled={busy} onClick={() => void loadDemo()}>体验项目样例 <Icon name="arrow" size={16} /></button>}</div>}
          </div>
          {selectedSolution && <div className="container-switcher"><span>选择集装箱</span><div>{selectedSolution.containers.map((container, index) => <button key={container.id} className={selectedContainer === index ? 'active' : ''} onClick={() => setSelectedContainer(index)}>柜 {String(index + 1).padStart(2, '0')}<small>{container.items.length} 件</small></button>)}</div></div>}
          {currentContainer && <div className="container-metrics"><div><span>体积利用率</span><strong>{percent(currentContainer.volumeUtilization)}</strong><Meter value={currentContainer.volumeUtilization} /></div><div><span>载重利用率</span><strong>{percent(currentContainer.weightUtilization)}</strong><Meter value={currentContainer.weightUtilization} tone="blue" /></div><div><span>当前载重</span><strong>{number(currentContainer.totalWeight, 1)} <small>kg</small></strong><small>上限 {number(currentContainer.maxWeight)} kg</small></div><div><span>柜内货物</span><strong>{number(currentContainer.items.length)} <small>件</small></strong><small>点选货物可定位明细</small></div></div>}
        </section>
        <section className="manifest-card"><div className="card-header"><div><h2>货物明细</h2><span className="muted">{currentContainer ? `当前柜 · ${currentContainer.items.length} 件` : '优化后查看位置与方向'}</span></div><input className="search-input" placeholder="搜索名称 / 编号" aria-label="搜索货物" value={query} disabled={!currentContainer} onChange={(event) => { setQuery(event.target.value); setPage(0) }} /></div>
          {selectedPlaced && <div className="selected-cargo"><strong>已选中 {selectedPlaced.item.name}</strong><span>{selectedPlaced.item.id}</span><button onClick={() => setSelectedCargo(null)} aria-label="取消选中"><Icon name="close" size={14} /></button></div>}
          <div className="table-scroll"><table><thead><tr><th>货物 / 编号</th><th>实装尺寸 <small>mm</small></th><th>坐标 X / Y / Z <small>mm</small></th><th>方向</th><th>重量 <small>kg</small></th></tr></thead><tbody>{currentContainer ? manifest.slice(actualPage * 20, actualPage * 20 + 20).map((placed) => <tr key={placed.item.id} className={selectedCargo === placed.item.id ? 'selected' : ''} onClick={() => setSelectedCargo(placed.item.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedCargo(placed.item.id) }}><td><strong>{placed.item.name}</strong><small>{placed.item.id}</small></td><td>{placed.actualDimensions.length} × {placed.actualDimensions.width} × {placed.actualDimensions.height}</td><td>{number(placed.position.x)} / {number(placed.position.y)} / {number(placed.position.z)}</td><td>{{ standing: '立放', lying: '侧放', flat: '平放' }[placed.orientation]} · {placed.rotation}°</td><td>{number(placed.item.weight, 1)}</td></tr>) : <tr><td colSpan={5} className="table-empty">生成方案后，这里将显示每件货物的实装尺寸、位置和摆放方向。</td></tr>}{currentContainer && !manifest.length && <tr><td colSpan={5} className="table-empty">没有匹配的货物</td></tr>}</tbody></table></div>
          {currentContainer && <div className="pagination"><span>共 {manifest.length} 件 · 第 {actualPage + 1} / {pageCount} 页</span><div><button disabled={actualPage === 0} onClick={() => setPage(actualPage - 1)}>上一页</button><button disabled={actualPage === pageCount - 1} onClick={() => setPage(actualPage + 1)}>下一页</button></div></div>}
        </section>
        <footer className="workspace-footer">坐标约定：X 为长、Y 为宽、Z 为高，原点位于柜底角。计算结果可导出复核。</footer>
      </main>
      <aside className="results-panel"><div className="results-heading"><div><span className="eyebrow">RESULTS</span><h2>方案对比</h2></div><span className="count-badge">{solutions.length}</span></div>
        {solutions.length ? <><p className="results-intro">优先比较未装件数，再比较柜数与利用率。</p><div className="solution-list">{solutions.map((solution, index) => <SolutionCard key={solution.id} solution={solution} index={index} selected={selectedSolution?.id === solution.id} onClick={() => selectSolution(solution.id)} />)}</div></> : <div className="results-empty"><Icon name="layers" size={29} /><strong>等待第一个方案</strong><p>运行优化后，可在这里比较不同算法的装载表现。</p></div>}
        {selectedSolution && <>
          <div className="panel-divider" /><div className="detail-heading"><h3>方案校验</h3><span className={`pill ${selectedSolution.validation?.valid ? 'ready' : 'warning'}`}>{selectedSolution.validation ? selectedSolution.validation.valid ? '几何校验通过' : '校验未通过' : '待校验'}</span></div>
          <div className="validation-stats"><span>已装货物<strong>{number(placedCount(selectedSolution))} 件</strong></span><span>待处理货物<strong className={selectedSolution.unpackedItems.length ? 'amber-text' : ''}>{number(selectedSolution.unpackedItems.length)} 件</strong></span><span>算法耗时<strong>{(selectedSolution.computeTime / 1000).toFixed(2)} 秒</strong></span></div>
          {selectedSolution.terminationReason && <p className="detail-note">{terminationLabels[selectedSolution.terminationReason]} · {selectedSolution.searchMode === 'bounded-search' ? '受限搜索' : '启发式结果'}</p>}
          {(selectedSolution.validation?.errors.length || 0) > 0 && <details className="review-details error-detail" open><summary>校验问题（{selectedSolution.validation!.errors.length}）</summary><ul>{selectedSolution.validation!.errors.map((message, index) => <li key={index}>{message}</li>)}</ul></details>}
          {(selectedSolution.validation?.warnings.length || 0) > 0 && <details className="review-details"><summary>需要复核（{selectedSolution.validation!.warnings.length}）</summary><ul>{selectedSolution.validation!.warnings.map((message, index) => <li key={index}>{message}</li>)}</ul></details>}
          {selectedSolution.unpackedItems.length > 0 && <details className="review-details"><summary>查看未装货物（{selectedSolution.unpackedItems.length}）</summary><ul>{selectedSolution.unpackedItems.map((item) => <li key={item.id}>{item.name}<small>{item.id} · {item.dimensions.length} × {item.dimensions.width} × {item.dimensions.height} mm</small>{item.constraints?.requiresManualReview?.map((message, index) => <small key={index}>{message}</small>)}</li>)}</ul></details>}
          {selectedSolution.notes?.length ? <details className="review-details"><summary>算法说明</summary><ul>{selectedSolution.notes.map((message, index) => <li key={index}>{message}</li>)}</ul></details> : null}
          {currentContainer?.centerOfGravity && <><div className="panel-divider" /><h3 className="section-subtitle">当前柜重心</h3><div className="cog-grid">{(['x', 'y', 'z'] as const).map((axis) => <div key={axis}><span>{axis.toUpperCase()} / {axis === 'x' ? '长' : axis === 'y' ? '宽' : '高'}</span><strong>{number(currentContainer.centerOfGravity![axis])}</strong><small>mm</small></div>)}</div><p className="detail-note">橙色点标记重心。宽向偏移 {number(Math.abs(currentContainer.centerOfGravity.y - currentContainer.dimensions.width / 2))} mm。</p></>}
          <div className="panel-divider" /><h3 className="section-subtitle">交付文件</h3><div className="export-buttons"><button disabled={exporting} onClick={() => void exportAction('excel')}><Icon name="download" size={16} /> Excel 装柜清单</button><button disabled={exporting} onClick={() => void exportAction('json')}><Icon name="download" size={16} /> JSON 完整方案</button><button disabled={exporting} onClick={() => void exportAction('report')}><Icon name="download" size={16} /> 可打印报告 / PDF</button></div>
        </>}
        {totals.review > 0 && <p className="source-warning">源数据有 {number(totals.review)} 件货物包含待确认的约束，详见优化结果中的复核说明。</p>}
      </aside>
    </div>}
    {!new URLSearchParams(location.search).has('native') && <FloatingAssistant workspace={workspace} />}
  </div>
}
function Metric({ label, value, unit, note }: { label: string; value: string; unit: string; note: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{note}</p></div>
}
function SolutionCard({ solution, index, selected, onClick }: { solution: PackingSolution; index: number; selected: boolean; onClick: () => void }) {
  return <button className={`solution-card ${selected ? 'selected' : ''}`} onClick={onClick}><div className="solution-name"><span className="solution-index">{String(index + 1).padStart(2, '0')}</span><strong>{algorithmLabel(solution.algorithm)}</strong><span className="radio-dot" /></div><div className="solution-numbers"><span><strong>{solution.totalContainers}</strong> 柜</span><span><strong>{percent(solution.avgVolumeUtilization)}</strong> 体积率</span></div><Meter value={solution.avgVolumeUtilization} /><div className="solution-footer"><span>已装 {placedCount(solution)} 件</span><span className={solution.unpackedItems.length ? 'amber-text' : ''}>{solution.unpackedItems.length ? `${solution.unpackedItems.length} 件待处理` : '全部装入'}</span></div></button>
}
function TopView({ container, selectedId, onSelect }: { container: Container; selectedId: string | null; onSelect: (id: string) => void }) {
  const l = container.dimensions.length, w = container.dimensions.width
  return <div className="top-view"><svg viewBox={`-300 -350 ${l + 600} ${w + 800}`} role="img" aria-label="集装箱货物俯视图"><rect x="0" y="0" width={l} height={w} fill="#d4e0e1" stroke="#667e84" strokeWidth="20" />{[...container.items].sort((a, b) => a.position.z - b.position.z).map((placed) => <rect key={placed.item.id} x={placed.position.x} y={placed.position.y} width={placed.actualDimensions.length} height={placed.actualDimensions.width} fill={selectedId === placed.item.id ? '#f2cf6c' : placed.item.hasGlass ? '#d5a359' : '#699da7'} stroke={selectedId === placed.item.id ? '#98690d' : '#eaf1f2'} strokeWidth={selectedId === placed.item.id ? 24 : 9} onClick={() => onSelect(placed.item.id)} style={{ cursor: 'pointer' }}><title>{placed.item.name} · Z={placed.position.z} mm</title></rect>)}<text x={l / 2} y={w + 240} textAnchor="middle" fill="#60767c" fontSize="150">X · 内长 {number(l)} mm →</text><text x="0" y="-140" fill="#60767c" fontSize="130">Y · 内宽 {number(w)} mm</text>{container.centerOfGravity && <g><circle cx={container.centerOfGravity.x} cy={container.centerOfGravity.y} r={65} fill="#e68629" stroke="#fff" strokeWidth="15" /><title>重心投影</title></g>}</svg></div>
}
export default function AppEntry() {
  useEffect(()=>{if(new URLSearchParams(location.search).has('native'))document.body.classList.add('native-app')},[])
  const nativeMode=new URLSearchParams(location.search).get('native')
  return nativeMode==='cargo-editor'?<NativeCargoEditor />:nativeMode==='assistant-widget'?<NativeSupportWidget />:nativeMode==='port-dossier'?<NativePortDossier />:<App /> }
