# -*- coding: utf-8 -*-
#created 11/08/2026
"""Build CargoPlan's offline review from the canonical plan and research."""
from pathlib import Path
import hashlib, html, json, re
import markdown
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
md=(ROOT/'docs/CARGOPLAN_PRODUCT_PLAN.md').read_text()
research=(ROOT/'docs/FREIGHT_FOUNDATIONS_AND_TOOL_RESEARCH.md').read_text()

def render(text, prefix):
    soup=BeautifulSoup(markdown.markdown(text,extensions=['tables','fenced_code','sane_lists']),'html.parser')
    chapters=[]
    for node in list(soup.children):
        if getattr(node,'name',None)=='h2':
            sid=f'{prefix}-{len(chapters)+1:02d}';node['id']=sid
            chapters.append({'id':sid,'title':node.get_text(),'body':str(node)})
        elif chapters: chapters[-1]['body']+=str(node)
    body=BeautifulSoup(''.join('<section class="chapter">'+c['body']+'</section>' for c in chapters),'html.parser')
    for a in body.select('a[href]'):
        h=a['href']
        if not h.startswith(('http','/','#','mailto:')): a['href']='../../docs/'+h
        if h.startswith('http'):a['target']='_blank';a['rel']='noopener noreferrer'
    for table in body.find_all('table'):
        table.wrap(body.new_tag('div',attrs={'class':'table-wrap','tabindex':'0'}))
    return body, chapters
article,chapters=render(md,'p');references,rchapters=render(research,'r')
features=[];decisions=[]
for row in article.select('tr'):
    cells=[c.get_text(' ',strip=True) for c in row.find_all('td',recursive=False)]
    if cells and re.fullmatch(r'F\d{2}',cells[0]):
        if len(cells)!=6:raise ValueError('Feature table requires six columns: '+cells[0])
        features.append(dict(zip(['id','name','layer','output','value','advice'],cells)))
    if cells and re.fullmatch(r'D\d{2}',cells[0]):
        if len(cells)!=5:raise ValueError('Decision table requires five columns: '+cells[0])
        decisions.append(dict(zip(['id','name','tradeoff','advice','impact'],cells)))
assert len({f['id'] for f in features})==len(features)
OPTIONS={
'D01':['已确认：站点自定义，Demo 4～5站'],
'D02':['已确认：车型及集装箱自定义'],
'D03':['已确认：建立异构货物分类'],
'D04':['已确认：少车少柜优先，其次省装卸'],
'D05':['已确认：支持主流模式，Demo选一种'],
'D06':['已确认：加固需求字段与提醒'],
'D07':['已确认：调研接口及官方来源，接入待验证'],
'D08':['已确认：有序人工单与机器人友好协议'],
'D09':['已确认：Excel与站点输入，一期不做路线规划'],
'D10':['已确认：可编辑3D工作台']}
for d in decisions:d['options']=OPTIONS[d['id']]
e=html.escape
feature_rows=''.join(f'<tr data-feature="{f["id"]}"><td>{f["id"]}</td><td><b>{e(f["name"])}</b></td><td>{e(f["layer"])}</td><td>{e(f["output"])}<small>{e(f["value"])}</small></td><td>{e(f["advice"])}</td><td><select aria-label="{f["id"]} 范围"><option value="pending">待定</option><option value="include">选入</option><option value="defer">暂缓</option></select></td></tr>' for f in features)
decision_rows=''.join(f'<tr><td>{d["id"]}</td><td><b>{e(d["name"])}</b><small>{e(d["tradeoff"])}</small></td><td>{e(d["advice"])}<small>{e(d["impact"])}</small></td><td><select data-decision="{d["id"]}" aria-label="{d["id"]} 选择"><option value="">待定</option>'+''.join('<option>'+e(o)+'</option>' for o in d['options'])+'</select></td></tr>' for d in decisions)
clean_title=lambda title: re.sub(r'^\d+\s*','',title)
nav=''.join(f'<a href="#{c["id"]}"><span>{i+1:02d}</span>{e(clean_title(c["title"]))}</a>' for i,c in enumerate(chapters))
def excerpt(numbers):
    chunks=[]
    for n in numbers:
        c=article.select('.chapter')[n-1]
        clone=BeautifulSoup(str(c),'html.parser')
        for x in clone.select('[id]'):del x['id']
        chunks.append(str(clone))
    return ''.join(chunks)
