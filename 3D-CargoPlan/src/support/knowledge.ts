// #created 11/08/2026
import { loadGlobeData } from '../knowledge/globe/data'
import { countryName, safeSource, type GlobeData, type Port } from '../knowledge/globe/model'
import { policiesFor, type RegionalPolicy } from '../knowledge/globe/regional'
import { queryNamesPort, searchShippingCards } from './shipping'

const rawTopics = import.meta.glob('../../globe/data/topics/T*.json', {eager: true, import: 'default'})
type Topic = {id: string; title_zh: string; faq: {q: string; a: string}[]; official_sources: {url: string; org: string}[]}
const topics = Object.values(rawTopics) as Topic[]
export type SupportContext = {workspace?: string; portCode?: string}
export type SupportAnswer = {title: string; text: string; scope: string; sources: {url: string; title: string}[]; topicId?: string; missing?: boolean}
const aliases: Record<string, string[]> = {
  T01:['滞箱','滞期','堆存','免箱','免费期','demurrage','detention','free time'], T02:['vgm','核实总质量','验证总重'],
  T03:['超重','限重','超载','轴载','重量','odol'], T04:['甩柜','空班','跳港','rolled','blank sailing'],
  T05:['运价','费率','红海','运费'], T06:['查验','海关','扣留','hold'], T07:['木箱','托盘','木包装','垫木','ispm'],
  T08:['wdf','倒柜','附加费','重量不符'], T09:['错报','瞒报','运输指示'], T10:['弃货','无人提货','回追'],
  T11:['印尼','zero odol'], T12:['班列','偏载','铁路']
}
const help = [
  {words:['excel','导入','上传'], title:'导入货物清单', text:'在装配工作区使用“导入 Excel”选择 .xlsx / .xls；网页工作台也提供导入模板。导入后先核对尺寸单位、数量与约束提示，再主动重新计算。原始备注不能用猜测补成允许旋转或承重上限。'},
  {words:['方向','承重','层数','朝向'], title:'编辑尺寸以外的装载条件', text:'选中货物，进入“完整参数”编辑可用方向、堆叠与承重等约束。批量应用前确认是同规格货物。保存修改不会自动求解；发生冲突的货物进入待装区，再由“重新计算”生成新方案。约束缺失时需要确认，不能默认无限承重。'},
  {words:['重新计算','重算','待装','撤销','删除'], title:'修改后主动重新计算', text:'修改货物或货舱参数后，先检查待装区，再点击顶部“重新计算”。尺寸越界的货物会暂存，不会为凑装载率被静默删除。计算可取消；手工调整货舱尺寸后可使用“撤销调整”。'},
  {words:['多站','站点','装卸顺序','受阻未卸','前站未装'], title:'多站点需要任务和可执行的装卸条件', text:'在多站点工作区选择车型与作业方式，手动建立站点、本站卸货和新增货物及目的站，再主动计算。结果区可逐步播放卸货、临时搬出、回装与取货。后门、侧门与顶部吊装条件不同；人工作业还检查通道与可达性。受阻是求解诊断，不能把未卸货标成完成。'},
  {words:['拖拽','拖动','货舱','箱体'], title:'原生 3D 调整货物与货舱', text:'原生装配支持选择和拖动货物；冲突的放置会进入待装区。货舱可输入内长、内宽、内高，或开启 3D 尺寸手柄再拖动调整。修改后由你主动重新计算。输入的是有效内尺寸，不是车辆外廓尺寸。'}
]
const norm = (s: string) => s.toLowerCase().trim()
function missing(text: string): SupportAnswer {return {title:'还缺少适用信息', text, scope:'未作适用判断', sources:[], missing:true}}
function explicitScope(query: string, data: GlobeData): {port?: Port; country?: string} {
  const q = norm(query)
  const port = data.ports.find(p => q.includes(p.locode.toLowerCase())) ?? data.ports.find(p => (p.name_zh && q.includes(p.name_zh)) || (p.name.length >= 5 && q.includes(p.name.toLowerCase())))
  if (port) return {port, country:port.country}
  const zh=new Intl.DisplayNames(['zh-CN'],{type:'region'}),en=new Intl.DisplayNames(['en'],{type:'region'})
  const country = [...new Set(data.ports.map(p=>p.country))].find(code=>[data.countries[code]?.name_zh,data.countries[code]?.name,zh.of(code),en.of(code),code==='ID'?'印尼':''].some(n=>n && q.includes(n.toLowerCase())))
  return {country}
}
function ruleAnswer(rules: RegionalPolicy[], scope: string): SupportAnswer {
  return {title:'已收录的地区作业依据', scope, text:rules.map(r => `${r.title}\n${r.summary}\n${r.conditions.join('\n')}\n作业前：${r.action}\n${r.consequence}\n生效 / 版本：${r.effective}；核对：${r.checked_at}`).join('\n\n'), sources:[...new Map(rules.flatMap(r=>r.sources).map(s=>[s.url,s])).values()]}
}
export async function answerSupportQuestion(query: string, context: SupportContext = {}, suppliedData?: GlobeData): Promise<SupportAnswer> {
  const q = norm(query)
  if (!q) return missing('请输入你需要解决的问题。')
  const product = help.find(h => h.words.some(w => q.includes(w)))
  if (product) return {title:product.title, text:product.text, scope:'产品操作说明 · 当前版本', sources:[]}
  const regionalIntent = /限行|通行|排放|国四|国六|新能源|罚款|处罚|罚金|超限|超载|公路|限重|限载|轴载|地区|当地|本地|差异|不同|接驳/.test(q) && !/wdf|demurrage|detention|滞箱/.test(q)
  if (regionalIntent) {
    const data = suppliedData ?? await loadGlobeData(), explicit = explicitScope(q,data)
    // A named country overrides the current port, so an Indonesia question cannot inherit China rules.
    const port = explicit.port ?? (!explicit.country ? data.ports.find(p=>p.locode===context.portCode) : undefined)
    const code = explicit.country ?? port?.country
    if (!code) return missing('请补充国家或港口；限重与处罚还需要车辆轴型、实际车货总重、货类和接驳道路。可先在知识地球仪选择港口。')
    if (/危货|危险品|海关|木质|木包装|vgm|申报/.test(q) && /罚|处罚/.test(q)) return missing('当前未收录这一地区与该违法类型对应的已核对罚则，不能用公路超限罚款替代。请补充港口、货类和主管机关要求。')
    let rules = policiesFor(port ?? {locode:'',country:code})
    if (/罚|处罚/.test(q)) rules=rules.filter(r=>/限行|排放|国四|国六/.test(q) ? r.category==='access' : r.category==='penalty')
    else if (/限行|通行|排放|国四|国六/.test(q)) rules=rules.filter(r=>r.category==='access')
    else if (/限重|轴载|公路|总重/.test(q)) rules=rules.filter(r=>r.category==='road' || r.category==='penalty')
    else rules=rules.filter(r=>r.ports.length || r.keywords.some(w=>q.includes(w.toLowerCase())))
    if (!rules.length) return missing(`${port?.name_zh ?? port?.name ?? countryName(code,data.countries)}尚缺这类地区专属资料。已有通用主题不等于本地已核实规定，请向当地主管机关、码头或承运人确认。`)
    return ruleAnswer(rules, `${port ? `${port.name_zh ?? port.name} · ` : ''}${countryName(code,data.countries)}${rules.every(r=>!r.ports.length)?'国家规则，非港口专属':''} · 条件参考，不自动出罚单`)
  }
  const scored = topics.flatMap(pack=>pack.faq.map(faq=>{
    const target=norm(faq.q+' '+pack.title_zh)
    let score=0
    for(const word of aliases[pack.id.slice(0,3)] ?? []) if(q.includes(word)) score+=target.includes(word)?8:3
    for(let i=0;i<q.length-1;i++){const pair=q.slice(i,i+2);if(!/[\s？?，,。=]/.test(pair) && target.includes(pair))score++}
    return {pack,faq,score}
  })).sort((a,b)=>b.score-a.score)
  const best=scored[0]
  const topicAnswer = best && best.score >= 3 ? {title:best.pack.title_zh, text:best.faq.a, scope:'通用实务问答 · 具体适用性须核对', sources:best.pack.official_sources.filter(s=>safeSource(s.url)).slice(0,3).map(s=>({url:s.url,title:s.org})), topicId:best.pack.id} : undefined
  const shipping = searchShippingCards(q, context.portCode)
  if (shipping && queryNamesPort(q)) return shipping
  if (topicAnswer && best && best.score >= 8) return topicAnswer
  if (shipping) return shipping
  if(!best || best.score<3) return missing('暂未找到足够相关的已收录问答。可以询问装配操作、港口作业、VGM、滞箱费用，或补充具体港口与问题。')
  return {title:best.pack.title_zh, text:best.faq.a, scope:'通用实务问答 · 具体适用性须核对', sources:best.pack.official_sources.filter(s=>safeSource(s.url)).slice(0,3).map(s=>({url:s.url,title:s.org})), topicId:best.pack.id}
}
