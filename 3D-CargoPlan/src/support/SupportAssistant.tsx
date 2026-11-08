// #created 11/08/2026
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { answerSupportQuestion, type SupportAnswer, type SupportContext } from './knowledge'
import { safeSource } from '../knowledge/globe/model'
import './support.css'
import { searchEvidence, type EvidenceResponse } from './evidence'

declare global {interface Window {cargoPlanSupportContext?: SupportContext}}
type Message = {id:number;question: string; answer: SupportAnswer; evidence?:EvidenceResponse; evidenceError?:boolean;evidenceLoading?:boolean}
const names: Record<string,string> = {ports:'海运知识库'}
export function useSupportContext(workspace?: string): SupportContext {
  const [context,setContext]=useState<SupportContext>(()=>window.cargoPlanSupportContext ?? {})
  useEffect(()=>{
    const native=()=>setContext(window.cargoPlanSupportContext ?? {})
    const selected=(event: Event)=>setContext(old=>({...old,portCode:(event as CustomEvent<SupportContext>).detail.portCode}))
    window.addEventListener('cargoplan-support-context',native)
    window.addEventListener('cargoplan-port-selected',selected)
    return()=>{window.removeEventListener('cargoplan-support-context',native);window.removeEventListener('cargoplan-port-selected',selected)}
  },[])
  return {...context,workspace:workspace ?? context.workspace}
}
export function SupportChat({context={},onClose,title='3D CargoPlan 助手'}:{context?:SupportContext;onClose?:()=>void;title?:string}) {
  const [question,setQuestion]=useState(''),[messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const sequence=useRef(0),body=useRef<HTMLDivElement>(null)
  const example=context.portCode ? [`${context.portCode} 的限行与地区差异？`,`${context.portCode} 公路超限处罚怎么核查？`,'没有 VGM 能装船吗？'] : ['没有 VGM 能装船吗？','港口免费期如何核查？','如何核对当地限重规定？']
  useEffect(()=>{const latest=body.current?.querySelector<HTMLElement>('.support-exchange:last-child');body.current?.scrollTo({top:latest?.offsetTop ?? 0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})},[messages])
  useEffect(()=>()=>{sequence.current++},[])
  async function ask(q: string) {
    q=q.trim();if(!q || busy)return
    const ticket=++sequence.current;setBusy(true);setError('');setQuestion(q)
    try {
      const answer=await answerSupportQuestion(q,context)
      if(sequence.current===ticket){
        const needsEvidence=!answer.scope.startsWith('产品操作说明')
        setMessages(old=>[...old,{id:ticket,question:q,answer,evidenceLoading:needsEvidence}].slice(-30));setQuestion('')
        // Show the local answer immediately; optional document lookup must not
        // hold the entire conversation behind the external service timeout.
        if(needsEvidence)void searchEvidence(q).then(evidence=>setMessages(old=>old.map(m=>m.id===ticket?{...m,evidence,evidenceLoading:false}:m))).catch(()=>setMessages(old=>old.map(m=>m.id===ticket?{...m,evidenceError:true,evidenceLoading:false}:m)))
      }
    }
    catch {if(sequence.current===ticket)setError('本地知识暂时读取失败。请重试；问题不会发送到外部服务。')}
    finally {if(sequence.current===ticket)setBusy(false)}
  }
  function submit(event: FormEvent){event.preventDefault();void ask(question)}
  return <section className="support-chat shipping-chat" aria-label="问答助手">
    <header className="support-header"><span className="support-avatar" aria-hidden="true">✦</span><div><h2>{title}</h2><small>本地知识问答 · 来源可查</small></div><button title="清空对话" aria-label="清空对话" disabled={busy || !messages.length} onClick={()=>setMessages([])}>↺</button>{onClose && <button aria-label="收起助手" onClick={onClose}>×</button>}</header>
    <div className="support-context">{names[context.workspace ?? ''] ?? '3D CargoPlan'}{context.portCode && <> · 当前港口 {context.portCode}</>}<span>操作帮助 / 地区政策 / 航运实务</span></div>
    <div className="support-conversation" ref={body} role="log" aria-live="polite" aria-relevant="additions text">
      {!messages.length && <div className="support-welcome"><span>✦</span><h3>把问题留在当前工作区</h3><p>可问操作方法、地区限制和处罚依据。只使用已收录资料；未接入生成式模型，不替你改数据或执行计算。</p></div>}
      {messages.map((message,i)=><div className="support-exchange" key={i}><p className="support-user">{message.question}</p><article className="chat-answer support-answer"><small>{message.answer.scope}</small><h4>{message.answer.title}</h4><p>{message.answer.text}</p>{message.answer.sources.length>0 && <details className="support-sources"><summary>参考来源 · {message.answer.sources.length}</summary>{message.answer.sources.map(s=>{const url=safeSource(s.url);return url ? <a key={url} href={url} target="_blank" rel="noreferrer">{s.title} ↗</a> : null})}</details>}{message.evidenceError && <p className="support-evidence-status">{'\u539f\u6587\u68c0\u7d22\u6682\u4e0d\u53ef\u7528\uff1b\u4ee5\u4e0a\u4e3a\u5df2\u6536\u5f55\u7684\u79bb\u7ebf\u8d44\u6599\u3002'}</p>}{message.evidenceLoading && <p className="support-evidence-status">{'\u6b63\u5728\u8865\u5145\u672c\u5730\u539f\u6587\u4f9d\u636e\u2026'}</p>}{message.evidence && message.evidence.results.length>0 && <details className="support-sources"><summary>本地原文检索 · {message.evidence.results.length} 条候选</summary><p>以下是检索线索，具体港口、时间和适用条件须核对；不自动裁决。</p>{message.evidence.notes_zh.map(n=><p key={n}>{n}</p>)}{message.evidence.results.map((hit,i)=>{const url=hit.url && safeSource(hit.url);return <div className="support-evidence" key={`${hit.source_id}-${i}`}><b>{hit.source_title || '原始资料'}</b><small>{hit.knowledge_layer_label || '来源待复核'} · {hit.page ? `第 ${hit.page} 页` : '网页 / 页码未提供'} · {hit.source_id}</small><p>{hit.scope_note_zh || hit.review_status || '适用性与现行状态待复核'}</p>{url && <a href={url} target="_blank" rel="noreferrer">查看来源 ↗</a>}</div>})}</details>}</article></div>)}
      {busy && <p className="support-status" role="status">正在检索已收录资料…</p>}{error && <p className="support-error" role="alert">{error}</p>}
    </div>
    <div className="chat-suggestions support-suggestions">{example.map(q=><button key={q} disabled={busy} onClick={()=>void ask(q)}>{q}</button>)}</div>
    <form onSubmit={submit} className="support-compose"><label className="support-sr" htmlFor="shipping-question">输入问题</label><input id="shipping-question" aria-label="输入助手问题" maxLength={1200} value={question} disabled={busy} onChange={e=>setQuestion(e.target.value)} placeholder="描述问题，或写下具体港口…" /><button type="submit" disabled={busy || !question.trim()} aria-label="发送问题">↑</button></form>
  </section>
}
export function FloatingAssistant({workspace}:{workspace:string}) {
  const context=useSupportContext(workspace),[open,setOpen]=useState(false)
  useEffect(()=>{const show=()=>setOpen(true);window.addEventListener('cargoplan-support-open',show);return()=>window.removeEventListener('cargoplan-support-open',show)},[])
  return <div className="support-floating" hidden={workspace!=='ports'}>
    <div className="support-floating-panel" hidden={!open}><SupportChat context={context} onClose={()=>setOpen(false)} /></div>
    <button className="support-launcher" aria-label={open?'收起 3D CargoPlan 助手':'打开 3D CargoPlan 助手'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span aria-hidden="true">{open?'×':'✦'}</span>{open?'收起':'3D CargoPlan 助手'}</button>
  </div>
}
export function NativeSupportWidget() {
  const context=useSupportContext()
  return <main className="support-native"><SupportChat context={context} onClose={()=>window.webkit?.messageHandlers?.cargoPlan?.postMessage({type:'assistant-close'})} /></main>
}
