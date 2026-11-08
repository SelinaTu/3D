#!/usr/bin/env node
// #created 11/08/2026
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import * as XLSXModule from 'xlsx'

const XLSX = XLSXModule.default ?? XLSXModule
const root = fileURLToPath(new URL('../', import.meta.url))
const options = { pdf: 'data/reference/manual-11-container-baseline.pdf', excel: 'data/sample-cargo.xlsx', normalized: 'data/demo-items.json', output: 'data/calibration', report: 'docs/SOURCE_BASELINE_CALIBRATION.md' }
const argv = process.argv.slice(2)
if (argv.includes('--help')) {
  console.log('node scripts/audit-source-baseline.mjs [--pdf file.pdf] [--excel file.xlsx] [--normalized items.json] [--output directory] [--report report.md]')
  process.exit(0)
}
for (let i = 0; i < argv.length; i += 2) {
  const key = argv[i].replace(/^--/, '')
  if (!(key in options) || !argv[i + 1]) throw new Error(`未知或缺少参数：${argv[i]}，使用 --help 查看用法`)
  options[key] = argv[i + 1]
}
for (const key of Object.keys(options)) options[key] = path.resolve(root, options[key])
const assert = (condition, message) => { if (!condition) throw new Error(`校准失败：${message}`) }
const near = (a, b, tolerance = .000001) => Math.abs(a - b) <= tolerance
const round = (n, digits = 12) => Number(n.toFixed(digits))
const sum = (array, f) => array.reduce((n, value) => n + f(value), 0)
const volume = d => d.length * d.width * d.height
const number = value => Number(String(value).replaceAll(',', ''))
const physicalKey = (dimensions, weight) => [dimensions.length, dimensions.width, dimensions.height, weight].map(n => Number(n).toFixed(6)).join('|')
const sourceRef = (sheet, row) => `${sheet}:${row}`
const relative = file => path.relative(root, file)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const money = n => n.toFixed(2)
function poppler(command, args) {
  try { return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) }
  catch (error) { throw new Error(`无法执行 ${command}。需要已安装的 Poppler，且 PDF 路径可读。${error.message}`) }
}
function expandNumbers(value) {
  const result = []
  for (const token of String(value).replace(/^辅材箱/, '').split(/[、,，]/)) {
    const match = token.trim().match(/^(\d+)(?:[-~～](\d+))?$/)
    assert(match, `无法识别箱号表达式“${value}”中的“${token}”`)
    const first = Number(match[1]), last = Number(match[2] ?? match[1])
    assert(last >= first && last - first < 5000, `箱号范围非法：${value}`)
    for (let n = first; n <= last; n++) result.push(n)
  }
  return result
}
function compareCounts(a, b) {
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort()
  return keys.filter(key => (a.get(key) ?? 0) !== (b.get(key) ?? 0)).map(key => ({ physicalKey: key, left: a.get(key) ?? 0, right: b.get(key) ?? 0, difference: (a.get(key) ?? 0) - (b.get(key) ?? 0) }))
}
const increment = (map, key, count) => map.set(key, (map.get(key) ?? 0) + count)

const [pdfBytes, excelBytes, normalizedBytes] = await Promise.all([readFile(options.pdf), readFile(options.excel), readFile(options.normalized)])
const pdfInfo = poppler('pdfinfo', [options.pdf])
const pageCount = Number(pdfInfo.match(/^Pages:\s+(\d+)/m)?.[1])
assert(pageCount === 22, `本校准模板针对 22 页原始基线，实际 ${pageCount} 页`)
assert(/Page size:\s+1224 x 792 pts/.test(pdfInfo), 'PDF 页面尺寸与已审核表格区域不符，不能套用裁剪位置')
const pdfText = poppler('pdftotext', ['-layout', options.pdf, '-'])
const pages = pdfText.split('\f').slice(0, pageCount)
assert(pages.length === 22, 'PDF 页面文本提取不完整')
const evidence = { netDimensions: [], spacing: [], heightException: [], cavityPosition: [], widthCenter: [] }
for (const [i, page] of pages.entries()) {
  for (const originalLine of page.split('\n')) {
    const line = originalLine.trim().replace(/\s+/g, ' ')
    if (/建模净空\s+11600\s*×\s*2250\s*×\s*2500\s*mm/.test(line)) evidence.netDimensions.push({ page: i + 1, quote: line })
    if (/间隙：玻璃架\s*0\s*\/\s*其他\s*5\s*mm/.test(line)) evidence.spacing.push({ page: i + 1, quote: line })
    if (/W02框高\s*2560\s*mm专项例外/.test(line)) evidence.heightException.push({ page: i + 1, quote: line })
    if (/孔位为居中示意；以实测为准/.test(line)) evidence.cavityPosition.push({ page: i + 1, quote: line })
    if (/1125\s*mm/.test(line)) evidence.widthCenter.push({ page: i + 1, quote: line })
  }
}
assert(evidence.netDimensions.length === 22, '净空证据没有覆盖全部 22 页')
assert(evidence.spacing.length === 11, '间距证据没有覆盖全部 11 张装柜页')
assert(evidence.heightException.length > 0 && evidence.cavityPosition.length === 11, 'W02 例外或空腔示意证据缺失')

