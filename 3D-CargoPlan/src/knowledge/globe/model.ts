// #created 11/08/2026
export type Source=string|{url:string;title?:string;retrieved?:string;layer?:string}
export type Port={locode:string;name:string;name_zh?:string;lat:number;lon:number;country:string;depth:'thin'|'deep';functions:string}
export type Check={id:string;title?:string;detail?:string;severity?:string;topic?:string;sources?:Source[];evidence_refs?:{source_id:string;sha256:string;page:number|null;locator:string;status:string}[]}
export type Fine={id:string;currency?:string;cap?:number;formula_note?:string;sources?:Source[]}
export type Fee={id:string;carrier?:string;amount_usd?:number;per?:string;type?:string;note?:string;sources?:Source[]}
export type Vgm={required_for_load?:boolean;tolerance_note?:string;statute?:string;via?:string;note?:string;sources?:Source[]}
export type Country={iso2:string;name:string;name_zh?:string;depth:'thick'|'skeleton';as_of:string;confidence:string;vgm?:Vgm;road_limits?:{statute?:string;note?:string;jbi_note?:string;table_kg?:Record<string,number>;mst_t?:Record<string,number>;sources?:Source[]};fine_refs?:Fine[];carrier_fees_examples?:Fee[];checklists?:Check[];notes?:string[];sources?:Source[]}
export type PortPack={port_id:string;port_name:string;port_name_zh?:string;country:string;confidence:string;as_of:string;dossier_depth?:string;vgm?:Vgm;checklists?:Check[];fine_refs?:Fine[];commercial_cost_hints?:Fee[];notes?:string[];sources?:Source[];knowledge_paths?:string[];stuffing_ban_machine_readable?:boolean}
export type Convention={id:string;title:string;title_zh?:string;summary:string;summary_zh?:string;effective?:string;sources:Source[]}
export type Review={checked_at:string;source:string;summary_zh:string;conditions_zh?:string[];effective?:string;status:'source_checked';title?:string;ports?:string[];countries?:string[];layer?:'country'|'port'|'fees';kind?:string}
export type GlobeData={ports:Port[];countries:Record<string,Country>;packs:Record<string,PortPack>;conventions:{as_of:string;items:Convention[]};meta:{as_of:string;port_count:number;deep_port_count:number;unlocode_source:string;unlocode_note:string;gaps:string[]};land:{rings:number[][][];source:string;url:string};reviews:Record<string,Review>}

export function safeSource(url:string):string|undefined {
  try{const parsed=new URL(url);if(['https:','http:'].includes(parsed.protocol))return parsed.href}catch{/* Local knowledge paths are references, never external links. */}
  return undefined
}
export function countryName(code:string,countries:Record<string,Country>,language='zh-CN'):string {
  if(countries[code]?.name_zh)return countries[code].name_zh!
  try{return new Intl.DisplayNames([language],{type:'region'}).of(code) ?? code}catch{return code}
}
const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim()
export function searchPorts(data:GlobeData,query:string,country='',packsOnly=false):Port[] {
  const q=normalize(query),names=new Map<string,string>()
  const scored=data.ports.flatMap(p=>{
    if(country && p.country!==country || packsOnly && !data.packs[p.locode])return []
    if(!names.has(p.country))names.set(p.country,normalize(`${countryName(p.country,data.countries)} ${data.countries[p.country]?.name ?? ''} ${p.country}`))
    const code=normalize(p.locode),name=normalize(`${p.name} ${p.name_zh ?? ''}`)
    const score=!q?0:code===q?100:code.startsWith(q)?80:name.includes(q)?60:names.get(p.country)!.includes(q)?30:-1
    return score<0?[]:[{p,score:score+(data.packs[p.locode]?5:0)}]
  })
  return scored.sort((a,b)=>b.score-a.score || a.p.locode.localeCompare(b.p.locode)).map(r=>r.p)
}
/** Matches Three.js SphereGeometry UVs with an equirectangular lon=-180…180 texture. */
export function geoVector(lat:number,lon:number,radius=1):[number,number,number] {
  const phi=lat*Math.PI/180,theta=lon*Math.PI/180
  return [radius*Math.cos(phi)*Math.cos(theta),radius*Math.sin(phi),-radius*Math.cos(phi)*Math.sin(theta)]
}
export function uniqueFees(pack?:PortPack,country?:Country):Fee[] {
  return [...new Map([...(pack?.commercial_cost_hints ?? []),...(country?.carrier_fees_examples ?? [])].map(f=>[`${f.carrier}:${f.id}`,f])).values()]
}
export function packStatus(pack?:PortPack):string {
  if(!pack)return '仅基础坐标'
  if(['thin','stub'].includes(pack.dossier_depth ?? '') || (pack.checklists?.length ?? 0)<3)return '已建包 · 待完善'
  return '已有作业资料'
}
