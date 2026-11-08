// #created 11/08/2026
import { useState } from 'react'
import type { CargoItem, Dimensions3D, Position3D } from '../types/packing'
import { validateFrame } from './studio-cargo'
import { CargoConstraints } from './CargoConstraints'

export function FrameEditor({ item, count, onCancel, onSave }: { item: CargoItem; count: number; onCancel: () => void; onSave: (item: CargoItem) => void }) {
  const [draft, setDraft] = useState(() => structuredClone(item))
  const [error, setError] = useState('')
  const dimensions = (target: 'outer' | 'cavity', key: keyof Dimensions3D, value: number) => setDraft(old => target === 'outer' ? { ...old, dimensions: { ...old.dimensions, [key]: value } } : { ...old, cavity: { ...old.cavity!, dimensions: { ...old.cavity!.dimensions, [key]: value } } })
  const offset = (key: keyof Position3D, value: number) => setDraft(old => ({ ...old, cavity: { ...old.cavity!, offset: { ...old.cavity!.offset, [key]: value } } }))
  const save = () => { try { if (!Object.values(draft.dimensions).every(n=>Number.isFinite(n) && n>0) || !Number.isFinite(draft.weight) || draft.weight<0) throw new Error('尺寸必须大于 0，重量不得为负数'); if (draft.cavity) validateFrame(draft); onSave(draft) } catch (e) { setError(e instanceof Error ? e.message : '框体尺寸无效') } }
  return <div className="studio-modal-backdrop"><section className="studio-modal" role="dialog" aria-modal="true" aria-label="编辑货物完整参数"><div className="studio-editor-head"><strong>编辑货物完整参数 · {item.name}</strong><button onClick={onCancel} aria-label="关闭框体编辑">×</button></div><p>应用于同源 {count} 件。保存后只检查原位置；主动点击重新计算才会优化装载。</p>
    <h3>外包尺寸 mm</h3><div className="studio-frame-grid">{(['length','width','height'] as const).map((key,i) => <label key={key}>{['长','宽','高'][i]}<input aria-label={`框体外包${['长','宽','高'][i]}`} type="number" min="1" value={draft.dimensions[key]} onChange={e => dimensions('outer',key,Number(e.target.value))} /></label>)}</div>
    <div className="studio-fieldgrid"><label><span>单件重量 kg</span><input aria-label="编辑单件重量" type="number" min="0" value={draft.weight} onChange={e=>setDraft(old=>({...old,weight:Number(e.target.value)}))} /></label></div>
    <CargoConstraints item={draft} onChange={patch=>setDraft(old=>({...old,...patch}))} />
    {draft.cavity && <><p>空腔使用旋转前原始轴；至少一轴完整贯通，必须保留框壁。</p><h3>空腔尺寸 mm</h3><div className="studio-frame-grid">{(['length','width','height'] as const).map((key,i) => <label key={key}>{['长','宽','高'][i]}<input aria-label={`框体空腔${['长','宽','高'][i]}`} type="number" min="1" value={draft.cavity!.dimensions[key]} onChange={e => dimensions('cavity',key,Number(e.target.value))} /></label>)}</div>
    <h3>空腔起点偏移 mm</h3><div className="studio-frame-grid">{(['x','y','z'] as const).map(key => <label key={key}>{key.toUpperCase()}<input aria-label={`框体空腔偏移${key.toUpperCase()}`} type="number" min="0" value={draft.cavity!.offset[key]} onChange={e => offset(key,Number(e.target.value))} /></label>)}</div>
    <p>原 PDF 对 W02 的高度例外只匹配原始规格；修改后不自动延用该例外。</p></>}{error && <div className="studio-alert">{error}</div>}<div className="studio-actions"><button onClick={onCancel}>取消</button><button className="studio-primary" onClick={save}>保存更改</button></div></section></div>
}
