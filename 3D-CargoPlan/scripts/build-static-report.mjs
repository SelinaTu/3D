// #created 11/08/2026
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createHash } from 'node:crypto'

const root = fileURLToPath(new URL('../', import.meta.url))
const input = path.resolve(root, process.argv[2] || 'delivery-output/packing-solution.json')
const inputBytes = await readFile(input)
const inputDocument = JSON.parse(inputBytes.toString('utf8'))
const research = Boolean(inputDocument.solution)
const snapshot = inputDocument.solution ?? inputDocument
const output = path.resolve(root, process.argv[3] || (research ? 'output/reports/iraq-villa-calibrated-research.html' : 'output/reports/iraq-villa-current-best.html'))
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const hash = value => createHash('sha256').update(value).digest('hex')
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const pct = n => `${(n * 100).toFixed(2)}%`
const fmt = (n, digits = 2) => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: digits })
const exact = n => String(n)
const generatedAt = new Date().toISOString()
const generatedLocal = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(generatedAt))
const geometryPath = path.join(root, 'src/core/solid-geometry.ts')
const geometrySha256 = hash(await readFile(geometryPath))
const geometryBundle = await build({ entryPoints: [geometryPath], bundle: true, format: 'esm', platform: 'node', write: false, minify: true })
const { solidBounds, solidVolume } = await import('data:text/javascript;base64,' + Buffer.from(geometryBundle.outputFiles[0].text).toString('base64'))
let audit, contract, researchAssessment, researchComparison, researchCalibration, researchContainerOrder
if (research) {
  assert(inputDocument.provenance?.status === 'ready', '研究结果缺少就绪的校准来源')
  const auditPath = path.resolve(root, inputDocument.provenance.auditPath), contractPath = path.resolve(root, inputDocument.provenance.contractPath)
  const [auditBytes, contractBytes] = await Promise.all([readFile(auditPath), readFile(contractPath)])
  assert(hash(auditBytes) === inputDocument.provenance.auditSha256, '结果引用的校准审计哈希已经变化，不能混用报告')
  assert(hash(contractBytes) === inputDocument.provenance.contractSha256, '结果引用的校准合同哈希已经变化，不能混用报告')
  audit = JSON.parse(auditBytes.toString('utf8')); contract = JSON.parse(contractBytes.toString('utf8'))
  assert(audit.status === 'passed' && contract.status === 'ready', '校准审计或研究合同未就绪')
  assert(inputDocument.validation?.valid === true, '研究结果没有通过独立校验')
  for (const source of audit.sourceFiles) assert(hash(await readFile(path.resolve(root, source.path))) === source.sha256, `源文件哈希不符：${source.path}`)
  assert(inputDocument.provenance.manifestSha256 === audit.manifest.sha256, '研究结果与校准货物哈希不一致')
  const auditBundle = await build({ stdin: { contents: "export { assessResearchCandidate, researchHash } from './src/core/research-metrics.ts'; export { loadResearchCalibration, compareResearchWithPdf } from './src/core/research-calibration.ts'", resolveDir: root, sourcefile: 'report-research-audit.ts' }, bundle: true, format: 'esm', platform: 'node', write: false, minify: true })
  const { assessResearchCandidate, researchHash, loadResearchCalibration, compareResearchWithPdf } = await import('data:text/javascript;base64,' + Buffer.from(auditBundle.outputFiles[0].text).toString('base64'))
  const requestConfig = inputDocument.config ?? contract.config
  assert(researchHash(requestConfig) === researchHash(contract.config), '研究结果 config 与引用合同不一致，不能以另一套口径作比较')
  researchCalibration = loadResearchCalibration(contractPath, root)
  assert(inputDocument.provenance.calibrationHash === researchCalibration.calibrationHash, '研究结果的校准指纹与当前引用文件不一致')
  researchAssessment = assessResearchCandidate(snapshot, researchCalibration.items, requestConfig)
  const checked = researchAssessment.validation
  assert(checked.valid, `报告生成时重新校验未通过：${checked.errors.slice(0, 5).join('；')}`)
  assert(researchAssessment.metrics.eligible, '报告只能交付全量、独立校验通过的完整研究方案；部分解仅保留计算记录')
  researchComparison = compareResearchWithPdf(researchAssessment.metrics, researchCalibration)
  snapshot.validation = checked
  const authoritative = new Map(researchCalibration.items.map(item => [item.id, item]))
  for (const container of snapshot.containers) for (const placed of container.items) placed.item = structuredClone(authoritative.get(placed.item.id))
  researchContainerOrder = researchAssessment.metrics.containers.map(c => ({ displayedId: c.canonicalId, savedId: c.sourceContainerId, savedIndex: c.sourceIndex }))
  const savedContainers = snapshot.containers
  snapshot.containers = researchAssessment.metrics.containers.map(c => ({ ...savedContainers[c.sourceIndex], id: c.canonicalId }))
}
assert(snapshot.validation?.valid === true, '仅能生成已有有效性校验通过的方案快照报告')
assert(Array.isArray(snapshot.containers) && snapshot.containers.length > 0, '方案没有集装箱')
assert(snapshot.totalContainers === snapshot.containers.length, '方案总柜数与明细不一致')
assert(snapshot.validation.errors.length === 0, '方案仍有校验错误')
const placed = snapshot.containers.flatMap(c => c.items)
const unpacked = snapshot.unpackedItems ?? []
assert(unpacked.length === 0 && placed.length === snapshot.totalItems, '报告只能交付完整方案；不得把已装子集合法写成完整装载')
const ids = [...placed.map(p => p.item.id), ...unpacked.map(item => item.id)]
assert(new Set(ids).size === ids.length, '货物编号重复，无法交付逐件清单')
assert(ids.length === snapshot.totalItems, '总件数与已装、未装件数之和不一致')
const unitWeight = placed.reduce((n, p) => n + p.item.weight, 0)
const containerWeight = snapshot.containers.reduce((n, c) => n + c.totalWeight, 0)
assert(Math.abs(unitWeight - containerWeight) < .001, '逐件重量与分柜汇总重量不一致')
const renderStats = snapshot.containers.map(c => ({ id: c.id, capacityMm3: c.dimensions.length * c.dimensions.width * c.dimensions.height, outerMm3: c.items.reduce((n,p) => n + p.actualDimensions.length * p.actualDimensions.width * p.actualDimensions.height, 0), materialMm3: c.items.reduce((n,p) => n + solidVolume(p.item), 0), partsCount: c.items.reduce((n,p) => n + solidBounds(p).length, 0) }))
const materialTotal = renderStats.reduce((n,c) => n + c.materialMm3, 0), outerTotal = renderStats.reduce((n,c) => n + c.outerMm3, 0), capacityTotal = renderStats.reduce((n,c) => n + c.capacityMm3, 0)
if (research) {
  assert(Math.abs(materialTotal - audit.totals.materialModelVolumeMm3) < .1 && Math.abs(outerTotal - audit.totals.outerEnvelopeVolumeMm3) < .1, '结果体积与完整源清单不一致')
  assert(Math.abs(materialTotal - researchAssessment.metrics.totalSolidVolumeMm3) < .1, '结果指标与报告实际实体几何不一致')
}
for (const c of snapshot.containers) {
  assert(Math.abs(c.items.reduce((n, p) => n + p.item.weight, 0) - c.totalWeight) < .001, `柜 ${c.id} 重量不一致`)
  for (const p of c.items) {
    assert(p.item.quantity === 1, `货物 ${p.item.id} 不是独立单件`)
    assert([p.position.x, p.position.y, p.position.z, p.actualDimensions.length, p.actualDimensions.width, p.actualDimensions.height, p.item.weight].every(Number.isFinite), `货物 ${p.item.id} 有非法数值`)
    assert([p.actualDimensions.length, p.actualDimensions.width, p.actualDimensions.height].every(n => n > 0), `货物 ${p.item.id} 有非法占用尺寸`)
    const partsVolume = solidBounds(p).reduce((n,b) => n + (b.max.x-b.min.x)*(b.max.y-b.min.y)*(b.max.z-b.min.z), 0)
    assert(Math.abs(partsVolume - solidVolume(p.item)) < .1, `货物 ${p.item.id} 梁体积与空腔模型不一致`)
  }
}

