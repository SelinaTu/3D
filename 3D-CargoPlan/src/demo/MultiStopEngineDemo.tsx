// #created 11/08/2026
import { lazy, Suspense, useMemo, useState } from 'react'
import { DEFAULT_CONFIG, optimize } from '../core/optimizer'
import type { CargoItem } from '../types/packing'

const Viewer = lazy(() => import('../components/ContainerViewer').then(module => ({ default: module.ContainerViewer })))
const stops = ['苏州配送点', '无锡配送点', '常州配送点', '南京配送点', '滁州配送点']
const goods: CargoItem[] = [
  ['机柜 A', 1, 1500, 800, 1000, 240], ['纸箱组 A', 1, 1200, 800, 800, 120],
  ['设备箱 B', 2, 1400, 900, 1000, 300], ['木箱 C', 3, 1600, 800, 1000, 260],
  ['纸箱组 C', 3, 1100, 800, 800, 100], ['设备箱 D', 4, 1800, 900, 1000, 350],
  ['配件箱 D', 4, 1000, 700, 800, 90], ['设备箱 E', 5, 2000, 900, 1000, 400],
].map(([name, stop, length, width, height, weight], index) => ({
  id: `example-${index + 1}`, name: String(name), category: '包装箱', unloadStop: Number(stop),
  dimensions: { length: Number(length), width: Number(width), height: Number(height) }, weight: Number(weight), quantity: 1,
  allowedOrientations: ['standing'], canStackOnTop: false, canOffsetStack: false, hasGlass: false, colorTag: 'blue', rawData: {},
}))

/** A small synthetic scenario that runs the production geometry and validation path. */
export function MultiStopEngineDemo() {
  const [door, setDoor] = useState<'x-min' | 'x-max'>('x-min')
  const [selected, setSelected] = useState<string | null>(null)
  const solution = useMemo(() => optimize(goods, { ...DEFAULT_CONFIG, containerDimensions: { length: 9600, width: 2400, height: 2400 }, containerMaxWeight: 12000, algorithm: 'greedy', unloadingDoor: door, timeLimit: 3000 }), [door])
  const container = solution.containers[0]
  return <details className="demo-card" style={{ margin: '16px 0' }}>
    <summary><strong>真实求解器演示：五站卸货与 3D 摆放</strong> · 点击展开</summary>
    <p>模拟数据：起点一次装车，按五个站点依次卸货。使用共用求解器及独立校验，暂不模拟途中取货或实际设备作业。</p>
    <div className="mode-switch">
      <button className={door === 'x-min' ? 'active' : ''} onClick={() => setDoor('x-min')}>车门在 X 最小端</button>
      <button className={door === 'x-max' ? 'active' : ''} onClick={() => setDoor('x-max')}>车门在 X 最大端</button>
    </div>
    <div className="metric-row" style={{ padding: '12px 0' }}>
      <span><b>{solution.totalContainers}</b>辆</span><span><b>{solution.totalItems - solution.unpackedItems.length}</b>件已装</span>
      <span><b>{solution.unpackedItems.length}</b>件未装</span><span><b>{solution.unloadAnalysis?.blockerPairCount ?? 0}</b>组潜在阻挡</span>
      <span><b>{solution.validation?.valid ? '通过' : '失败'}</b>几何校验</span>
    </div>
    {container && <><div className="viewer-stage demo-view"><Suspense fallback={<div className="viewer-fallback">正在打开 3D…</div>}><Viewer container={container} selectedId={selected} onSelect={setSelected} /></Suspense></div>
      <p>当前显示第 1 辆 / 共 {solution.totalContainers} 辆。阻挡是货物对的几何风险信号，不是实际倒货次数；装卸作业仍需现场确认。</p>
      <div className="table-scroll"><table><thead><tr><th>货物</th><th>卸货站</th><th>X / Y / Z（mm）</th><th>潜在阻挡</th></tr></thead><tbody>
        {container.items.map(placed => <tr key={placed.item.id} className={selected === placed.item.id ? 'selected' : ''} onClick={() => setSelected(placed.item.id)}><td>{placed.item.name}</td><td>{stops[(placed.item.unloadStop ?? 1) - 1]}</td><td>{placed.position.x} / {placed.position.y} / {placed.position.z}</td><td>{solution.unloadAnalysis?.blockers.filter(row => row.itemId === placed.item.id).length ?? 0}</td></tr>)}
      </tbody></table></div></>}
    {!!solution.unpackedItems.length && <p className="warn">未装载：{solution.unpackedItems.map(item => item.name).join('、')}</p>}
  </details>
}
