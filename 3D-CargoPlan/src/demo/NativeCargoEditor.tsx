// #created 11/08/2026
import { useEffect,useState } from 'react'
import { FrameEditor } from './FrameEditor'
import type { CargoItem } from '../types/packing'
declare global {interface Window {
 cargoPlanCargoEditor?:{item:CargoItem;count:number}
 webkit?:{messageHandlers?:{cargoPlan?:{postMessage:(value:unknown)=>void}}}
}}
export function NativeCargoEditor() {
 const [context,setContext]=useState(()=>window.cargoPlanCargoEditor),[batch,setBatch]=useState(true)
 useEffect(()=>{const receive=()=>setContext(window.cargoPlanCargoEditor);window.addEventListener('cargoplan-cargo-editor',receive);receive();return()=>window.removeEventListener('cargoplan-cargo-editor',receive)},[])
 const send=(value:unknown)=>window.webkit?.messageHandlers?.cargoPlan?.postMessage(JSON.parse(JSON.stringify(value)))
 return <main className="studio native-cargo-editor">{context?<><label className="native-batch-toggle"><input aria-label="应用到同源批次" type="checkbox" checked={batch} onChange={e=>setBatch(e.target.checked)}/>应用到同源批次（{context.count} 件）；取消勾选则只修改选中件。</label><FrameEditor item={context.item} count={batch?context.count:1} onCancel={()=>send({type:'cancelEditor'})} onSave={item=>send({type:'saveCargo',item,batch})}/></>:<p>正在读取选中货物…</p>}</main>
}