// Read the source workbook independently of the application parser.
const workbook = XLSX.read(excelBytes, { type: 'buffer' })
assert(JSON.stringify(workbook.SheetNames) === JSON.stringify(['门窗', '玻璃架', '辅材']), '原始工作表范围发生变化')
const sourceRows = [], sourceByRef = new Map(), excelCounts = new Map()
for (const sheetName of workbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, blankrows: true })
  const headerIndex = rows.findIndex(row => ['包装后长mm', '包装后宽mm', '包装后高mm', '单重kg/单位', '总数量'].every(field => row.includes(field)))
  assert(headerIndex >= 0, `工作表 ${sheetName} 无法识别必要表头`)
  const headers = rows[headerIndex]
  for (let ri = headerIndex + 1; ri < rows.length; ri++) {
    if (rows[ri].every(value => value === null || value === '')) continue
    const raw = {}
    headers.forEach((header, ci) => { if (header) raw[String(header).trim()] = rows[ri][ci] ?? null })
    const dimensions = { length: Number(raw['包装后长mm']), width: Number(raw['包装后宽mm']), height: Number(raw['包装后高mm']) }
    const quantity = Number(raw['总数量']), weightKg = Number(raw['单重kg/单位'])
    assert(Number.isInteger(quantity) && quantity > 0 && Number.isFinite(weightKg) && weightKg >= 0 && Object.values(dimensions).every(n => Number.isFinite(n) && n > 0), `${sheetName} 第 ${ri + 1} 行数据非法`)
    assert(raw['是否计入本批'] === '是', `${sheetName} 第 ${ri + 1} 行不是已明确计入批次的货物`)
    assert(near(quantity * weightKg, Number(raw['总重kg']), .005), `${sheetName} 第 ${ri + 1} 行单重与总重不一致`)
    const row = { ref: sourceRef(sheetName, ri + 1), sheet: sheetName, row: ri + 1, sourceId: String(raw['门窗编号'] ?? raw['玻璃架编号'] ?? raw['辅材箱号']), component: String(raw['构件名称']), category: String(raw['构件分类'] ?? raw['构件名称']), quantity, weightKg, dimensions, physicalKey: physicalKey(dimensions, weightKg), raw, normalizedIds: [], cavity: null }
    sourceRows.push(row); sourceByRef.set(row.ref, row); increment(excelCounts, row.physicalKey, quantity)
  }
}
assert(sourceRows.length === 90, `Excel 有效源行应为 90，实际 ${sourceRows.length}`)
const normalized = JSON.parse(normalizedBytes.toString('utf8'))
assert(Array.isArray(normalized) && normalized.length === 1371, '规范化数据不是完整 1371 个单件')
assert(new Set(normalized.map(item => item.id)).size === normalized.length, '规范化货物 ID 重复')
const confirmedCavityProfiles = {
  '门窗:16': { dimensions: { length: 1200, width: 2200, height: 160 }, offset: { x: 915, y: 180, z: 0 }, allowedSourceSheets: ['门窗', '辅材'], doorOrientation: 'lying' },
  '门窗:21': { dimensions: { length: 1200, width: 1600, height: 110 }, offset: { x: 447, y: 37, z: 0 }, allowedSourceSheets: ['辅材'] },
  '门窗:23': { dimensions: { length: 3000, width: 790, height: 210 }, offset: { x: 1800, y: 100, z: 0 }, allowedSourceSheets: ['门窗', '辅材'], doorOrientation: 'lying' }
}
const normalizedCounts = new Map(), normalizedSourceDifferences = [], normalizedById = new Map()
for (const item of normalized) {
  assert(item.quantity === 1, `${item.id} 不是单件展开数据`)
  const ref = sourceRef(item.rawData?._sourceSheet, item.rawData?._sourceRow), source = sourceByRef.get(ref)
  assert(source, `${item.id} 引用不存在的源行 ${ref}`)
  const key = physicalKey(item.dimensions, item.weight)
  if (key !== source.physicalKey) normalizedSourceDifferences.push({ id: item.id, ref, kind: 'dimensions-or-weight', expected: source.physicalKey, actual: key })
  for (const [field, value] of Object.entries(source.raw)) if (JSON.stringify(item.rawData[field]) !== JSON.stringify(value)) normalizedSourceDifferences.push({ id: item.id, ref, kind: 'raw-field', field, expected: value, actual: item.rawData[field] })
  const expectedCavity = confirmedCavityProfiles[ref]
  assert(Boolean(item.cavity) === Boolean(expectedCavity), `${item.id} 空腔存在性与用户确认范围不符`)
  if (item.cavity) {
    const { dimensions, offset } = item.cavity
    assert(['length', 'width', 'height'].every(axis => dimensions[axis] === expectedCavity.dimensions[axis]) && ['x', 'y', 'z'].every(axis => offset[axis] === expectedCavity.offset[axis]), `${item.id} 空腔轴向/偏移与用户确认不符`)
    assert(JSON.stringify([...item.cavity.allowedSourceSheets].sort()) === JSON.stringify([...expectedCavity.allowedSourceSheets].sort()) && item.cavity.doorOrientation === expectedCavity.doorOrientation, `${item.id} 空腔嵌入来源或方向规则与用户确认不符`)
    assert(Object.values(dimensions).every(n => Number.isFinite(n) && n > 0), `${item.id} 空腔尺寸非法`)
    assert(offset.x >= 0 && offset.y >= 0 && offset.z >= 0 && offset.x + dimensions.length <= item.dimensions.length && offset.y + dimensions.width <= item.dimensions.width && offset.z + dimensions.height <= item.dimensions.height, `${item.id} 空腔超出原包络`)
    assert(item.rawData._cavityConfirmation?.confirmedBy === 'user' && item.rawData._cavityConfirmation?.confirmedOn === '2026-10-16', `${item.id} 缺少空腔用户确认来源`)
  }
  if (source.normalizedIds.length) assert(JSON.stringify(source.cavity) === JSON.stringify(item.cavity ?? null), `${ref} 同源单件空腔不一致`)
  source.cavity = item.cavity ?? null; source.normalizedIds.push(item.id)
  increment(normalizedCounts, key, 1); normalizedById.set(item.id, item)
}
assert(normalizedSourceDifferences.length === 0, `规范化数据与 Excel 有 ${normalizedSourceDifferences.length} 个字段差异`)
for (const row of sourceRows) assert(row.normalizedIds.length === row.quantity, `${row.ref} 源数量 ${row.quantity} 与规范化展开数量 ${row.normalizedIds.length} 不符`)
const normalizedCountDifferences = compareCounts(excelCounts, normalizedCounts)
assert(normalizedCountDifferences.length === 0, 'Excel 与规范化物理货物集合不一致')

