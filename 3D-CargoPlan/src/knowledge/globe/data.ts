// #created 11/08/2026
import ports from '../../../globe/data/ports.json?url'
import countries from '../../../globe/data/countries.json?url'
import conventions from '../../../globe/data/conventions.json?url'
import meta from '../../../globe/data/meta.json?url'
import land from '../../../globe/data/land.json?url'
import reviews from '../../../globe/data/reviews.json?url'
import type { GlobeData,PortPack } from './model'
const packs=import.meta.glob('../../../globe/data/port_packs/*.json',{eager:true,import:'default'})
let pending:Promise<GlobeData>|undefined
export function loadGlobeData():Promise<GlobeData> {
  if(!pending)pending=Promise.all(Object.entries({ports,countries,conventions,meta,land,reviews}).map(async([key,url])=>{
    const response=await fetch(url)
    if(!response.ok)throw new Error(`知识数据读取失败：${key}（${response.status}）`)
    return [key,await response.json()]
  })).then(entries=>{
    const data={...Object.fromEntries(entries),packs:Object.fromEntries(Object.values(packs).map(p=>[(p as PortPack).port_id,p]))} as GlobeData
    if(data.ports.length!==data.meta.port_count || new Set(data.ports.map(p=>p.locode)).size!==data.ports.length)throw new Error('港点数据数量或 ID 校验失败')
    return data
  }).catch(error=>{pending=undefined;throw error})
  return pending
}