// Carry a bounded copy of the computation records into the offline artifact.
// Full local logs remain linked with their hashes when a record is too large.
const calculationRecords = []
if (research) {
  const recordPaths = [...new Set([
    path.join(path.dirname(input), 'ledger.jsonl'),
    path.join(path.dirname(input), 'summary.json'),
    path.join(path.dirname(input), 'supervision.json'),
    path.join(path.dirname(input), 'final-audit.json'),
    path.join(path.dirname(input), 'final-audit.md'),
    path.join(path.dirname(input), 'README.md'),
    path.join(root, 'docs/OPTIMIZATION_V3_RECAP.md'),
    path.join(root, 'data/reconstruction/workflow.json'),
    path.join(root, 'data/reconstruction/process-journal.jsonl'),
  ])]
  for (const recordPath of recordPaths) {
    let bytes
    try { bytes = await readFile(recordPath) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    const text = bytes.toString('utf8'), complete = bytes.length <= 250000
    calculationRecords.push({ path: path.relative(root, recordPath), sha256: hash(bytes), bytes: bytes.length, embeddedComplete: complete, embeddedFormat: complete ? 'full-text' : 'tail-text', embeddedText: complete ? text : text.slice(-120000), href: path.relative(path.dirname(output), recordPath).split(path.sep).map(encodeURIComponent).join('/') })
  }
}
const computationSummary = research ? {
  sourceFile: path.relative(root, input), sourceSha256: hash(inputBytes),
  execution: inputDocument.execution ?? inputDocument.provenance.execution ?? null,
  finalCandidateRecord: inputDocument.record ?? null,
  engineFiles: inputDocument.provenance.engineFiles ?? inputDocument.execution?.engineFiles ?? [],
  engineSha256: inputDocument.provenance.engineSha256 ?? inputDocument.execution?.engineSha256 ?? null,
  globalOptimalityProven: false,
  containerOrder: researchContainerOrder,
  records: calculationRecords,
} : undefined

// Preserve every original source field once, rather than repeating each grouped
// source row for tens of identical units. The downloadable JSON is self-contained.
const solution = structuredClone(snapshot)
const sourceRecords = {}, recordKeys = new Map()
for (const item of [...solution.containers.flatMap(c => c.items.map(p => p.item)), ...solution.unpackedItems]) {
  const raw = item.rawData ?? {}, key = JSON.stringify(raw)
  let ref = recordKeys.get(key)
  if (!ref) { ref = `source-${recordKeys.size + 1}`; recordKeys.set(key, ref); sourceRecords[ref] = raw }
  item.rawData = { _sourceSheet: raw._sourceSheet ?? '', _sourceRow: raw._sourceRow ?? '', _sourceRecordRef: ref }
}
solution.sourceRecords = sourceRecords
solution.reportExport = { sourceFile: path.relative(root, input), generatedAt, rawDataReference: 'Each item.rawData._sourceRecordRef points to complete original fields in sourceRecords.', dimensionsUnit: 'mm', weightUnit: 'kg', axes: 'x=length, y=width, z=height' }
solution.reportExport.inputSha256 = hash(inputBytes)
if (research) solution.researchMetadata = { provenance: inputDocument.provenance, metrics: researchAssessment.metrics, pdfComparison: researchComparison, computation: computationSummary, containerOrder: researchContainerOrder, scope: snapshot.validation.scope ?? 'geometry-and-source-rules', rendering: 'actual solid beams with confirmed cavities, not opaque envelopes' }
const oldModel = snapshot.containers.every(c => c.dimensions.length === 12032 && c.dimensions.width === 2352 && c.dimensions.height === 2698)
const criterion = research ? contract.config.supportCriterion ?? 'area-80-centroid' : null
const supportLabel = criterion === 'centroid-hull' ? '仅取消额外80%承托比例；正实体投影及重心凸包保留' : '旧版80%实体承托比例及重心凸包'
const comparisonHeadline = !research ? '' : researchComparison.fewerContainers ? '已达到减少柜数指标' : researchComparison.canClaimTailConsolidation ? '已达到完整11柜实质缩尾指标' : '完整研究基线，改善目标尚未达到'
const comparisonConclusion = !research ? '' : researchComparison.fewerContainers
  ? `全量货物独立校验通过，柜数由原11柜减至${snapshot.totalContainers}柜；这是当前找到的改善方案，尚无全局最优证明。`
  : researchComparison.canClaimTailConsolidation
    ? `全量货物在11柜内独立校验通过，配货集合发生变化，排序后的尾柜实体体积小于原排序最低${fmt(researchCalibration.pdfBaseline.permutationInvariantMinSolidVolumeMm3 / 1e9, 9)}m³；满足实质缩尾指标，不能只归因于重新编号。`
    : snapshot.totalContainers > 11
      ? `全量货物使用${snapshot.totalContainers}柜，比原11柜更多；即使末柜较小，也没有达到改善目标。`
      : '当前完整方案尚未同时满足真实重分配与尾柜小于原排序最低柜的条件，不能仅靠重新编号主张改善。'
const modelLabel = research ? `PDF校准研究：11600 × 2250 × 2500 mm / W02指定2560 mm例外 / 真实框梁与空腔 / 三轴5 mm / ${supportLabel} / pdf-clearance-projection` : oldModel ? '旧口径快照：12032 × 2352 × 2698 mm / 实心外包络 / 未计 5 mm 间隙' : '保存的可行方案快照（建模条件以源方案为准）'
const modelBanner = oldModel
  ? '本报告复现当前保存的完整 11 柜可行解，使用较大的 12032 × 2352 × 2698 mm 内尺寸、实心外包络，未计 5 mm 间隙。它尚未按新确认的 PDF 口径（11600 × 2250 × 2500 mm、W02 高度例外、居中空腔、三轴 5 mm 间隙）完成比较，不能据此声称达到减少柜数或同11柜实质缩尾、提高前10柜瓶颈的目标。'
  : research ? `本报告为校准口径下的当前程序研究结果：${snapshot.totalContainers}柜、${placed.length}件完整装载；原人工PDF为11柜。${comparisonConclusion} 采用11600×2250×2500mm净空、W02指定高度例外、居中空腔和三轴5mm几何预留。${supportLabel}，源载荷、同源叠放、件数、方向及孔内授权限制均保留。前10柜以最低实体占比评估瓶颈，不能用平均值替代。上下投影叠放及载荷传递属于pdf-clearance-projection假设，未新增实物垫料，实际承托接触尚未得到证明。` : '本报告是已保存方案的可视化快照。请以源数据记录的箱型、间隙与实体规则为准；搜索结果不保证全局最优，不能只按柜数认定符合另一套人工装柜条件。'

const colors = ['#487b86', '#b28d4e', '#9a80aa', '#73936b', '#bc7667', '#638cbd', '#808c51', '#6f9d92', '#9f7e6d', '#78829f']
const categories = [...new Set(placed.map(p => p.item.category))].sort()
const shade = (hex, factor) => '#' + hex.slice(1).match(/../g).map(part => Math.round(Math.min(255, parseInt(part, 16) * factor)).toString(16).padStart(2, '0')).join('')
const categoryCSS = categories.map((_, i) => { const base = colors[i % colors.length]; return `.iso-scene .c${i}{--base:${base};--shade:${shade(base, .81)};--top:${shade(base, 1.17)}}` }).join('')
const symbols = [], fallbackViews = []
for (const [ci, c] of snapshot.containers.entries()) {
  const { length: L, width: W, height: H } = c.dimensions
  const projected = (x, y, z) => [x * .9 - y * .6, x * .22 + y * .35 - z * .95]
  const corners = Array.from({ length: 8 }, (_, i) => projected(i & 1 ? L : 0, i & 2 ? W : 0, i & 4 ? H : 0))
  const minX = Math.min(...corners.map(p => p[0])), maxX = Math.max(...corners.map(p => p[0]))
  const minY = Math.min(...corners.map(p => p[1])), maxY = Math.max(...corners.map(p => p[1]))
  const scale = Math.min(1000 / (maxX - minX), 470 / (maxY - minY))
  const project = (x, y, z) => { const p = projected(x, y, z); return `${((p[0] - minX) * scale + 28).toFixed(1)},${((p[1] - minY) * scale + 18).toFixed(1)}` }
  const polygon = vertices => 'M' + vertices.map(v => project(...v)).join('L') + 'Z'
  const floor = polygon([[0,0,0],[L,0,0],[L,W,0],[0,W,0]])
  const cargo = c.items.flatMap((p, itemIndex) => solidBounds(p).map((bounds, partIndex) => ({ p, itemIndex, partIndex, bounds }))).sort((a,b) => {
    const depth = part => (part.bounds.min.x+part.bounds.max.x)/2 + (part.bounds.min.y+part.bounds.max.y)/2 + (part.bounds.min.z+part.bounds.max.z)*.75
    return depth(a)-depth(b)
  }).map(({ p, itemIndex, partIndex, bounds }) => {
    const { x, y, z } = bounds.min, l = bounds.max.x-x, w = bounds.max.y-y, h = bounds.max.z-z
    const s = polygon([[x+l,y,z],[x+l,y+w,z],[x+l,y+w,z+h],[x+l,y,z+h]])
    const f = polygon([[x,y+w,z],[x+l,y+w,z],[x+l,y+w,z+h],[x,y+w,z+h]])
    const t = polygon([[x,y,z+h],[x+l,y,z+h],[x+l,y+w,z+h],[x,y+w,z+h]])
    return `<g class="c c${categories.indexOf(p.item.category)}" data-item="${itemIndex}" data-part="${partIndex}"><title>${escape(p.item.name)} · ${escape(p.item.id)} · 实体梁${partIndex+1}</title><path class="s" d="${s}"/><path class="f" d="${f}"/><path class="t" d="${t}"/></g>`
  }).join('')
  const edges = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]].map(([a,b]) => {
    const v = i => [i & 1 ? L : 0, i & 2 ? W : 0, i & 4 ? H : 0]
    return `M${project(...v(a))}L${project(...v(b))}`
  }).join('')
  symbols.push(`<symbol id="iso-container-${ci}" viewBox="0 0 1056 525"><path class="floor" d="${floor}"/>${cargo}<path class="frame" d="${edges}"/><text x="28" y="518">封闭端 · X 长 / Y 宽 / Z 高 · mm</text><text x="980" y="518">门端</text></symbol>`)
  fallbackViews.push(`<svg class="iso-scene" viewBox="0 0 1056 525" role="img" aria-label="集装箱 ${ci + 1} 全部货物三维示意图"><use href="#iso-container-${ci}"/></svg>`)
}
const warnings = [...new Set([...(snapshot.validation.warnings ?? []), ...(snapshot.notes ?? [])])]
const warningList = warnings.map(warning => `<li>${escape(warning)}</li>`).join('')
const sourceList = `<dl class="source-list"><div><dt>方案编号</dt><dd><code>${escape(snapshot.id)}</code></dd></div><div><dt>算法 / 本候选用时</dt><dd>${escape(snapshot.algorithm)} / ${fmt(snapshot.computeTime / 1000, 2)} 秒</dd></div><div><dt>源方案文件</dt><dd><code>${escape(path.relative(root, input))}</code></dd></div><div><dt>货物来源</dt><dd>Excel 3 张工作表 · ${Object.keys(sourceRecords).length} 行源记录 · ${fmt(snapshot.totalItems, 0)} 个独立货物</dd></div><div><dt>单位 / 坐标</dt><dd>尺寸、坐标 mm；重量 kg；X=长，Y=宽，Z=高</dd></div><div><dt>报告生成</dt><dd>${escape(generatedLocal)}（北京时间）</dd></div></dl>`
const printContainers = snapshot.containers.map((c, ci) => `<section class="print-container"><h2>集装箱 ${String(ci + 1).padStart(2, '0')} · ${escape(c.id)}</h2><p class="print-meta">${c.items.length} 件 · ${fmt(c.totalWeight, 2)} kg · 内尺寸 ${c.dimensions.length} × ${c.dimensions.width} × ${c.dimensions.height} mm · 实体 ${pct(renderStats[ci].materialMm3/renderStats[ci].capacityMm3)} / 包络 ${pct(renderStats[ci].outerMm3/renderStats[ci].capacityMm3)} · 载重 ${pct(c.weightUtilization)}${c.centerOfGravity ? ` · 重心 X/Y/Z：${fmt(c.centerOfGravity.x, 2)} / ${fmt(c.centerOfGravity.y, 2)} / ${fmt(c.centerOfGravity.z, 2)} mm` : ''}</p><svg class="iso-scene print-scene" viewBox="0 0 1056 525" role="img" aria-label="集装箱 ${ci + 1} 三维示意图"><use href="#iso-container-${ci}"/></svg><table class="print-manifest"><thead><tr><th>序号 · 名称 / 货物编号</th><th>分类 / 来源行</th><th>实际长 × 宽 × 高 mm</th><th>X / Y / Z mm</th><th>方向 / 旋转</th><th>重量 kg</th></tr></thead><tbody>${c.items.map((p, i) => `<tr><td>${i + 1}. ${escape(p.item.name)}<br><small>${escape(p.item.id)}</small></td><td>${escape(p.item.category)}<br><small>${escape(p.item.rawData?._sourceSheet ?? '')} / ${escape(p.item.rawData?._sourceRow ?? '')}</small></td><td>${exact(p.actualDimensions.length)} × ${exact(p.actualDimensions.width)} × ${exact(p.actualDimensions.height)}</td><td>${exact(p.position.x)} / ${exact(p.position.y)} / ${exact(p.position.z)}</td><td>${escape(p.orientation)} / ${p.rotation}°</td><td>${exact(p.item.weight)}</td></tr>`).join('')}</tbody></table><p class="print-end">本柜 ${c.items.length} 件全部列示；打印序号仅用于清单检索，不代表现场装载工序。${escape(modelLabel)}</p></section>`).join('')
const css = await readFile(path.join(root, 'src/reports/report.css'), 'utf8')
const bundle = await build({ entryPoints: [path.join(root, 'src/reports/static-report.ts')], bundle: true, minify: true, format: 'iife', platform: 'browser', target: 'es2020', write: false, legalComments: 'inline' })
const researchSummary = research ? { provenance: inputDocument.provenance, metrics: researchAssessment.metrics, pdfComparison: researchComparison, computation: computationSummary, contract: { schemaVersion: contract.schemaVersion, status: contract.status, modelVersion: contract.modelVersion, support: contract.support, config: contract.config }, baseline: { sourceFiles: audit.sourceFiles, totals: audit.totals, containers: audit.containers, tailBaseline: audit.tailBaseline, comparisonReference: researchCalibration.pdfBaseline }, rendering: { geometrySha256, materialMm3: materialTotal, outerMm3: outerTotal, cavityUnits: placed.filter(p => p.item.cavity).length, partsCount: renderStats.reduce((n,c) => n + c.partsCount, 0), containers: renderStats } } : undefined
const reportData = JSON.stringify({ solution, generatedAt, sourceFile: path.relative(root, input), modelLabel, fallbackViews, research: researchSummary }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
let html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>伊拉克 Villa23 · 当前可行装箱方案 / ${snapshot.totalContainers} 柜 ${placed.length} 件</title><style>${css}${categoryCSS}</style></head><body><svg class="svg-library iso-scene" aria-hidden="true"><defs>${symbols.join('')}</defs></svg><div class="page"><header class="masthead"><div class="brand"><span class="brand-mark">▤</span><span>集装箱运筹 · 方案报告</span></div><div class="masthead-meta"><span>IRAQ VILLA23 / BLOCK A</span><span class="offline-tag">离线完整报告</span></div></header><section class="hero"><div><div class="eyebrow">Packing Plan · Saved Feasible Solution</div><h1>当前可行装箱方案<br><span>${snapshot.totalContainers} 柜，${fmt(placed.length, 0)} 件完整装载</span></h1><p class="hero-description">逐柜查看三维布局，点击货物定位并核对装载坐标。完整明细与原始来源已包含在本文件中，可离线使用、打印及导出。</p></div><div class="actions no-print"><button id="download-json" type="button">导出完整 JSON</button><button id="download-csv" type="button">导出清单 CSV</button><button id="print-report" type="button" class="primary">打印 / 保存 PDF</button></div></section><aside class="model-banner"><span class="banner-icon">ⓘ</span><div><strong>当前保存的可行解 · 建模口径说明</strong><p>${escape(modelBanner)}</p></div></aside><section class="stats" aria-label="方案汇总"><div class="stat"><div class="stat-label">集装箱数量</div><div class="stat-number">${snapshot.totalContainers}<span class="unit">柜</span></div><div class="stat-detail">完整可行快照 · 非最优证明</div></div><div class="stat"><div class="stat-label">已装载货物</div><div class="stat-number">${fmt(placed.length, 0)}<span class="unit">件</span></div><div class="stat-detail">全部单件编号唯一</div></div><div class="stat"><div class="stat-label">未装入货物</div><div class="stat-number">${unpacked.length}<span class="unit">件</span></div><div class="stat-detail">${unpacked.length ? '需另行安排装载' : '与全量货物件数一致'}</div></div><div class="stat"><div class="stat-label">平均体积利用率</div><div class="stat-number">${(snapshot.avgVolumeUtilization * 100).toFixed(2)}<span class="unit">%</span></div><div class="stat-detail">按当前箱型与实心包络计算</div></div><div class="stat"><div class="stat-label">货物总重量</div><div class="stat-number">${(unitWeight / 1000).toFixed(2)}<span class="unit">吨</span></div><div class="stat-detail">${fmt(unitWeight, 2)} kg · 不含箱体</div></div></section><section class="interactive-section" id="viewer"><div class="section-heading"><h2>逐柜三维布局</h2><p>拖动旋转 · 滚轮缩放 · 点击选中货物</p></div><nav id="container-nav" class="container-nav" aria-label="选择集装箱"></nav><div class="workspace"><div class="panel"><div class="viewer-toolbar"><div><h3 id="container-title">集装箱 01</h3><p id="container-metrics">载入当前柜数据</p></div><div class="segmented" role="group" aria-label="视图"><button type="button" class="active" data-view="3d">三维</button><button type="button" data-view="top">俯视</button><button type="button" data-view="side">侧视</button></div></div><div class="viewer-stage"><div id="canvas-host" class="canvas-host"></div><div id="fallback" class="fallback">${fallbackViews[0]}</div><div class="viewer-axis">X 长 · Y 宽 · Z 高 / mm</div></div><div class="viewer-footer"><div class="slider-line"><label for="visibility">显示货物</label><input id="visibility" type="range" min="0" max="${snapshot.containers[0].items.length}" value="${snapshot.containers[0].items.length}"><output id="visible-count">全部显示</output></div><p id="view-note">本图展示保存方案的货物外包络。减小显示件数可查看内部；顺序用于展示，不表示现场装载工序。</p></div><div id="legend" class="legend" aria-label="分类图例"></div></div><aside class="panel side-panel"><div class="detail-block"><div class="side-label">Container Profile</div><h4>箱体内尺寸</h4><p id="dimensions"></p><p>坐标原点位于集装箱内底角。三维展示保持实际长宽高比例。</p></div><div class="detail-block"><h4><span class="gravity-dot"></span>货物重心</h4><p id="gravity"></p><button type="button" id="reset-camera" class="quiet-button">重置视角</button></div><div class="detail-block"><h4>选中货物</h4><div id="selected-item"></div></div></aside></div></section><section class="manifest-section"><div class="section-heading"><h2>具体装柜清单</h2><div class="table-controls"><div class="search"><input id="query" type="search" aria-label="搜索货物名称、编号或分类" placeholder="搜索名称、编号、分类…"></div><select id="table-scope" aria-label="清单范围"><option value="current">当前集装箱</option><option value="all">全部集装箱</option></select></div></div><div class="panel"><div class="table-wrap"><table class="manifest-table"><thead><tr><th>货物名称 / 独立编号</th><th>柜号</th><th>柜内序号</th><th>实际长 × 宽 × 高 / mm</th><th>X / Y / Z / mm</th><th>方向 / 旋转</th><th>重量 / kg</th></tr></thead><tbody id="manifest-body"></tbody></table></div><div class="table-bottom"><span id="row-count"></span><span>点击行可定位货物 · 导出数据保留原始数值精度</span></div></div></section><section class="review-grid"><div class="panel review-card"><h2>校验结果与模型说明</h2><div class="validation-line"><span class="validation-check">✓</span><span class="validation-copy">该快照在其保存时的旧建模口径下校验通过</span></div><ul>${warningList}</ul></div><div class="panel review-card"><h2>数据与计算来源</h2>${sourceList}<table class="model-table"><thead><tr><th>比较条件</th><th>当前报告快照</th><th>新 PDF 对比目标</th></tr></thead><tbody><tr><td>内尺寸 mm</td><td>${snapshot.containers[0].dimensions.length} × ${snapshot.containers[0].dimensions.width} × ${snapshot.containers[0].dimensions.height}</td><td>11600 × 2250 × 2500</td></tr><tr><td>间隙 / 空腔</td><td>未计 5 mm / 实心包络</td><td>三轴 5 mm / 已确认居中空腔</td></tr><tr><td>柜数目标</td><td>${snapshot.totalContainers} 柜完整已保存解</td><td>全量有效优先；少于11柜或同11柜实质缩尾，并提高前10柜瓶颈</td></tr></tbody></table></div></section><section class="print-only"><div class="print-cover-notes"><h2>打印说明与校验范围</h2><p>${escape(modelLabel)}。后附全部 ${snapshot.totalContainers} 个集装箱、${placed.length} 件货物的三维示意与精确清单；尺寸和坐标单位 mm，重量 kg。示意图是保存方案的外包络表现，不表示新空腔及间隙规则已满足。</p><ul>${warningList}</ul><p>源文件：${escape(path.relative(root, input))} · 方案 ${escape(snapshot.id)} · 生成 ${escape(generatedLocal)}（北京时间）。</p></div>${printContainers}</section><footer class="footer"><span>集装箱运筹 · IRAQ VILLA23 BLOCK A · 完整货物清单与离线三维报告</span><span>${escape(generatedLocal)}（北京时间） · ${escape(snapshot.algorithm)} / ${escape(snapshot.id)}</span></footer></div><script id="report-data" type="application/json">${reportData}</script><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`
if (research) {
  const smallest = [...renderStats].sort((a,b) => a.materialMm3-b.materialMm3)[0]
  const metrics = researchAssessment.metrics, reference = researchCalibration.pdfBaseline
  const frontTenBottleneck = metrics.front10MinimumSolidUtilization
  const bottleneckDifference = frontTenBottleneck === null || reference.sortedFirstTenMinimumSolidUtilization === null ? null : frontTenBottleneck - reference.sortedFirstTenMinimumSolidUtilization
  const bottleneckText = frontTenBottleneck === null ? '少于10柜，不适用前10柜指标' : `${pct(frontTenBottleneck)}${bottleneckDifference === null ? '' : `；较原${bottleneckDifference >= 0 ? '+' : ''}${(bottleneckDifference * 100).toFixed(2)}个百分点`}`
  const comparisons = [
    ['柜数', '11 柜', `${snapshot.totalContainers} 柜${snapshot.totalContainers > 11 ? '；多于原方案，尚未改善' : researchComparison.fewerContainers ? '；已减少柜数' : '；保持11柜'}`],
    ['完整货物', '1371 件', `${placed.length} 已装 / ${unpacked.length} 未装`],
    ['外包络总量', `${audit.totals.outerEnvelopeVolumeM3} m³`, `${(outerTotal/1e9).toFixed(9)} m³`],
    ['扣空腔实体总量', `${audit.totals.materialModelVolumeM3} m³`, `${(materialTotal/1e9).toFixed(9)} m³`],
    ['排序尾柜实体（缩尾验收）', `${fmt(reference.permutationInvariantMinSolidVolumeMm3 / 1e9, 9)} m³；排除重新编号`, `${smallest.id} ${(smallest.materialMm3/1e9).toFixed(9)} m³${researchComparison.canClaimTailConsolidation ? '；完整11柜实质缩尾' : snapshot.totalContainers !== 11 ? '；柜数不同，不据此认定11柜缩尾' : '；尚未达到实质缩尾条件'}`],
    ['前10柜最低实体占比（瓶颈）', reference.sortedFirstTenMinimumSolidUtilization === null ? '不适用' : pct(reference.sortedFirstTenMinimumSolidUtilization), bottleneckText],
    ['配货集合变化', '原PDF逐件分柜清单', researchComparison.allocationChanged ? '已跨柜重分配，非仅重新编号' : '分柜集合未改变'],
    ['承托判据', '原表未规定80%比例', `${supportLabel}；源限重与叠放限制保留`],
    ['改善结论', '仅内容/体积经校准，PDF无精确坐标', comparisonConclusion],
  ]
  const comparison = `<section class="panel comparison-section" style="padding:22px;margin:0 0 26px"><h2 style="font-size:18px;margin:0 0 8px">与原人工11柜的同口径对比</h2><p style="font-size:12px;color:#718471">下列统计同时区分包络和实体；${snapshot.totalContainers>11 ? '当前柜数仍多于11，不能用更小的末柜掩盖额外柜数。' : '同柜数时仍须排除重新编号造成的假改善。'} 本报告按实体体积递减展示，前10柜及尾柜与该顺序对应，原保存编号映射保存在导出数据。原编号11柜为${fmt(reference.originalTailSolidVolumeMm3 / 1e9, 9)}m³，仅供参考；缩尾验收使用排序不变的最小柜。三维与离线示意均绘制实际框梁，孔内保持留空。</p><table class="model-table"><thead><tr><th>指标</th><th>原PDF基准</th><th>当前程序研究结果</th></tr></thead><tbody>${comparisons.map(row=>`<tr>${row.map(value=>`<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table><p style="font-size:10px;color:#8a998b">校准审计 SHA-256 ${escape(inputDocument.provenance.auditSha256)}<br>合同 SHA-256 ${escape(inputDocument.provenance.contractSha256)}<br>数据清单 SHA-256 ${escape(inputDocument.provenance.manifestSha256)}</p></section>`
  const computation = `<section class="panel" style="padding:22px;margin:0 0 26px"><h2 style="font-size:18px;margin:0 0 8px">计算过程与复盘记录</h2><p style="font-size:12px">本报告生成时重新从权威货物清单及引用合同独立验算，比较指标也重新计算。当前为已找到的完整方案，未证明全局最优。输入结果 SHA-256：<code>${escape(hash(inputBytes))}</code>。参数、单件移动、拒绝原因和运行记录保存在下列摘要或链接中；大记录只嵌入明确标注的尾部片段。</p><details><summary>当前候选的参数、耗时与执行摘要</summary><pre style="white-space:pre-wrap;max-height:320px;overflow:auto">${escape(JSON.stringify({ execution: computationSummary.execution, finalCandidateRecord: computationSummary.finalCandidateRecord, engineFiles: computationSummary.engineFiles, engineSha256: computationSummary.engineSha256, containerOrder: computationSummary.containerOrder }, null, 2))}</pre></details>${calculationRecords.map(record => `<details><summary>${escape(record.path)} · ${record.embeddedComplete ? '全文已内嵌' : '仅内嵌尾部片段'}</summary><p style="font-size:11px"><a href="${escape(record.href)}">打开原始计算记录</a> · ${fmt(record.bytes, 0)} bytes · SHA-256 ${escape(record.sha256)}</p><pre style="white-space:pre-wrap;max-height:280px;overflow:auto">${escape(record.embeddedText)}</pre></details>`).join('')}</section>`
  html = html.replace('当前可行装箱方案', '校准口径研究结果').replace('<h1>当前可行装箱方案', '<h1>校准口径研究结果')
    .replace('Packing Plan · Saved Feasible Solution', 'Calibrated Research · Geometry & Load Assumptions')
    .replace('当前保存的可行解 · 建模口径说明', comparisonHeadline)
    .replace('完整可行快照 · 非最优证明', `原人工11柜 · 当前${snapshot.totalContainers}柜`)
    .replace(`<div class="stat-label">平均体积利用率</div><div class="stat-number">${(snapshot.avgVolumeUtilization * 100).toFixed(2)}<span class="unit">%</span></div>`, `<div class="stat-label">前10柜最低实体占比</div><div class="stat-number">${frontTenBottleneck === null ? '—' : (frontTenBottleneck * 100).toFixed(2)}<span class="unit">${frontTenBottleneck === null ? '' : '%'}</span></div>`)
    .replace('按当前箱型与实心包络计算', reference.sortedFirstTenMinimumSolidUtilization === null ? '前10柜瓶颈指标不适用' : `原瓶颈 ${pct(reference.sortedFirstTenMinimumSolidUtilization)}；平均实体 ${pct(materialTotal/capacityTotal)}（补充）`)
    .replace('本图展示保存方案的货物外包络。', '本图绘制真实实体框梁及确认空腔，孔内不以实心盒遮盖。')
    .replace('该快照在其保存时的旧建模口径下校验通过', '当前几何与已建模载荷规则校验通过；实际承托未证实')
    .replace('<td>未计 5 mm / 实心包络</td>', '<td>三轴5mm / 真实框梁与孔</td>')
    .replace('示意图是保存方案的外包络表现，不表示新空腔及间隙规则已满足。', '示意图按确认孔几何绘制框梁。采用5mm几何预留和上下投影/载荷假设，未新增实体垫料，实际承托接触尚未证实。')
    .replace('<section class="interactive-section" id="viewer">', comparison + computation + '<section class="interactive-section" id="viewer">')
}
assert(hash(await readFile(geometryPath)) === geometrySha256, '生成过程中几何源码变化，请重新生成以保持3D与SVG一致')
assert((html.match(/id="report-data"/g) ?? []).length === 1, '报告数据节点不唯一')
assert((html.match(/class="print-container"/g) ?? []).length === snapshot.containers.length, '打印柜数不完整')
const domIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
assert(new Set(domIds).size === domIds.length, '报告含重复 DOM 编号')
assert(!/<(?:script|link|img)\b[^>]*(?:src|href)="https?:/i.test(html), '报告包含外部资源，不能离线交付')
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, html, 'utf8')
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), containers: snapshot.containers.length, packed: placed.length, unpacked: unpacked.length, totalWeight: Number(unitWeight.toFixed(2)), sourceRecords: Object.keys(sourceRecords).length, materialVolumeM3: materialTotal/1e9, outerVolumeM3: outerTotal/1e9, physicalParts: renderStats.reduce((n,c)=>n+c.partsCount,0), cavityUnits: placed.filter(p=>p.item.cavity).length, modelLabel }, null, 2))