const unitsBySource = new Map(sourceRows.map(row => [row.ref, [...row.normalizedIds]]))
const auxByBoxId = new Map(), racksById = new Map()
for (const row of sourceRows) {
  if (row.sheet === '辅材') {
    const boxIds = expandNumbers(row.raw['全批连续箱号'])
    assert(boxIds.length === row.quantity, `${row.ref} 全批连续箱号与数量不一致`)
    boxIds.forEach((boxId, i) => { assert(!auxByBoxId.has(boxId), `Excel 辅材箱号 ${boxId} 重复`); auxByBoxId.set(boxId, { source: row, id: row.normalizedIds[i] }) })
  } else if (row.sheet === '玻璃架') {
    const rackId = Number(row.sourceId.match(/^(\d+)#玻璃架$/)?.[1])
    assert(Number.isInteger(rackId) && !racksById.has(rackId), `玻璃架编号异常：${row.sourceId}`)
    racksById.set(rackId, row)
  }
}

const manifestRows = [], containers = [], croppedText = [], pdfCounts = new Map(), allocatedIds = new Set(), pdfRackIds = [], pdfAuxIds = []
for (let ci = 0; ci < 11; ci++) {
  const page = ci * 2 + 1, pageText = pages[page - 1]
  const title = pageText.match(/伊拉克Villa23 Block-A｜40HC\/HQ｜(\d+)个包件｜([\d,.]+)\s*kg/)
  assert(title, `PDF 第 ${page} 页声明数量/重量未提取到`)
  const crop = poppler('pdftotext', ['-f', String(page), '-l', String(page), '-x', '830', '-y', '110', '-W', '370', '-H', '560', '-layout', options.pdf, '-'])
  croppedText.push(`PAGE ${page}\n${crop.trim()}`)
  const records = []; let pending
  for (const rawLine of crop.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const count = line.match(/^(.*?)\s+(\d+)(架|件|箱)\s+([\d,.]+)$/)
    if (count) {
      assert(!pending, `第 ${page} 页上一货物行缺少尺寸：${pending?.name}`)
      pending = { name: count[1].trim(), quantity: Number(count[2]), unit: count[3], totalWeightKg: number(count[4]) }; continue
    }
    const dimensions = line.match(/^(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)$/)
    if (dimensions) {
      assert(pending, `第 ${page} 页出现无对应货物的尺寸行：${line}`)
      pending.dimensions = { length: Number(dimensions[1]), width: Number(dimensions[2]), height: Number(dimensions[3]) }
      pending.unitWeightKg = round(pending.totalWeightKg / pending.quantity, 6)
      pending.physicalKey = physicalKey(pending.dimensions, pending.unitWeightKg)
      records.push(pending); pending = undefined
    } else if (pending) pending.name += line.replaceAll(' ', '')
  }
  assert(!pending && records.length > 0, `第 ${page} 页货物明细不完整`)
  const rowIndices = []
  for (const [localIndex, record] of records.entries()) {
    const allocated = [], sourceRefs = new Set()
    const take = (source, id) => {
      assert(source.physicalKey === record.physicalKey, `第 ${page} 页 ${record.name} 的尺寸/单重与 ${source.ref} 不符`)
      assert(!allocatedIds.has(id), `PDF 重复分配货物 ${id}`)
      const queue = unitsBySource.get(source.ref), index = queue.indexOf(id)
      assert(index >= 0, `PDF 引用已消耗的源货物 ${id}`)
      queue.splice(index, 1); allocatedIds.add(id); allocated.push(id); sourceRefs.add(source.ref)
    }
    if (record.unit === '箱') {
      const boxIds = expandNumbers(record.name)
      assert(boxIds.length === record.quantity, `第 ${page} 页 ${record.name} 箱号数量与明细数量不符`)
      for (const boxId of boxIds) { const link = auxByBoxId.get(boxId); assert(link, `PDF 辅材箱号 ${boxId} 无源记录`); take(link.source, link.id); pdfAuxIds.push(boxId) }
      record.absoluteBoxIds = boxIds
    } else if (record.unit === '架') {
      const rackId = Number(record.name.match(/^(\d+)#玻璃架$/)?.[1]), source = racksById.get(rackId)
      assert(source && record.quantity === 1, `第 ${page} 页玻璃架名称/数量不符：${record.name}`)
      take(source, source.normalizedIds[0]); pdfRackIds.push(rackId); record.rackId = rackId
    } else {
      let candidates = sourceRows.filter(row => row.sheet === '门窗' && row.physicalKey === record.physicalKey)
      if (candidates.length > 1) candidates = candidates.filter(row => record.name.includes(row.sourceId))
      assert(candidates.length === 1, `第 ${page} 页 ${record.name} 无唯一门窗源行：${candidates.map(row => row.ref).join(', ')}`)
      const source = candidates[0], available = unitsBySource.get(source.ref)
      assert(available.length >= record.quantity, `第 ${page} 页 ${record.name} 超出源数量`)
      for (const id of available.slice(0, record.quantity)) take(source, id)
    }
    const items = allocated.map(id => normalizedById.get(id))
    assert(near(sum(items, item => item.weight), record.totalWeightKg, .005), `第 ${page} 页 ${record.name} 重量与规范化单件不一致`)
    const outerVolumeMm3 = sum(items, item => volume(item.dimensions)), cavityVolumeMm3 = sum(items, item => item.cavity ? volume(item.cavity.dimensions) : 0)
    const row = { index: manifestRows.length + 1, containerNumber: ci + 1, page, rowWithinContainer: localIndex + 1, ...record, sourceRefs: [...sourceRefs], normalizedIds: allocated, outerEnvelopeVolumeMm3: outerVolumeMm3, cavityVolumeMm3, materialModelVolumeMm3: outerVolumeMm3 - cavityVolumeMm3 }
    manifestRows.push(row); rowIndices.push(row.index); increment(pdfCounts, record.physicalKey, record.quantity)
  }
  const cRows = manifestRows.filter(row => row.containerNumber === ci + 1)
  const totalItems = sum(cRows, row => row.quantity), weightKg = round(sum(cRows, row => row.totalWeightKg), 6)
  const outerEnvelopeVolumeMm3 = sum(cRows, row => row.outerEnvelopeVolumeMm3), cavityVolumeMm3 = sum(cRows, row => row.cavityVolumeMm3)
  assert(totalItems === Number(title[1]) && near(weightKg, number(title[2]), .005), `第 ${page} 页明细合计与页头声明不一致`)
  const sideGroups = [...pages[page].matchAll(/(\d+)个包件\s*\/\s*([\d,.]+)\s*kg/g)].map(match => ({ totalItems: Number(match[1]), weightKg: number(match[2]) }))
  assert(sideGroups.length === 2 && sum(sideGroups, side => side.totalItems) === totalItems && near(sum(sideGroups, side => side.weightKg), weightKg, .005), `第 ${page + 1} 页左右爆炸图与装柜页不一致`)
  containers.push({ containerNumber: ci + 1, manifestPage: page, explosionPage: page + 1, manifestRowCount: cRows.length, manifestRowIndices: rowIndices, totalItems, categoryCounts: { windows: sum(cRows.filter(row => row.unit === '件'), row => row.quantity), glassRacks: sum(cRows.filter(row => row.unit === '架'), row => row.quantity), auxiliaryBoxes: sum(cRows.filter(row => row.unit === '箱'), row => row.quantity) }, weightKg, declaredItems: Number(title[1]), declaredWeightKg: number(title[2]), outerEnvelopeVolumeMm3, outerEnvelopeVolumeM3: round(outerEnvelopeVolumeMm3 / 1e9), cavityVolumeMm3, cavityVolumeM3: round(cavityVolumeMm3 / 1e9), materialModelVolumeMm3: outerEnvelopeVolumeMm3 - cavityVolumeMm3, materialModelVolumeM3: round((outerEnvelopeVolumeMm3 - cavityVolumeMm3) / 1e9), outerEnvelopeUtilization: outerEnvelopeVolumeMm3 / 65250000000, materialModelUtilization: (outerEnvelopeVolumeMm3 - cavityVolumeMm3) / 65250000000, explosionSidesInTextOrder: sideGroups })
}
assert(manifestRows.length === 191, `PDF 分柜汇总行应为 191，实际 ${manifestRows.length}`)
const pdfExcelDifferences = compareCounts(excelCounts, pdfCounts), pdfNormalizedDifferences = compareCounts(normalizedCounts, pdfCounts)
assert(pdfExcelDifferences.length === 0 && pdfNormalizedDifferences.length === 0, 'PDF、Excel、规范化数据的物理货物多重集合不同')
assert(allocatedIds.size === 1371 && [...unitsBySource.values()].every(queue => queue.length === 0), 'PDF 未覆盖全部源货物或存在重复分配')
assert(pdfRackIds.length === 30 && new Set(pdfRackIds).size === 30 && Array.from({ length: 30 }, (_, i) => i + 1).every(id => pdfRackIds.includes(id)), '玻璃架 1-30 范围不完整')
assert(pdfAuxIds.length === 145 && new Set(pdfAuxIds).size === 145 && Array.from({ length: 145 }, (_, i) => i + 1).every(id => pdfAuxIds.includes(id)), '辅材箱号 1-145 范围不完整')
const totals = { containers: containers.length, sourceRows: sourceRows.length, pdfManifestRows: manifestRows.length, uniquePhysicalKeys: excelCounts.size, totalItems: normalized.length, weightKg: round(sum(normalized, item => item.weight), 6), outerEnvelopeVolumeMm3: sum(normalized, item => volume(item.dimensions)), cavityUnits: normalized.filter(item => item.cavity).length, cavityVolumeMm3: sum(normalized, item => item.cavity ? volume(item.cavity.dimensions) : 0) }
totals.materialModelVolumeMm3 = totals.outerEnvelopeVolumeMm3 - totals.cavityVolumeMm3
totals.outerEnvelopeVolumeM3 = round(totals.outerEnvelopeVolumeMm3 / 1e9); totals.cavityVolumeM3 = round(totals.cavityVolumeMm3 / 1e9); totals.materialModelVolumeM3 = round(totals.materialModelVolumeMm3 / 1e9)
assert(totals.totalItems === 1371 && totals.cavityUnits === 230 && near(totals.weightKg, 134777.37) && near(totals.outerEnvelopeVolumeMm3, 590112711447, .01) && near(totals.cavityVolumeMm3, 94364400000, .01), '总量、重量或空腔体积偏离已确认基准')
const checks = { pdfExcelPhysicalMultisetDifferenceCount: pdfExcelDifferences.length, pdfNormalizedPhysicalMultisetDifferenceCount: pdfNormalizedDifferences.length, excelNormalizedPhysicalMultisetDifferenceCount: normalizedCountDifferences.length, normalizedSourceFieldDifferenceCount: normalizedSourceDifferences.length, unallocatedSourceUnits: sum([...unitsBySource.values()], queue => queue.length), duplicateAllocatedIds: sum(manifestRows, row => row.normalizedIds.length) - allocatedIds.size, missingGlassRackNumbers: [], duplicateGlassRackNumbers: [], missingAuxiliaryBoxNumbers: [], duplicateAuxiliaryBoxNumbers: [], eachContainerHeaderTotalsMatchManifest: true, eachExplosionPageTotalsMatchManifest: true, allAssertionsPassed: true }
let generatedAt = new Date().toISOString()
const originalTail = containers.at(-1)
const sortedLowest = [...containers].sort((a, b) => a.materialModelVolumeMm3 - b.materialModelVolumeMm3 || a.containerNumber - b.containerNumber)[0]
const tailBaseline = {
  originalTail: { containerNumber: originalTail.containerNumber, totalItems: originalTail.totalItems, weightKg: originalTail.weightKg, outerEnvelopeVolumeMm3: originalTail.outerEnvelopeVolumeMm3, cavityVolumeMm3: originalTail.cavityVolumeMm3, materialModelVolumeMm3: originalTail.materialModelVolumeMm3, outerEnvelopeVolumeM3: originalTail.outerEnvelopeVolumeM3, cavityVolumeM3: originalTail.cavityVolumeM3, materialModelVolumeM3: originalTail.materialModelVolumeM3, firstTenMaterialModelVolumeM3: round((totals.materialModelVolumeMm3 - originalTail.materialModelVolumeMm3) / 1e9), firstTenMaterialDensity: (totals.materialModelVolumeMm3 - originalTail.materialModelVolumeMm3) / (10 * 65250000000) },
  sortedLowest: { originalContainerNumber: sortedLowest.containerNumber, totalItems: sortedLowest.totalItems, weightKg: sortedLowest.weightKg, outerEnvelopeVolumeMm3: sortedLowest.outerEnvelopeVolumeMm3, cavityVolumeMm3: sortedLowest.cavityVolumeMm3, materialModelVolumeMm3: sortedLowest.materialModelVolumeMm3, outerEnvelopeVolumeM3: sortedLowest.outerEnvelopeVolumeM3, cavityVolumeM3: sortedLowest.cavityVolumeM3, materialModelVolumeM3: sortedLowest.materialModelVolumeM3, otherTenMaterialModelVolumeM3: round((totals.materialModelVolumeMm3 - sortedLowest.materialModelVolumeMm3) / 1e9), otherTenMaterialDensity: (totals.materialModelVolumeMm3 - sortedLowest.materialModelVolumeMm3) / (10 * 65250000000) },
  comparisonRule: '同时比较原第11柜与按实体体积排序后的原最小柜。仅重新编号/排序不算改进；需要实际重新分配且独立几何及已建模约束校验通过，尾柜显著减少、前10柜实体密度提高。10柜是更优结果，但不是唯一成功标准。'
}
const sourceFiles = [{ role: 'pdf', path: relative(options.pdf), sha256: sha256(pdfBytes), bytes: pdfBytes.length }, { role: 'excel', path: relative(options.excel), sha256: sha256(excelBytes), bytes: excelBytes.length }, { role: 'normalized-manifest', path: relative(options.normalized), sha256: sha256(normalizedBytes), bytes: normalizedBytes.length }]
const calibration = {
  schemaVersion: 1, status: 'passed', phase: 'source-calibration-only', generatedAt, sourceFiles, manifest: { path: relative(options.normalized), sha256: sha256(normalizedBytes) },
  inputs: { pdf: { path: relative(options.pdf), sha256: sha256(pdfBytes), bytes: pdfBytes.length, pages: pageCount, originalReference: '/Users/lege/笔记/乐志亮的笔记/研发课题/运筹空间/样例/伊拉克Villa23-Block-A-11柜-装柜及左右爆炸图-V2-2.pdf' }, excel: { path: relative(options.excel), sha256: sha256(excelBytes), bytes: excelBytes.length, sheets: workbook.SheetNames }, normalized: { path: relative(options.normalized), sha256: sha256(normalizedBytes), bytes: normalizedBytes.length } },
  method: { pdfExtractor: (spawnSync('pdftotext', ['-v'], { encoding: 'utf8' }).stderr ?? '').split('\n')[0], manifestCropPointsAt72Dpi: { x: 830, y: 110, width: 370, height: 560 }, sourceHeaderDetection: 'required field names, no fixed header row', physicalMultisetKey: 'source L/W/H mm and unit kg, each rounded to 6 decimal places', unitIdentity: 'glass racks by rack number; auxiliary boxes by complete-batch box number; interchangeable windows by unique source row and quantity expansion order', weightsToleranceKg: .005, volumesUnit: 'mm3 (m3 fields also provided)' },
  pdfConditions: { netDimensionsMm: { length: 11600, width: 2250, height: 2500 }, standardContainerVolumeMm3: 65250000000, spacingTextMm: { glassRacks: 0, otherCargo: 5 }, heightException: { cargo: '门窗第16行 W02框', ceilingMm: 2560 }, evidence, notEstablishedByPdfText: ['5mm间距分别施加到哪些轴、墙边、孔壁及承托接触处。', '竖向5mm间隙是否由隔垫/垫木填补，以及隔垫几何与承托载荷如何建模。', '每件货物的三维坐标、孔位实测偏移、精确实体接触与受力路径。', '额定载重上限；项目28000kg配置不是从该PDF文字中提取。'] },
  userConfirmedNormalization: { confirmedOn: '2026-10-16', supportMode: 'pdf-clearance-projection', supportConfirmation: { userInstruction: '参考PDF如果没有就不用', spacerMaterialAdded: false, projectedSupportAcrossClearance: true, proofOfPhysicalContact: false }, conditions: ['以PDF净空11600×2250×2500mm为比较基准，W02指定货物顶部可到2560mm。', '5mm间距适用于X/Y/Z三轴；这是用户确认，不是PDF自身明确的文字解释。', '三组空腔居中并按指定原始尺寸坐标归一；原表轴序不统一。', '上件“宽面朝下”指该上件自身面积最大的面朝下。', '用户指示隔垫参考PDF、没有就不用；PDF未注明隔垫，因此不新增物理垫料，以5mm几何预留和上下投影叠放/载荷口径继续。'], cavityProfiles: sourceRows.filter(row => row.cavity).map(row => ({ sourceRef: row.ref, sourceId: row.sourceId, quantity: row.quantity, originalDimensions: row.dimensions, originalCavityFields: { length: row.raw['内部净空长mm'], width: row.raw['内部净空宽mm'], height: row.raw['内部净空高mm'] }, normalizedCavity: row.cavity })), verticalSupportBoundary: '用户已选择pdf-clearance-projection：保留PDF几何5mm预留，按上下投影判断叠放并传递载荷，不新增未见于PDF的实体隔垫。这是已确认的几何建模假设，不证明5mm空气间隔形成实际接触。严格接触、无隔垫条件下推得的19柜下界不适用于该原题口径。' },
  totals, sourceSheetTotals: workbook.SheetNames.map(sheet => { const rows = sourceRows.filter(row => row.sheet === sheet); return { sheet, sourceRows: rows.length, totalItems: sum(rows, row => row.quantity), weightKg: round(sum(rows, row => row.quantity * row.weightKg), 6), outerEnvelopeVolumeMm3: sum(rows, row => row.quantity * volume(row.dimensions)), cavityVolumeMm3: sum(rows, row => row.quantity * (row.cavity ? volume(row.cavity.dimensions) : 0)) } }),
  checks, differences: { pdfVsExcel: pdfExcelDifferences, pdfVsNormalized: pdfNormalizedDifferences, excelVsNormalized: normalizedCountDifferences, normalizedSourceFields: normalizedSourceDifferences },
  tailBaseline,
  containers: containers.map(c => ({ ...c, accountingChecks: { itemsMatchHeader: true, weightMatchesHeader: true, explosionTotalsMatch: true, sourceUnitsAllocatedUniquely: true, materialVolumeNonnegative: c.materialModelVolumeMm3 >= 0 }, physicalFeasibilityVerified: false, physicalVerificationBoundary: 'PDF没有逐件机器可重放坐标；本字段只校准体积和内容，不代表实体碰撞/承托校验通过。' })), rows: manifestRows,
  interpretation: ['扣空腔实体体积=每件原外包络体积减其确认孔体积后求和，是刚性框材体积模型，不是实际材料称量体积。', '分柜包络/实体比例是原人工分柜内容的统计，不能代替该分柜三维坐标碰撞和已建模载荷约束校验。', '用户确认采用pdf-clearance-projection，不新增隔垫实体；跨5mm几何预留的投影叠放是建模假设，不是实际承托接触证明。不得将另一严格接触模型的19柜下界套用到本题。', '校准没有重新排列货物、执行装箱优化或声称柜数/尾柜已经改善。']
}
// A repeated successful calibration must not invalidate the hashes embedded in
// research results merely because wall-clock time advanced. Reuse the original
// bytes (including formatting) when only the proposed timestamp differs.
const auditPath = path.join(options.output, 'source-baseline.json')
const withoutGeneratedAt = value => { const copy = { ...value }; delete copy.generatedAt; return copy }
let auditUnchanged = false
try {
  const existingAudit = JSON.parse(await readFile(auditPath, 'utf8'))
  if (typeof existingAudit.generatedAt === 'string' && isDeepStrictEqual(withoutGeneratedAt(existingAudit), withoutGeneratedAt(calibration))) {
    generatedAt = existingAudit.generatedAt
    calibration.generatedAt = generatedAt
    auditUnchanged = true
  }
} catch (error) {
  if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
}
await mkdir(options.output, { recursive: true }); await mkdir(path.dirname(options.report), { recursive: true })
await writeFile(path.join(options.output, 'pdf-text.txt'), pdfText, 'utf8')
await writeFile(path.join(options.output, 'pdf-manifest-text.txt'), croppedText.join('\n\n') + '\n', 'utf8')
if (!auditUnchanged) await writeFile(auditPath, JSON.stringify(calibration, null, 2) + '\n', 'utf8')
const csvRows = [['container', 'manifest_page', 'items', 'windows', 'glass_racks', 'aux_boxes', 'weight_kg', 'outer_volume_m3', 'cavity_volume_m3', 'material_volume_m3', 'outer_density', 'material_density'], ...containers.map(c => [c.containerNumber, c.manifestPage, c.totalItems, c.categoryCounts.windows, c.categoryCounts.glassRacks, c.categoryCounts.auxiliaryBoxes, c.weightKg, c.outerEnvelopeVolumeM3, c.cavityVolumeM3, c.materialModelVolumeM3, c.outerEnvelopeUtilization, c.materialModelUtilization])]
await writeFile(path.join(options.output, 'baseline-containers.csv'), csvRows.map(row => row.join(',')).join('\n') + '\n', 'utf8')
const table = containers.map(c => `| ${c.containerNumber} / ${c.manifestPage} | ${c.totalItems} | ${money(c.weightKg)} | ${c.outerEnvelopeVolumeM3.toFixed(9)} | ${c.cavityVolumeM3.toFixed(9)} | ${c.materialModelVolumeM3.toFixed(9)} | ${(c.materialModelUtilization * 100).toFixed(2)}% |`).join('\n')
const markdown = `# 原题校准结果\n\n生成时间：${generatedAt}。阶段：仅校准数据与规则来源，未开始装箱优化。\n\n## 可重复运行\n\n\`node scripts/audit-source-baseline.mjs\`\n\n需要 Node.js、项目依赖 xlsx 和 Poppler（\`pdftotext\`、\`pdfinfo\`）。默认输入、脚本和输出均在项目目录；用 \`--help\` 查看自定义路径。脚本从原 PDF 重新提取全部页及右侧明细，不依赖临时缓存。任一对账断言失败即非零退出，不写入成功结果。\n\n机器结果：[source-baseline.json](../${relative(path.join(options.output, 'source-baseline.json'))})；分柜 CSV：[baseline-containers.csv](../${relative(path.join(options.output, 'baseline-containers.csv'))})。同目录保存完整 PDF 提取文本及裁剪明细文本以供复核。\n\n## 数据对齐\n\n原 PDF 22 页、11 柜、191 行分柜汇总，与 Excel 3 个工作表/90 行、规范化 1371 个单件完全对应；门窗 1196 件、玻璃架 30 架、辅材 145 箱。82 种尺寸/单重物理键的多重集合差异为 **0**；规范化原字段差异为 **0**；未分配、重复分配货物为 **0**。玻璃架 1-30 和辅材全批箱号 1-145 均完整且唯一。\n\n总重量 **${money(totals.weightKg)} kg**，外包络体积 **${totals.outerEnvelopeVolumeM3.toFixed(9)} m³**，确认空腔体积 **${totals.cavityVolumeM3.toFixed(9)} m³**，扣空腔实体模型体积 **${totals.materialModelVolumeM3.toFixed(9)} m³**。230 件带已确认空腔。\n\n## 原人工分柜数量与体积\n\n标准净空每柜 65.25 m³；实体比例只是该柜清单中框材/其它货物的体积统计，不是可装载性证明。\n\n| 柜号 / PDF明细页 | 件数 | 重量 kg | 外包络 m³ | 空腔 m³ | 扣空腔实体 m³ | 实体体积 / 净空 |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${table}\n| 合计 | ${totals.totalItems} | ${money(totals.weightKg)} | ${totals.outerEnvelopeVolumeM3.toFixed(9)} | ${totals.cavityVolumeM3.toFixed(9)} | ${totals.materialModelVolumeM3.toFixed(9)} | - |\n\n## 原尾柜与排序最小柜\n\n- 原第11柜：${originalTail.totalItems}件、${money(originalTail.weightKg)}kg，外包络${originalTail.outerEnvelopeVolumeM3.toFixed(9)}m³，扣空腔实体${originalTail.materialModelVolumeM3.toFixed(9)}m³；原前10柜实体${tailBaseline.originalTail.firstTenMaterialModelVolumeM3.toFixed(9)}m³，平均实体密度${(tailBaseline.originalTail.firstTenMaterialDensity * 100).toFixed(4)}%。\n- 按实体体积排序后的最小柜实际是原第${sortedLowest.containerNumber}柜：${sortedLowest.totalItems}件、${money(sortedLowest.weightKg)}kg，外包络${sortedLowest.outerEnvelopeVolumeM3.toFixed(9)}m³，扣空腔实体${sortedLowest.materialModelVolumeM3.toFixed(9)}m³；其它10柜实体${tailBaseline.sortedLowest.otherTenMaterialModelVolumeM3.toFixed(9)}m³，平均实体密度${(tailBaseline.sortedLowest.otherTenMaterialDensity * 100).toFixed(4)}%。\n- 只把原最小柜改编号为11不算改善。用户认可同11柜内真实重分配后尾柜显著减少、前10柜实体密度提高为成功；10柜为更优结果。需独立几何及已建模约束校验通过，不能以排序代替优化。\n\n## PDF 原文与用户确认边界\n\n- 净空原文：\`${evidence.netDimensions[0].quote}\`，见第 ${evidence.netDimensions[0].page} 页；全部22页重复验证。\n- 间距原文：\`${evidence.spacing[0].quote}\`，见第 ${evidence.spacing[0].page} 页；11张装柜页重复验证。\n- 高度例外：\`${evidence.heightException[0].quote}\`，见第 ${evidence.heightException[0].page} 页。\n- 孔位置原文：\`${evidence.cavityPosition[0].quote}\`，见第 ${evidence.cavityPosition[0].page} 页。\n\nPDF文字本身没有说明5mm究竟施加到哪些轴、边界和承托处，也不能证明有5mm隔垫。**三轴5mm、三组孔居中/轴向归一、上件最大面积面朝下**来自用户于2026-10-16的后续确认，应与PDF原文分开记录。用户已指示隔垫“参考PDF如果没有就不用”。PDF未注明隔垫，因此采用 **pdf-clearance-projection**：不新增实体垫料，以5mm几何预留、上下投影叠放及载荷传递继续。该模型选择已明确，不再处于待确认状态；它是几何假设，不是实际承托接触证明。严格接触/无隔垫另一模型推得的19柜下界不适用于本题。\n\nPDF没有逐件可重放坐标或实体受力数据；本次只确认题目数据一致、来源条件清楚，没有运行优化，也没有宣称原11柜或新10/9柜已通过新物理模型验证。\n\n## 输入 SHA-256\n\n| 文件 | SHA-256 |\n| --- | --- |\n| \`${relative(options.pdf)}\` | \`${sha256(pdfBytes)}\` |\n| \`${relative(options.excel)}\` | \`${sha256(excelBytes)}\` |\n| \`${relative(options.normalized)}\` | \`${sha256(normalizedBytes)}\` |\n\n机器结果同时保留全部191条明细、其分配的规范化单件ID及原Excel源行，可用于下一阶段逐柜内容基线重放与密度统计。\n`
await writeFile(options.report, markdown, 'utf8')
console.log(JSON.stringify({ success: true, phase: calibration.phase, auditUnchanged, output: relative(path.join(options.output, 'source-baseline.json')), report: relative(options.report), totals, tailBaseline, checks }, null, 2))
