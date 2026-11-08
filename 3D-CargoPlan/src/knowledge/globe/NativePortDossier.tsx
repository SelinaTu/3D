// #created 11/08/2026
import { useEffect, useState } from 'react'
import { loadGlobeData } from './data'
import { PortDetails } from './PortDetails'
import { type GlobeData } from './model'
import { useSupportContext } from '../../support/SupportAssistant'
import './globe.css'

/** The native RealityKit globe and web globe deliberately share this dossier. */
export function NativePortDossier() {
  const context=useSupportContext(),[data,setData]=useState<GlobeData|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  useEffect(()=>{let alive=true;setError('');loadGlobeData().then(value=>{if(alive)setData(value)}).catch(()=>{if(alive)setError('港口档案加载失败')});return()=>{alive=false}},[attempt])
  const port=data?.ports.find(p=>p.locode===context.portCode)
  return <main className="native-dossier port-atlas">{error?<div className="atlas-gap" role="alert">{error}<button onClick={()=>setAttempt(n=>n+1)}>重试</button></div>:port && data?<PortDetails key={port.locode} data={data} port={port} onClose={()=>{}} />:<p className="atlas-gap" role="status">{data?'从地球仪选择港口，查看同网页版一致的完整档案。':'正在读取港口档案…'}</p>}</main>
}
