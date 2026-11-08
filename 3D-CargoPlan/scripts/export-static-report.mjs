// #created 11/08/2026
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import assert from 'node:assert/strict'

const reportPath = path.resolve(process.argv[2] ?? 'output/reports/iraq-villa-current-best.html')
const html = await readFile(reportPath, 'utf8')
const match = html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)
assert(match, 'Missing self-contained report data')
const data = JSON.parse(match[1]), solution = data.solution
const sourcePath = path.resolve(data.sourceFile)
const sourceBytes = await readFile(sourcePath)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
assert.equal(sha256(sourceBytes), solution.reportExport.inputSha256, 'Report and candidate differ')
assert(data.research?.metrics.eligible, 'Only a complete independently validated report can be exported')
const items = solution.containers.flatMap((container, i) => container.items.map((placed, j) => ({ container, placed, i, j })))
assert.equal(items.length, 1371)
assert.equal(new Set(items.map(row => row.placed.item.id)).size, items.length)
const audit = JSON.parse(await readFile('data/calibration/source-baseline.json', 'utf8'))
const originalContainer = new Map(audit.rows.flatMap(row => row.normalizedIds.map(id => [id, row.containerNumber])))
const csvCell = value => {
  const raw = String(value ?? '')
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}
const rows = [['当前柜号', '柜内序号', '原PDF柜号', '独立货物ID', '名称', '分类', '源表', '源行', '实际长mm', '实际宽mm', '实际高mm', 'Xmm', 'Ymm', 'Zmm', '方向', '水平旋转度', '单重kg']]
for (const { placed: p, i, j } of items) rows.push([
  i + 1, j + 1, originalContainer.get(p.item.id), p.item.id, p.item.name, p.item.category,
  p.item.rawData._sourceSheet, p.item.rawData._sourceRow,
  p.actualDimensions.length, p.actualDimensions.width, p.actualDimensions.height,
  p.position.x, p.position.y, p.position.z, p.orientation, p.rotation, p.item.weight,
])
const base = reportPath.replace(/\.html?$/i, '')
const jsonBytes = Buffer.from(JSON.stringify(data, null, 2) + '\n')
const csvBytes = Buffer.from('\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n')
await writeFile(`${base}.plan.json`, jsonBytes)
await writeFile(`${base}.manifest.csv`, csvBytes)
const manifest = {
  generatedAt: new Date().toISOString(), sourceFile: data.sourceFile,
  sourceSha256: sha256(sourceBytes), physicalLayoutSha256: data.research.metrics.physicalLayoutSha256,
  metrics: data.research.metrics, pdfComparison: data.research.pdfComparison,
  artifacts: [
    { path: path.basename(reportPath), bytes: Buffer.byteLength(html), sha256: sha256(Buffer.from(html)) },
    { path: path.basename(`${base}.plan.json`), bytes: jsonBytes.length, sha256: sha256(jsonBytes) },
    { path: path.basename(`${base}.manifest.csv`), bytes: csvBytes.length, sha256: sha256(csvBytes), itemRows: items.length },
  ],
  verification: 'Data/source/hash, full identity and offline dependencies checked. Browser visual inspection was unavailable.',
}
await writeFile(`${base}.acceptance.json`, JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ output: base, items: items.length, artifacts: manifest.artifacts }))
