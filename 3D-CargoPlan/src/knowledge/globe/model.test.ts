// #created 11/08/2026
import { describe,it,expect } from 'vitest'
import ports from '../../../globe/data/ports.json'
import countries from '../../../globe/data/countries.json'
import meta from '../../../globe/data/meta.json'
import land from '../../../globe/data/land.json'
import conventions from '../../../globe/data/conventions.json'
import reviews from '../../../globe/data/reviews.json'
import { countryName,geoVector,packStatus,safeSource,searchPorts,uniqueFees,type GlobeData,type PortPack } from './model'
const rawPacks=import.meta.glob('../../../globe/data/port_packs/*.json',{eager:true,import:'default'})
const packs:Record<string,PortPack>=Object.fromEntries(Object.values(rawPacks).map(p=>{const pack=p as PortPack;return [pack.port_id,pack]}))
const data={ports,countries,meta,land,conventions,reviews,packs} as GlobeData
describe('港口知识数据与查询',()=>{
  it('11835 港点无重复，坐标有效，知识包均指向真实港点及对应国别',()=>{
    expect(ports).toHaveLength(meta.port_count);expect(new Set(ports.map(p=>p.locode)).size).toBe(ports.length)
    expect(ports.every(p=>p.lat>=-90&&p.lat<=90&&p.lon>=-180&&p.lon<=180)).toBe(true)
    expect(Object.keys(packs)).toHaveLength(22);expect(Object.keys(countries)).toHaveLength(9)
    for(const [id,p]of Object.entries(packs)){expect(ports.find(port=>port.locode===id)?.country).toBe(p.country);expect(data.countries[p.country]).toBeDefined()}
    expect(ports.filter(p=>p.depth==='deep').map(p=>p.locode).sort()).toEqual(Object.keys(packs).sort())
  })
  it('按代码、中文港名、英文港名、中文国名查询并优先精确匹配',()=>{
    expect(searchPorts(data,'cnsha')[0].locode).toBe('CNSHA')
    expect(searchPorts(data,'上海')[0].locode).toBe('CNSHA')
    expect(searchPorts(data,'Tanjung Priok')[0].locode).toBe('IDTPP')
    expect(searchPorts(data,'印度尼西亚').every(p=>p.country==='ID')).toBe(true)
    expect(searchPorts(data,'法国').length).toBeGreaterThan(0)
    expect(countryName('FR',data.countries)).toBe('法国')
    expect(searchPorts(data,'不存在的港口xyz')).toEqual([])
  })
  it('国家和知识包筛选作用于同一组地图及列表数据，骨架不能冒充完整档案',()=>{
    expect(searchPorts(data,'','',true)).toHaveLength(22)
    expect(searchPorts(data,'','CN',true)).toHaveLength(8)
    expect(searchPorts(data,'','ID',true)).toHaveLength(5)
    expect(packStatus(data.packs.IDMAK)).toContain('待完善')
    expect(packStatus()).toBe('仅基础坐标')
  })
  it('承运人费用按承运人和编号去重，不与处罚条目混合',()=>{
    const fees=uniqueFees(data.packs.IDTPP,data.countries.ID)
    expect(fees).toHaveLength(1);expect(fees[0].amount_usd).toBe(300)
    expect(uniqueFees(data.packs.CNSHA,data.countries.CN)).toEqual([])
    expect(data.reviews['ID-WDF-MAERSK'].conditions_zh).toHaveLength(3)
  })
  it('只将 HTTP/HTTPS 来源变成外部链接，本地分册和危险协议不变成可点击地址',()=>{
    expect(safeSource('javascript:alert(1)')).toBeUndefined();expect(safeSource('data:text/html,hi')).toBeUndefined()
    expect(safeSource('docs/port-knowledge/02_china_national.md')).toBeUndefined()
    expect(safeSource('https://www.imo.org/en/')).toBe('https://www.imo.org/en/')
  })
})
describe('地理底图与港点使用同一坐标',()=>{
  it('赤道、本初子午线、东经90度与北极符合球体UV坐标约定',()=>{
    expect(geoVector(0,0)).toEqual([1,0,-0])
    expect(geoVector(0,90)[2]).toBeCloseTo(-1)
    expect(geoVector(90,0)[1]).toBeCloseTo(1)
    for(const p of [ports[0],ports[ports.length-1]])expect(Math.hypot(...geoVector(p.lat,p.lon))).toBeCloseTo(1)
  })
  it('离线海陆轮廓非空且经纬度有效',()=>{
    expect(land.rings.length).toBeGreaterThan(100)
    expect(land.rings.every(r=>r.length>=4&&r.every(([lon,lat])=>lon>=-180&&lon<=180&&lat>=-90&&lat<=90))).toBe(true)
  })
})