sha=hashlib.sha256(md.encode()).hexdigest()
decision_section=re.search(r'## 13 .*?(?=\n## 14 )',md,re.S).group(0)
brief='# CargoPlan v7 · 开工决策单\n\n> '+'海陆运输作业智能体：用一份货物计划贯穿陆上多站集散、港口通关与海运装箱，统一处理异构货物装配、装卸顺序、政策费用与加固要求，并输出人和机器人都能执行的协议。'+"\n\n来源方案SHA-256："+sha+"\n\n已定：运输公司与独立司机；首发陆运优先；3D与逐站作业为核心；首发不接真机。\n\n建议首个闭环：一车4～5站到集货仓H，出口子批换装海柜；一次真实改单，输出加固/通关待办与人工单/0.3任务包。\n\n"+decision_section+"\n## 评审后开发基线\n\n记录10项选择与改写、货型/车型实测档案和数据来源、动作模式及必需反例。先M0数据/合同、M1静态/身份、M2多站与装卸动作，再M3海陆辅助/加固、M4协议/回执、M5用户验收。\n\n本单列建议，未选择项保持待定；不代表开发范围已批准。45项完整能力池见[主方案](CARGOPLAN_PRODUCT_PLAN.md)，评审页可保存/导出你的实际决定。\n"
(ROOT/'docs/CARGOPLAN_BUILD_DECISIONS.md').write_text(brief)
data=json.dumps({'version':'v7.0','sha256':sha,'markdown':md,'research':research,'brief':brief,'features':features,'decisions':decisions},ensure_ascii=False).replace('<','\\u003c')
css=(ROOT/'scripts/product-review.css').read_text()+'''
html{scroll-behavior:auto}.hero h1{font-size:clamp(31px,3.2vw,48px);max-width:980px}.hero p{max-width:940px}.hero .sub{display:block;font-size:16px;color:#156a66;margin-bottom:12px;letter-spacing:0}.toolbar{flex-wrap:wrap}.toolbar .modes{flex-wrap:wrap;gap:5px}.toolbar .tools{margin-left:auto}.toolbar #search{width:130px}.duo{display:grid;grid-template-columns:1fr 1fr;gap:17px;margin:22px 0}.duo .panel{padding:25px}.duo h2{font-size:24px;margin:8px 0 15px}.label{color:#156a66;font-size:11px;letter-spacing:1.7px;font-weight:650}.panel.dark .label{color:#a3cdc2}.big{font-size:23px;font-weight:700;line-height:1.6}.pipeline{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;margin:24px 0}.pipeline div{flex:1;min-width:125px;background:#fffefa;border:1px solid #d8ded6;border-top:3px solid #156a66;border-radius:7px;padding:16px}.pipeline b{display:block;font-size:15px}.pipeline small{display:block;color:#5e6d77;font-size:12px;margin-top:9px}.notice{border-left:3px solid #dba450;background:#faf3e5;padding:16px 19px;margin:20px 0;font-size:14px}.compact{font-size:14px}.act,.scope-bar button{font:inherit;border:1px solid #cbd6cd;background:#fffefa;color:#156a66;border-radius:6px;padding:9px 13px;font-size:13px;cursor:pointer}.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.facts div{padding:18px;border:1px solid #dedfd8;border-radius:9px;background:#fffefa}.facts b{display:block;font-size:20px;color:#156a66}.facts small{display:block;font-size:12px;color:#5e6d77;margin-top:6px}.view-title{font-size:26px;margin:22px 0 12px}.scope-controls{display:flex;gap:9px;flex-wrap:wrap;margin:20px 0}.scope-controls input,.scope-controls select,.review-table select{font:inherit;font-size:12px;border:1px solid #ccd5cf;border-radius:6px;padding:8px;background:white;max-width:210px}.scope-controls input{flex:1;min-width:160px}.review-table{min-width:1030px}.review-table small{display:block;color:#647078;font-size:11px;margin-top:7px}.review-table td{font-size:12px}.review-table select{max-width:180px}.decisions-table{min-width:870px}.metrics{display:flex;gap:12px;flex-wrap:wrap;font-size:13px}.metrics span{padding:9px 13px;border:1px solid #dce0d8;background:#fffefa;border-radius:6px}.metrics b{font-size:19px;color:#156a66;margin-right:5px}.review-table tr[data-state=include]{background:#edf5ed}.review-table tr[data-state=defer]{background:#f2f2ee;color:#6a7478}.review-note{width:100%;min-height:95px;padding:12px;font:inherit;border:1px solid #d7ddd4;border-radius:7px;background:#fffefa}.help{font-size:12px;color:#657279}#research .chapter:first-child h2{margin-top:20px}.tag{display:inline-block;background:#e6eee6;color:#156a66;border-radius:4px;padding:4px 8px;font-size:11px;margin:0 6px 6px 0}.overview-list{padding-left:19px;font-size:14px}.source-note{font-size:12px;color:#61727a}.mode-heading{border-bottom:1px solid #d9ded4;padding-bottom:15px}.module-line{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.module-line span{background:#edf0e8;padding:9px 13px;border-radius:6px;font-size:13px}.chapter{padding-top:8px}.mobile-menu{display:none}
@media(max-width:1100px){.toolbar{padding:12px 20px}.toolbar .tools{width:100%;margin-left:0}.toolbar #search{flex:1}.facts{grid-template-columns:1fr}}
@media(max-width:800px){.duo{grid-template-columns:1fr}.hero h1{font-size:30px}.hero .sub{font-size:14px}.toolbar{padding:10px 14px}.toolbar button{font-size:11px;padding:7px 9px}.pipeline div{min-width:130px}.view-title{font-size:23px}html{scroll-padding-top:160px}}
@media print{.sidebar,.toolbar,.hero,.footer,.review-view{display:none!important}#document[hidden]{display:block!important}#document .chapter{display:block!important}.shell{margin:0}main{padding:0}.table-wrap{overflow:visible}table,.review-table{min-width:0!important;width:100%;table-layout:auto}th,td{font-size:9px!important;padding:6px!important}.chapter h2{font-size:19px}.chapter h3{font-size:15px}a{overflow-wrap:anywhere}}
'''
PAGE=r'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="海陆运输作业智能体，一份货物计划连接多站、通关、海运装箱与可校验执行契约"><title>CargoPlan v7 · 海陆作业开工评审</title><style>__CSS__</style></head><body>
<aside class="sidebar"><button class="mobile-close" aria-label="关闭目录">✕</button><a class="brand" href="#top">CargoPlan.<small>舱策 / SEA &amp; LAND</small></a><div class="side-meta">v7.0 · 2026.10.30<br>运输公司＋独立司机<br>一份货物计划 · 跨海陆作业</div><nav>__NAV__</nav><div class="side-footer">公开资料已核对<br>客户与API实测待完成</div></aside>
<div class="shell" id="top"><header class="toolbar"><div class="modes"><button class="mobile-menu" aria-label="打开目录">目录</button><button data-mode="overview" aria-pressed="true">产品定位</button><button data-mode="market">用户与痛点</button><button data-mode="depth">首发交付</button><button data-mode="growth">执行与协议</button><button data-mode="scope">开工决策</button><button data-mode="research">资料复核</button><button data-mode="document">完整方案</button></div><div class="tools"><input type="search" id="search" aria-label="检索完整方案" placeholder="检索完整方案"><button id="download-md">方案MD</button><button id="print">打印/PDF</button></div></header>
<main><header class="hero"><div class="eyebrow">CARGOPLAN / SEA &amp; LAND OPERATIONS</div><h1><span class="sub">服务运输公司与独立司机，连接仓库、货代与未来设备</span>海陆运输作业智能体</h1><p id="product-vision">海陆运输作业智能体：用一份货物计划贯穿陆上多站集散、港口通关与海运装箱，统一处理异构货物装配、装卸顺序、政策费用与加固要求，并输出人和机器人都能执行的协议。</p><div class="stamp"><span class="pill">愿景已定 · 10项方向已确认</span><span class="pill">0.3契约拟议 · 首发不控机</span><span class="pill amber">10项方向已确认 · 45项能力池</span></div></header>
<section id="overview" class="review-view"><div class="duo"><div class="panel dark"><div class="label">WHO / VALUE</div><h2>公司协调多车，司机规划一车</h2><p>用同一货物身份与计划版本，按客户站点计划比较装载、每站拆取和成本。仓库、出口物流与设备伙伴各处理自己负责的任务。</p><button class="act" data-open="market">查看目标用户与痛点 →</button></div><div class="panel"><div class="label">THIS REVIEW / START BUILDING</div><h2>先确定一个能交付的作业闭环</h2><p>一车4～5站到集货仓，出口子批入海柜；中间做一次真实改单，交付加固/通关待办、人工作业单和可校验任务包。</p><button class="act" data-open="scope">先评审10项开工决策 →</button></div></div>
<h2 class="view-title">一份计划，连接实际发生的交接</h2><div class="pipeline"><div><b>陆上多站集散</b><small>站点计划、装卸与余货</small></div><div><b>集货仓交接</b><small>同一货物ID，记录实际状态</small></div><div><b>海运装箱</b><small>新坐标/载具，复用3D与规则</small></div><div><b>港口通关协作</b><small>资料、条款、状态与责任待办</small></div><div><b>人机执行协议</b><small>同版依赖、能力与回执</small></div></div><p class="source-note">这是业务关系示意。资料准备可并行；封箱中转默认搬整柜，只有明确开箱事件才改变内部货物。</p>
<div class="duo"><div class="panel"><div class="label">PLANNING DEPTH</div><h2>每一步检查，形成可复验证据</h2><p>E1支撑/稳定、E2接近、E3搬运匹配、E4多站可取、E5容差。检查状态、模型等级与设备执行资格分别显示，未知不冒充通过。</p><button class="act" data-open="growth">查看等级、协议与回执 →</button></div><div class="panel"><div class="label">FIRST RELEASE</div><h2>把功能、模型和验收一起冻结</h2><p>首发8个交付包，按M0–M5推进。每个包都有输出和边界，反例决定能否验收。完整能力池用于后续扩展。</p><button class="act" data-open="depth">查看首发边界与体验 →</button></div></div>
<div class="notice"><b>需要本轮拍板：</b>已记录10项反馈；重点落实Excel、站点输入、可编辑3D界面、加固提醒、政策数据与机器人协议。每项给出建议组合与影响，未选择的项保持待定。</div><button class="act" id="download-brief">下载开工决策单</button> <button class="act" data-open="scope">记录本轮选择 →</button><p class="help">本次交付为开工前评审工作台；不调用生产求解器、不发起申报/交易、不连接真机。</p></section>
<section id="market" class="review-view" hidden><div class="mode-heading"><h2 class="view-title">面向谁，哪些痛点由我们直接解决</h2><p>明确购买者、使用者和协作方；区分直接价值、辅助改善与不在能力范围内的问题。</p></div>__MARKET__</section>
<section id="depth" class="review-view" hidden><div class="mode-heading"><h2 class="view-title">首发交付：统一计划、作业闭环与数据边界</h2><p>先审阅P1—P8和一个端到端样例，再选择车型、货型与模型深度。</p></div>__DEPTH__</section>
<section id="growth" class="review-view" hidden><div class="mode-heading"><h2 class="view-title">执行深度：检查、等级、契约、通关与加固</h2><p>吸收两份附件；将未知、模型通过和设备/官方状态分开。</p></div>__GROWTH__</section>
<section id="scope" class="review-view" hidden><h2 class="view-title">范围与实施细节</h2><div class="notice">新愿景已采用；D01～D10的产品方向已确认；D07的实际接口接入待验证。旧版存储保留，不自动套用；45项能力池不等于全部首发。</div><h3>10项核心开工决策</h3><p class="help" id="decision-progress" role="status">10/10项方向已确认</p><button class="act" id="use-recommendations">填入建议组合供评审</button><p class="help">仅填写10项建议选项，不自动选择下方功能池或启动开发。</p><div class="table-wrap"><table class="review-table decisions-table"><thead><tr><th>编号</th><th>需要选择与取舍</th><th>建议及影响</th><th>你的选择</th></tr></thead><tbody>__DECISIONS__</tbody></table></div><h3>45项扩展功能池</h3><p class="help">开工范围以交付包、模型、反例与评审决定为准；功能勾选用于记录意向。</p><div class="metrics"><span><b id="include-count">0</b>选入</span><span><b id="pending-count">45</b>待定</span><span><b id="defer-count">0</b>暂缓</span></div><div class="scope-controls"><input type="search" id="feature-search" aria-label="搜索功能" placeholder="搜索功能、价值、依赖"><select id="layer-filter" aria-label="按适用层筛选">__LAYERS__</select><select id="scope-filter" aria-label="按选择筛选"><option value="all">全部选择</option><option value="include">选入</option><option value="pending">待定</option><option value="defer">暂缓</option></select><button class="act" id="export-scope">导出决定MD</button><button class="act" id="reset-scope">恢复待定</button></div><div class="table-wrap"><table class="review-table feature-table"><thead><tr><th>编号</th><th>功能</th><th>适用层</th><th>输出与价值</th><th>依赖与建议</th><th>你的决定</th></tr></thead><tbody>__FEATURES__</tbody></table></div><p id="no-results" class="help" hidden>没有符合条件的功能。</p><label for="scope-note"><b>备注、具体走廊与优先顺序</b></label><textarea id="scope-note" class="review-note" placeholder="可写车型、货型、区域、数据来源或改写建议。"></textarea><p id="save-state" class="help" role="status">仅保存在本机；请导出决定保存或回传。</p></section>
<section id="research" class="review-view" hidden><h2 class="view-title">货运基础与工具调研</h2><div class="notice">公开资料及本轮附件复核；新核对摘要/README与官方流程，不称全部论文复现。首发陆运优先，海陆协作与设备能力按证据分层。</div><button class="act" id="download-research">下载调研MD</button>__RESEARCH__</section>
<article id="document" hidden><div class="doc-title"><strong>完整产品方案 v7.0</strong><span>已定方向与待选深度分开</span></div>__ARTICLE__</article>
<noscript><style>#document[hidden]{display:block!important}</style><p>JavaScript未启用；完整方案可读，选择/导出不可用。</p></noscript><footer class="footer">CargoPlan 舱策 · v7.0 · 2026-10-30<br>研究与评审原型；新平台与新求解闭环待实现。离线正文可读，外部来源需联网，本地材料需保留目录。<br>方案SHA-256：__HASH__</footer></main></div>
<script type="application/json" id="data">__DATA__</script><script>
(()=>{'use strict';const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],data=JSON.parse(q('#data').textContent),key='cargoplan-scope-v7-build-20261030',modes=['overview','market','depth','growth','scope','research','document'];let state={choices:{},decisions:{},note:''};
function setMode(name){if(!modes.includes(name))name='overview';modes.forEach(id=>q('#'+id).hidden=id!==name);all('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===name)));}
function go(name){setMode(name);scrollTo({top:0,behavior:'instant'});}
all('[data-mode]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.mode)));all('[data-open]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.open)));
all('a[href^="#p-"]').forEach(a=>a.addEventListener('click',()=>{setMode('document');q('.sidebar').classList.remove('open');}));q('.mobile-menu').addEventListener('click',()=>q('.sidebar').classList.toggle('open'));q('.mobile-close').addEventListener('click',()=>q('.sidebar').classList.remove('open'));document.addEventListener('keydown',e=>{if(e.key==='Escape')q('.sidebar').classList.remove('open')});
try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s&&typeof s==='object')state={choices:s.choices&&typeof s.choices==='object'?s.choices:{},decisions:s.decisions&&typeof s.decisions==='object'?s.decisions:{},note:typeof s.note==='string'?s.note:''};}catch{}
['D01','D02','D03','D04','D05','D06','D07','D08','D09','D10'].forEach(id=>{state.decisions[id]=data.decisions.find(d=>d.id===id).options[0];});
function save(){try{localStorage.setItem(key,JSON.stringify(state));q('#save-state').textContent='已保存在本机；使用“导出决定MD”保存或分享。';}catch{q('#save-state').textContent='本机保存不可用；请导出决定。';}}
function filter(){let n=0;const term=q('#feature-search').value.toLowerCase().trim(),status=q('#scope-filter').value,layer=q('#layer-filter').value;all('.feature-table tbody tr').forEach(r=>{r.hidden=!(r.textContent.toLowerCase().includes(term)&&(status==='all'||r.dataset.state===status)&&(layer==='all'||data.features.find(f=>f.id===r.dataset.feature).layer===layer));if(!r.hidden)n++;});q('#no-results').hidden=n>0;}
function update(){const counts={include:0,pending:0,defer:0};all('.feature-table tbody tr').forEach(r=>{const id=r.dataset.feature;let s=state.choices[id];if(!Object.hasOwn(counts,s))s='pending';r.dataset.state=s;r.querySelector('select').value=s;counts[s]++;});Object.entries(counts).forEach(([k,v])=>q('#'+k+'-count').textContent=v);filter();}
all('.feature-table select').forEach(el=>el.addEventListener('change',()=>{state.choices[el.closest('tr').dataset.feature]=el.value;update();save();}));all('[data-decision]').forEach(el=>{const v=state.decisions[el.dataset.decision];if([...el.options].some(o=>o.value===v))el.value=v;el.addEventListener('change',()=>{state.decisions[el.dataset.decision]=el.value;updateDecisionSummary();save();});});q('#scope-note').value=state.note;q('#scope-note').addEventListener('input',e=>{state.note=e.target.value;save();});['feature-search','layer-filter','scope-filter'].forEach(id=>q('#'+id).addEventListener(id==='feature-search'?'input':'change',filter));
function updateDecisionSummary(){const n=data.decisions.filter(d=>state.decisions[d.id]).length;q('#decision-progress').textContent=n+'/'+data.decisions.length+'项已选择；待定项不会自动批准。';}
q('#use-recommendations').addEventListener('click',()=>{all('[data-decision]').forEach(el=>{el.value=data.decisions.find(d=>d.id===el.dataset.decision).options[0];state.decisions[el.dataset.decision]=el.value;});updateDecisionSummary();save();});
q('#reset-scope').addEventListener('click',()=>{state={choices:{},decisions:{},note:''};all('[data-decision]').forEach(el=>{const known=['D01','D02','D03','D04','D05','D06','D07','D08','D09','D10'].includes(el.dataset.decision);el.value=known?data.decisions.find(d=>d.id===el.dataset.decision).options[0]:'';if(known)state.decisions[el.dataset.decision]=el.value;});q('#scope-note').value='';update();updateDecisionSummary();save();});
function download(text,name){const u=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
q('#download-brief').addEventListener('click',()=>download(data.brief,'CARGOPLAN_BUILD_DECISIONS.md'));q('#download-md').addEventListener('click',()=>download(data.markdown,'CARGOPLAN_PRODUCT_PLAN.md'));q('#download-research').addEventListener('click',()=>download(data.research,'FREIGHT_FOUNDATIONS_AND_TOOL_RESEARCH.md'));q('#export-scope').addEventListener('click',()=>{let out='# CargoPlan 海陆作业开工评审决定\n\n来源：'+data.version+' / '+data.sha256+'\n\n已定：海陆运输作业智能体愿景；运输公司与独立司机；首发陆运优先与3D核心；首发不控机。\n\n';out+='## 具体取舍\n\n'+data.decisions.map(d=>'- '+d.id+' '+d.name+'：'+(state.decisions[d.id]||'待定')).join('\n')+'\n';for(const [s,name]of Object.entries({include:'选入',pending:'待定',defer:'暂缓'})){out+='\n## '+name+'\n\n';const list=data.features.filter(f=>(state.choices[f.id]||'pending')===s);out+=(list.length?list.map(f=>'- '+f.id+' '+f.name).join('\n'):'无')+'\n';}out+='\n## 备注\n\n'+(state.note||'未填写')+'\n';download(out,'CARGOPLAN_SCOPE_DECISIONS.md');});q('#print').addEventListener('click',()=>print());q('#search').addEventListener('input',e=>{const term=e.target.value.trim().toLowerCase();let first=null;all('#document .chapter').forEach(c=>{const hit=!!term&&c.textContent.toLowerCase().includes(term);c.classList.toggle('search-hit',hit);if(hit&&!first)first=c;});if(term){setMode('document');if(first)first.scrollIntoView();}});update();updateDecisionSummary();setMode(location.hash.startsWith('#p-')?'document':'overview');})();
</script></body></html>'''
# Normalize JS escapes in this raw template to real newline escapes in string values.
PAGE=PAGE.replace('\\\\n','\\n')
replacements={'__CSS__':css,'__NAV__':nav,'__MARKET__':excerpt([2,11]),'__DEPTH__':excerpt([3,4,5,9,12]),'__GROWTH__':excerpt([6,7,8,10]),'__LAYERS__':'<option value="all">全部层次</option>'+''.join('<option>'+e(v)+'</option>' for v in dict.fromkeys(f['layer'] for f in features)),'__DECISIONS__':decision_rows,'__FEATURES__':feature_rows,'__RESEARCH__':str(references),'__ARTICLE__':str(article),'__HASH__':sha,'__DATA__':data}
for k,v in replacements.items():PAGE=PAGE.replace(k,v)
out=ROOT/'output/reports/cargoplan-product-review.html';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(PAGE)
print(json.dumps({'version':'v7.0-review','chapters':len(chapters),'researchChapters':len(rchapters),'features':len(features),'decisions':len(decisions),'htmlBytes':out.stat().st_size,'html':str(out)},ensure_ascii=False))
