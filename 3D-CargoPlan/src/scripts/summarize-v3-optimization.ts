// #created 11/08/2026
import {createHash} from 'node:crypto'
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,renameSync,statSync,writeFileSync} from 'node:fs'
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path'
import {loadResearchCalibration,researchCalibrationProvenance,researchFileHash,compareResearchWithPdf} from '../core/research-calibration'
import {assessResearchCandidate,compareResearchMetrics,researchHash} from '../core/research-metrics'
import type {AssessedResearchCandidate,ResearchMetrics} from '../core/research-metrics'
import {solidVolume} from '../core/solid-geometry'
import type {PackingSolution,ValidationReport} from '../types/packing'

const start=Date.now(),root=process.cwd(),scanRoot='data/optimization',jsonPath='data/optimization/v3-progress.json',markdownPath='docs/OPTIMIZATION_V3_RECAP.md',snapshotRoot='data/optimization/v3-recap-engine-snapshots',cal=loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const record=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null
const at=(value:unknown,keys:string[]):unknown=>keys.reduce<unknown>((v,key)=>record(v)?.[key],value)
const str=(v:unknown)=>typeof v==='string'?v:null
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null
const bytesHash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
const atomic=(path:string,value:string)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(`${path}.tmp`,value);renameSync(`${path}.tmp`,path)}
interface EngineReference{path:string;sha256:string}
interface CandidateRecord{path:string;sha256:string;artifactModifiedAt:string;contractSha256:string;declaredInputSha256:string|null;provenanceWarnings:string[];independentlyValid:boolean;complete:boolean;eligible:boolean;withinElevenTarget:boolean;metrics:ResearchMetrics;validation:ValidationReport;unloaded:{id:string;name:string;sourceSheet:unknown;sourceRow:unknown}[];elapsedMilliseconds:number|null;elapsedSource:string|null;solver:{status:string|null;objective:number|null;bestBound:number|null;wallSeconds:number|null};engineFiles:EngineReference[];declaredEngineSha256:string|null;verificationMilliseconds:number}
interface StoredCandidate{record:CandidateRecord;solution:PackingSolution}
const engineRefs=(d:Record<string,unknown>)=>{
  const refs:EngineReference[]=[]
  for(const value of [at(d,['provenance','engineFiles']),at(d,['execution','engineFiles']),d.engineFiles])if(Array.isArray(value))for(const item of value){const v=record(item);if(v&&typeof v.path==='string'&&typeof v.sha256==='string'&&/^[a-f0-9]{64}$/i.test(v.sha256))refs.push({path:v.path,sha256:v.sha256})}
  return [...new Map(refs.map(v=>[`${v.path}:${v.sha256}`,v])).values()]
}
const duration=(d:Record<string,unknown>)=>{
  for(const keys of [['elapsedMs'],['record','elapsedMs'],['execution','wallClockElapsedMs'],['execution','elapsedMs'],['event','elapsedMs'],['solution','stats','executionTime']]){const value=num(at(d,keys));if(value!==null&&value>=0)return {value,source:keys.join('.')}}
  return {value:null,source:null}
}
const files:string[]=[]
function walk(path:string){for(const entry of readdirSync(path,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const target=`${path}/${entry.name}`;if(entry.isDirectory()){if(['engine-snapshot','engine-snapshots','v3-recap-engine-snapshots'].includes(entry.name))continue;walk(target)}else if(entry.isFile()&&entry.name.endsWith('.json')&&target!==jsonPath&&!/^(problem|answer|input-snapshot|source-snapshot|manifest|summary|supervision|total-supervision|model-archives|ejected-components|replay-status|experiment-summary)(\.|-)/.test(entry.name))files.push(target)}}
walk(scanRoot);files.sort()
const accepted:CandidateRecord[]=[],excluded:{path:string;sha256?:string;reason:string;errors?:string[]}[]=[],ignored:{path:string;reason:string}[]=[]
let bestComplete:StoredCandidate|null=null,bestPartial:StoredCandidate|null=null,solutionDocuments=0
for(const path of files){
  let bytes:Buffer,d:Record<string,unknown>|null
  try{bytes=readFileSync(path);d=record(JSON.parse(bytes.toString('utf8')))}catch(error){ignored.push({path,reason:`Cannot read stable JSON snapshot: ${error instanceof Error?error.message:String(error)}`});continue}
  if(path.split('/').pop()?.includes('snapshot')){ignored.push({path,reason:'Input or diagnostic hint snapshot, not a newly produced solution output'});continue}
  const solution=record(d?.solution)
  if(!d||!solution||!Array.isArray(solution.containers)||!Array.isArray(solution.unpackedItems)){ignored.push({path,reason:'Not a solution output document'});continue}
  solutionDocuments++;const sha256=bytesHash(bytes),declaredContract=str(at(d,['provenance','contractSha256']))
  if(declaredContract!==cal.contractSha256){excluded.push({path,sha256,reason:declaredContract?'Different model contract SHA256':'No declared v3 contract SHA256'});continue}
  if(researchHash(d.config)!==cal.configSha256){excluded.push({path,sha256,reason:'Declared config does not match frozen v3 config'});continue}
  const verified=Date.now()
  let assessed:AssessedResearchCandidate
  try{assessed=assessResearchCandidate(d.solution as PackingSolution,cal.items,cal.config)}catch(error){excluded.push({path,sha256,reason:`Authoritative assessment raised: ${error instanceof Error?error.message:String(error)}`});continue}
  const declaredInputSha256=str(at(d,['provenance','inputSha256'])),provenanceWarnings:string[]=[]
  if(declaredInputSha256&&declaredInputSha256!==cal.inputSha256)provenanceWarnings.push('Declared semantic input hash differs from current authoritative normalization hash; the frozen manifest bytes and full authoritative validation are reported separately.')
  const manifestDeclared=str(at(d,['provenance','manifestSha256']))
  if(manifestDeclared&&manifestDeclared!==cal.manifestSha256){excluded.push({path,sha256,reason:'Declared manifest bytes SHA256 differs from frozen manifest'});continue}
  const elapsed=duration(d),r:CandidateRecord={path,sha256,artifactModifiedAt:statSync(path).mtime.toISOString(),contractSha256:declaredContract,declaredInputSha256,provenanceWarnings,independentlyValid:assessed.validation.valid,complete:assessed.metrics.complete,eligible:assessed.metrics.eligible,withinElevenTarget:assessed.metrics.totalContainers<=11,metrics:assessed.metrics,validation:assessed.validation,unloaded:assessed.solution.unpackedItems.map(i=>({id:i.id,name:i.name,sourceSheet:i.rawData._sourceSheet,sourceRow:i.rawData._sourceRow})),elapsedMilliseconds:elapsed.value,elapsedSource:elapsed.source,solver:{status:str(at(d,['record','solverStatus']))??str(at(d,['record','status'])),objective:num(at(d,['record','objective'])),bestBound:num(at(d,['record','bestBound'])),wallSeconds:num(at(d,['record','solverWallSeconds']))},engineFiles:engineRefs(d),declaredEngineSha256:str(at(d,['provenance','engineSha256']))??str(at(d,['record','engineSha256'])),verificationMilliseconds:Date.now()-verified}
  accepted.push(r)
  if(!r.independentlyValid){excluded.push({path,sha256,reason:'Common validator rejected this solution against all 1371 authoritative identities',errors:assessed.validation.errors});continue}
  if(r.eligible){if(!bestComplete||compareResearchMetrics(r.metrics,bestComplete.record.metrics)<0||compareResearchMetrics(r.metrics,bestComplete.record.metrics)===0&&(path==='data/optimization/v3-r2-delivery/current-best.json'||bestComplete.record.path!=='data/optimization/v3-r2-delivery/current-best.json'&&path.endsWith('/best-complete.json')&&!bestComplete.record.path.endsWith('/best-complete.json')))bestComplete={record:r,solution:assessed.solution}}
  else if(!bestPartial||Number(r.withinElevenTarget)>Number(bestPartial.record.withinElevenTarget)||r.withinElevenTarget===bestPartial.record.withinElevenTarget&&(r.metrics.placedItems>bestPartial.record.metrics.placedItems||r.metrics.placedItems===bestPartial.record.metrics.placedItems&&(r.metrics.totalContainers<bestPartial.record.metrics.totalContainers||r.metrics.totalContainers===bestPartial.record.metrics.totalContainers&&path.endsWith('/best-partial.json')&&!bestPartial.record.path.endsWith('/best-partial.json'))))bestPartial={record:r,solution:assessed.solution}
}
const milestonesRequested=[
  {loaded:1323,path:'data/optimization/v3-repair-11/candidate-1.json',method:'全玻璃架固定基底，取出小件及依赖闭包后跨柜修补'},
  {loaded:1337,path:'data/optimization/v3-macro-repack/candidate-0.json',method:'同源货物混合朝向与联合承托宏重排'},
  {loaded:1341,path:'data/optimization/v3-profile-restore/best-partial.json',method:'恢复长细条并合并合法屋顶交换'},
  {loaded:1349,path:'data/optimization/v3-cpsat-floor/result.json',method:'CP-SAT：同柜支承组件平移，新增 8 件'},
  {loaded:1354,path:'data/optimization/v3-cpsat-floor/round-2/result.json',method:'CP-SAT：替代分堆与承托组件平移，新增 5 件'},
  {loaded:1359,path:'data/optimization/v3-roof-balance/result.json',method:'玻璃架屋顶转载、混合堆及剩余载荷补 W08'},
  {loaded:1360,path:'data/optimization/v3-roof-stripes/result.json',method:'225 mm 屋顶条带加装 W08；先移出碰撞地板件'},
  {loaded:1361,path:'data/optimization/v3-combined/roof-stripes-merged.json',method:'按祖先方案合并屋顶条带与 W07 插入，并重新全量验证'},
  {loaded:1365,path:'data/optimization/v3-floor-orientation-repair-high/best-partial.json',method:'地板 W02 扇改合法立放、缩小占地后跨柜修补'}
]
const milestones=milestonesRequested.map(m=>{const choices=accepted.filter(r=>r.independentlyValid&&!r.complete&&r.metrics.totalContainers===11&&r.metrics.placedItems===m.loaded),selected=choices.find(r=>r.path===m.path)??choices[0];return {...m,found:!!selected,source:selected??null}})
if(bestPartial&&bestPartial.record.metrics.placedItems>1365)milestones.push({loaded:bestPartial.record.metrics.placedItems,path:bestPartial.record.path,method:'本次重算发现的最新合法部分候选',found:true,source:bestPartial.record})
const fullBaselineTwelve=accepted.find(r=>r.path==='data/optimization/v3/best-complete.json'&&r.eligible&&r.metrics.totalContainers===12),firstCompleteEleven=accepted.find(r=>r.path==='data/optimization/v3-last-w12-repair/best-complete.json'&&r.eligible&&r.metrics.totalContainers===11)
if(fullBaselineTwelve)milestones.unshift({loaded:1371,path:fullBaselineTwelve.path,method:'完整12柜历史基底：1371全量合法，尚不优于原11柜',found:true,source:fullBaselineTwelve})
if(firstCompleteEleven)milestones.push({loaded:1371,path:firstCompleteEleven.path,method:'首次完整11柜闭合：尾42.138805m³、前10瓶颈65.147198%，当时未实现缩尾',found:true,source:firstCompleteEleven})
const priorImprovedEleven=accepted.find(r=>r.path==='data/optimization/v3-tail-independent/frozen-complete.json'&&r.eligible)
if(priorImprovedEleven&&bestComplete?.record.metrics.physicalLayoutSha256!==priorImprovedEleven.metrics.physicalLayoutSha256)milestones.push({loaded:1371,path:priorImprovedEleven.path,method:'上轮完整11柜缩尾交付：尾36.716754m³、前10瓶颈65.147198%；本轮以此继续',found:true,source:priorImprovedEleven})
if(bestComplete&&bestComplete.record.metrics.totalContainers<=11&&bestComplete.record.path!==firstCompleteEleven?.path)milestones.push({loaded:1371,path:bestComplete.record.path,method:'完整11柜缩尾最终候选：与首次全量闭合分别记账，逐项重新验证',found:true,source:bestComplete.record})
const completePhaseNodes={fullBaselineTwelve:fullBaselineTwelve??null,firstCompleteEleven:firstCompleteEleven??null,finalImprovedEleven:bestComplete?.record.metrics.totalContainers===11?bestComplete.record:null}
const replayPath='data/reconstruction/replay-status.json',replay=existsSync(replayPath)?record(JSON.parse(readFileSync(replayPath,'utf8'))):null
const replayComplete=num(at(replay,['counts','completeContainers']))??5,replayExpected=num(at(replay,['counts','expectedContainers']))??11
const replayContainers=Array.isArray(replay?.containers)?replay.containers.flatMap(value=>{const v=record(value),s=record(v?.selected);return s?.complete===true?[num(v?.sourceContainerNumber)]:[]}):[1,2,3,10,11]
const rules=[
  '完整原始身份账：1371 件，原包装尺寸、重量、源行约束不变；单柜合同总重上限 28000 kg。',
  '净空 11600×2250×2500 mm；仅原源行 16 的 W02 框保留高 2560 mm 的指定例外。',
  '三轴留缝：玻璃架之间 0 mm，其余 5 mm。',
  '保留源表允许朝向；孔内框扇严格原宽轴竖直，不增加窗面内 90° 旋转。',
  '居中空腔：W02 侧放孔 1200×160×2200 mm；W01 长框按原轴 3000×790×210 mm；短框 1200×1600×110 mm。仅允许的源类别可完整嵌入单个获准孔。',
  '保留同源/可叠放对象、顶部可放、禁止错位、必须落地、累计载荷、顶部单件重量和叠放件数等所有原表约束。',
  '玻璃架顶部累计载荷不超过 600 kg；W07/W11/W12 顶部单件不超过 5 kg；W02/W06 扇侧放顶部累计严格小于 120 kg；源表平放至多 10 件等限制不变。',
  '32 件指定辅材上方货物必须最大面积面朝下；其中源行 28/29 重箱顶部混放单件不超过 60 kg、累计不超过 200 kg。',
  '仅取消程序额外的 80% 底面承托比例；仍需正的实体承托投影、重心投影位于实体接触点凸包内，并逐层计载荷。',
  '禁止错位按物品自身约束执行（item-only）；此项源字段校准自 v2 保留，未新增下方物品对上件的双向额外限制。',
  '竖直 5 mm 使用 pdf-clearance-projection 明示投影传载假设；没有虚构实体隔垫。验证范围为几何与载荷假设，不能替代现场力学验收。'
]
const snapshotRefs=[...new Map([...accepted.filter(r=>r.independentlyValid).flatMap(r=>r.engineFiles),...['src/core/research-metrics.ts','src/core/validation.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/loading-profile.ts'].map(path=>({path,sha256:researchFileHash(path)})),{path:'src/scripts/summarize-v3-optimization.ts',sha256:researchFileHash('src/scripts/summarize-v3-optimization.ts')}].map(r=>[`${r.path}:${r.sha256}`,r])).values()]
const snapshots:{sourcePath:string;recordedSha256:string;currentSha256:string|null;matchedCurrent:boolean;snapshotPath:string|null;reason?:string}[]=[]
for(const ref of snapshotRefs){const absolute=resolve(root,ref.path),rel=relative(root,absolute);if(isAbsolute(rel)||rel.startsWith(`..${sep}`)||rel==='..'||rel.split(sep)[0]==='research'){snapshots.push({sourcePath:ref.path,recordedSha256:ref.sha256,currentSha256:null,matchedCurrent:false,snapshotPath:null,reason:'Outside authorized project source snapshot scope'});continue}if(!existsSync(absolute)){snapshots.push({sourcePath:ref.path,recordedSha256:ref.sha256,currentSha256:null,matchedCurrent:false,snapshotPath:null,reason:'Recorded source path no longer exists'});continue}const current=researchFileHash(absolute);if(current!==ref.sha256){snapshots.push({sourcePath:ref.path,recordedSha256:ref.sha256,currentSha256:current,matchedCurrent:false,snapshotPath:null,reason:'Current source differs; historical execution was not recreated or guessed'});continue}const target=`${snapshotRoot}/${ref.sha256}/${rel}`;mkdirSync(dirname(target),{recursive:true});if(!existsSync(target))copyFileSync(absolute,target);if(researchFileHash(target)!==ref.sha256)throw new Error(`Snapshot hash mismatch: ${target}`);snapshots.push({sourcePath:ref.path,recordedSha256:ref.sha256,currentSha256:current,matchedCurrent:true,snapshotPath:target})}
const longFirstBranches=['data/optimization/v3-long-first-cpsat','data/optimization/v3-long-first-cpsat/round-2','data/optimization/v3-long-first-cpsat/hybrid-seed','data/optimization/v3-long-first-cpsat/round-3'].flatMap(directory=>{const path=`${directory}/summary.json`;if(!existsSync(path))return[];const data=record(JSON.parse(readFileSync(path,'utf8'))),r=record(data?.record),candidate=accepted.find(c=>c.path===`${directory}/result.json`);return[{directory,summaryPath:path,summarySha256:researchFileHash(path),status:str(r?.solverStatus)??str(data?.status)??'constructive-candidate',loaded:candidate?.metrics.placedItems??num(r?.loaded),missing:candidate?.metrics.unpackedItems??num(r?.missing),longsLoaded:num(r?.longsLoaded),longsExpected:num(r?.longsExpected)??138,independentlyValid:candidate?.independentlyValid??false,eligible:candidate?.eligible??false,elapsedMilliseconds:num(r?.elapsedMs)??num(data?.elapsedMs),record:r,provenance:data?.provenance??null,unloaded:candidate?.unloaded??null,resultPath:candidate?.path??null,resultSha256:candidate?.sha256??null,notAnImprovedCompleteCandidate:!candidate?.eligible}]})
const totalWeightKg=cal.items.reduce((s,i)=>s+i.weight,0),totalSolidM3=cal.items.reduce((s,i)=>s+solidVolume(i),0)/1e9
const progress={schemaVersion:1,generatedAt:new Date().toISOString(),scope:'Read-only solution-output audit of data/optimization; no research/ scan, no contract, source dataset or HTML mutation',provenance:{...researchCalibrationProvenance(cal),recapScript:{path:'src/scripts/summarize-v3-optimization.ts',sha256:researchFileHash('src/scripts/summarize-v3-optimization.ts')},assessmentEngineFiles:['src/core/research-metrics.ts','src/core/validation.ts','src/core/packing-utils.ts','src/core/solid-geometry.ts','src/core/loading-profile.ts'].map(path=>({path,sha256:researchFileHash(path)}))},authoritativeInput:{config:cal.config,manifest:cal.items,totalItems:cal.items.length,totalWeightKg,totalSolidM3,volumeDefinition:'Outer item boxes minus only the explicitly confirmed cavities. This packing-model solid volume is not the net physical aluminium or glass material volume; outer-envelope sums can double-count authorized nesting.',sourceFiles:cal.sourceFiles},acceptance:{priority:['complete-and-independently-valid','fewer-containers','at-11-minimize-tail-material-volume','at-11-maximize-front10-minimum-material-utilization'],userAllowsElevenWithImprovedTail:true,excludeMereRenumbering:true,pdfBaseline:{...cal.pdfBaseline,originalTailSolidM3:cal.pdfBaseline.originalTailSolidVolumeMm3/1e9,invariantMinimumTailSolidM3:cal.pdfBaseline.permutationInvariantMinSolidVolumeMm3/1e9},baselineGeometryFullyReplayed:false},rules,fixedReplay:{source:{path:replayPath,sha256:existsSync(replayPath)?researchFileHash(replayPath):null},completeContainers:replayComplete,expectedContainers:replayExpected,completeOriginalContainerNumbers:replayContainers,allOriginalElevenReplayed:replayComplete===replayExpected,definition:'Fixed original per-container identities; newly constructed coordinates, common model and independent validation. Raster PDF original XYZ were not recovered.',globalRearrangementIsSeparateAuthorizedPhase:true},bestComplete:bestComplete?{...bestComplete.record,solution:bestComplete.solution,pdfComparison:compareResearchWithPdf(bestComplete.record.metrics,cal)}:null,bestPartial:bestPartial?{...bestPartial.record,solution:bestPartial.solution}:null,completeElevenComparison:bestComplete?.record.metrics.totalContainers===11?{tailM3:bestComplete.record.metrics.tailSolidVolumeMm3/1e9,deltaVsOriginalTailM3:(bestComplete.record.metrics.tailSolidVolumeMm3-cal.pdfBaseline.originalTailSolidVolumeMm3)/1e9,deltaVsInvariantTailM3:(bestComplete.record.metrics.tailSolidVolumeMm3-cal.pdfBaseline.permutationInvariantMinSolidVolumeMm3)/1e9,front10MinimumUtilization:bestComplete.record.metrics.front10MinimumSolidUtilization,front10GainPercentagePoints:((bestComplete.record.metrics.front10MinimumSolidUtilization??0)-(cal.pdfBaseline.sortedFirstTenMinimumSolidUtilization??0))*100,tailImproved:compareResearchWithPdf(bestComplete.record.metrics,cal).canClaimTailConsolidation,globalOptimalityProven:false}:null,milestones,completePhaseNodes,longFirstBranches,candidates:accepted,excluded,ignored,snapshots,optimality:{globalOptimalityProven:false,localSolverStatusIsNotGlobalOptimality:true,partialValidatorPassIsNotComplete:true,partialTailMetricsAreNotAcceptanceEvidence:true},timing:{auditElapsedMilliseconds:Date.now()-start,milestoneDurationsArePerArtifactNotCumulative:true,parallelAndBranchRunsCannotBeSummedAsUniqueWallTime:true,missingRecordedDurationIsNull:true},scan:{solutionDocuments,acceptedV3Documents:accepted.length,independentlyValid:accepted.filter(r=>r.independentlyValid).length,eligibleComplete:accepted.filter(r=>r.eligible).length,partiallyLoaded:accepted.filter(r=>r.independentlyValid&&!r.complete).length,generatedSnapshotMayNeedRerunWhileOtherSolversAreActive:true}}
atomic(jsonPath,JSON.stringify(progress,null,2))
const f=(v:number,d=3)=>v.toFixed(d),mdLink=(path:string)=>`[${path}](../${path})`,best=bestPartial?.record,full=bestComplete?.record,missing=best?.unloaded??[]
const lines=[
  '# v3 装柜优化计算复盘',
  '',
  `生成时间：${progress.generatedAt}。本页由 ${mdLink('src/scripts/summarize-v3-optimization.ts')} 从候选文件重新校验生成；完整输入、解、SHA、逐 ID 缺件和排除原因见 ${mdLink(jsonPath)}。`,
  '',
  full?`**完整合法候选最少仍为 ${full.metrics.totalContainers} 柜（${full.metrics.placedItems}/1371 件）；${full.metrics.totalContainers>11?'尚未比原 11 柜方案更优，不能作为减柜交付。':'是否优于原基准另按尾柜及前十柜瓶颈指标判定。'}**`:'**当前扫描没有完整合法候选。**',
  '',
  full&&full.metrics.totalContainers===11?`当前完整方案：${mdLink(full.path)}，SHA256 \`${full.sha256}\`。前10柜最低材料利用率 **${f((full.metrics.front10MinimumSolidUtilization??0)*100,6)}%**，较原PDF提高 **${f(((full.metrics.front10MinimumSolidUtilization??0)-(cal.pdfBaseline.sortedFirstTenMinimumSolidUtilization??0))*100,6)} 个百分点**；排序后尾柜 **${f(full.metrics.tailSolidVolumeMm3/1e9,6)} m³**。${full.metrics.tailSolidVolumeMm3<cal.pdfBaseline.permutationInvariantMinSolidVolumeMm3-1?'尾柜也小于原方案重编号不变量，达到完整11柜缩尾改进。':'当前尾柜尚未小于原方案重编号不变量，不能宣称已实现缩尾目标。'}`:'',
  '',
  best?`${full&&full.metrics.totalContainers<=11?'历史未完成分支最高':'11柜目标内最好部分候选'}：${best.metrics.placedItems}/1371 件，缺 ${best.metrics.unpackedItems} 件。部分候选的尾柜指标不作验收结论。结果：${mdLink(best.path)}，SHA256 \`${best.sha256}\`。`:'未找到目标柜数内合法部分候选。',
  '',
  '## 原题与验收口径',
  '',
  `冻结合同：${mdLink('data/reconstruction/model-v3-contract.json')}，SHA256 \`${cal.contractSha256}\`。1371 件总重 ${f(totalWeightKg,2)} kg，装载模型实体体积 ${f(totalSolidM3,6)} m³（外包盒扣已确认空腔；不是铝材/玻璃净材料体积）。`,
  '',
  `原 PDF 标号第 11 柜材料体积 **${f(cal.pdfBaseline.originalTailSolidVolumeMm3/1e9,6)} m³**；对原 11 柜任意重编号后的最小尾柜仍为 **${f(cal.pdfBaseline.permutationInvariantMinSolidVolumeMm3/1e9,6)} m³**，前十柜最低材料利用率 **${f((cal.pdfBaseline.sortedFirstTenMinimumSolidUtilization??0)*100,6)}%**。仅改编号不算优化。用户接受完整 11 柜下减小尾柜、提高前十柜瓶颈；10 柜是更好的可能结果，非唯一成功条件。`,
  '',
  ...rules.map(v=>`- ${v}`),
  '',
  '## 固定配货复现与全局重排分开记账',
  '',
  `固定原配货功能复现记录仍为 **${replayComplete}/${replayExpected} 柜**（原柜号 ${replayContainers.join('、')}）。这是同一合同下重新构造坐标的工程复现；PDF 仅有栅格图，没有恢复隐藏的原始 XYZ，也没有声称原 11 柜逐项复现完成。其后跨柜优化依据用户“比原 11 柜更优”的授权继续，不能倒推为复现通过。`,
  '',
  '## 关键计算节点',
  '',
  '以下为不同分支里程碑，不是每一步都沿用上一步；耗时是文件记录的本次过程，不能相加成总工作时长。每一行均重新调用公共评估器验证。',
  '',
  '| 柜数 | 装入 / 1371 | 缺件 | 方法 | 文件记录秒 | 候选与源 SHA256 |',
  '|---:|---:|---:|---|---:|---|',
  ...milestones.map(m=>m.source?`| ${m.source.metrics.totalContainers} | ${m.source.metrics.placedItems} | ${m.source.metrics.unpackedItems} | ${m.method} | ${m.source.elapsedMilliseconds===null?'未记录':f(m.source.elapsedMilliseconds/1000,3)} | ${mdLink(m.source.path)}<br>\`${m.source.sha256}\` |`:`| — | ${m.loaded} | — | ${m.method}：本次未找到对应合法记录 | — | — |`),
  '',
  '## 长件优先独立分支',
  '',
  '此分支将 46 件 W07 与 92 件 W02 框共 138 件长件设为必装，95 件孔内 W05 随框保持相对姿态；允许独立短窗暂缺，以探索另一种可回填几何。全部长件齐全是诊断指标，部分候选不能作为完整交付，也不能因它替换装入总数更高的旧候选。',
  '',
  '| 分支 | 装入 / 缺件 | 长件齐数 | 公共重算合法 | 状态 / 文件记录秒 | 源 SHA256 |',
  '|---|---:|---:|---|---|---|',
  ...longFirstBranches.map(b=>`| ${mdLink(b.resultPath??b.summaryPath)} | ${b.loaded??'—'} / ${b.missing??'—'} | ${b.longsLoaded??'—'} / ${b.longsExpected} | ${b.independentlyValid?'是':'没有合法候选'} | ${b.status} / ${b.elapsedMilliseconds===null?'未记录':f(b.elapsedMilliseconds/1000,3)} | \`${b.resultSha256??b.summarySha256}\` |`),
  '',
  full&&full.metrics.totalContainers<=11?'## 历史部分分支缺件（完整当前方案已无缺件）':'## 当前部分方案缺件逐件清单',
  '',
  '| 原始 ID | 名称 | 源表/行 |',
  '|---|---|---|',
  ...missing.map(i=>`| ${i.id} | ${i.name} | ${String(i.sourceSheet)}:${String(i.sourceRow)} |`),
  '',
  '## 求解状态与复盘限制',
  '',
  '- 启发式失败、限时未找到、CP-SAT UNKNOWN/FEASIBLE 均不等于全局无解；局部模型的 OPTIMAL 只证明该冻结组件和姿态模型。当前没有全局最优证明。',
  '- CP-SAT 使用支承/嵌套连通组件、0.5 mm 网格及组件间保守分离；部分轮固定同柜，部分轮允许同规格 W07 跨柜。屋顶转载、源允许朝向变化属于单独构造分支，最终统一经过公共校验器。',
  '- 每个候选源文件 SHA 均以实际读取字节计算。合同或 config 不符、身份账不全、公共校验拒绝的记录列入 JSON 排除清单，不参与最优选择。',
  '- 历史声明的语义输入 hash 若与当前规范化 hash 不同，单独列警示；不替换冻结 manifest 字节，也不跳过权威原始身份与物理约束校验。',
  '- 仅在当前源码 SHA 与历史记录一致时保存源码快照；已经变化的历史源码明确标记“未匹配”，不编造复原。已有各轮实际执行快照和 model gzip 仍原位保留。',
  '',
  `本次评估 ${accepted.length} 个同合同解文档，其中完整可验收 ${accepted.filter(r=>r.eligible).length} 个、合法部分候选 ${accepted.filter(r=>r.independentlyValid&&!r.complete).length} 个。汇总本身耗时 ${f((Date.now()-start)/1000,3)} 秒；其他求解器运行中时需重跑刷新。`,
  '',
  '```sh',
  'node --import tsx src/scripts/summarize-v3-optimization.ts',
  '```',
  ''
]
atomic(markdownPath,lines.join('\n'));console.log(JSON.stringify({jsonPath,markdownPath,validComplete:full?{containers:full.metrics.totalContainers,loaded:full.metrics.placedItems,path:full.path}:null,bestPartial:best?{containers:best.metrics.totalContainers,loaded:best.metrics.placedItems,missing:best.metrics.unpackedItems,path:best.path}:null,assessed:accepted.length,excluded:excluded.length,elapsedMs:Date.now()-start}))
