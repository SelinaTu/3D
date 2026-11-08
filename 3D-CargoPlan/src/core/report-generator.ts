// #created 11/08/2026
import { writeFileSync } from 'node:fs'
import type { PackingSolution } from '../types/packing'
import { buildSolutionReport, escapeHTML, REPORT_STYLES } from './export-utils'

/** File-based comparison for CLI users, with no unverified cost assumptions. */
export function generateComparisonReport(baseline: PackingSolution, optimized: PackingSolution, outputPath = './comparison-report.html'): void {
  const rows = [
    ['集装箱数量', baseline.containers.length, optimized.containers.length],
    ['已装入件数', baseline.containers.reduce((n, c) => n + c.items.length, 0), optimized.containers.reduce((n, c) => n + c.items.length, 0)],
    ['未装入件数', baseline.unpackedItems.length, optimized.unpackedItems.length],
    ['平均体积利用率', `${(baseline.avgVolumeUtilization * 100).toFixed(2)}%`, `${(optimized.avgVolumeUtilization * 100).toFixed(2)}%`],
    ['平均重量利用率', `${(baseline.avgWeightUtilization * 100).toFixed(2)}%`, `${(optimized.avgWeightUtilization * 100).toFixed(2)}%`],
    ['校验', baseline.validation ? baseline.validation.valid ? '通过' : '未通过' : '未校验', optimized.validation ? optimized.validation.valid ? '通过' : '未通过' : '未校验'],
  ]
  const body = (solution: PackingSolution) => buildSolutionReport(solution).split('<main>')[1].split('</main>')[0]
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>装箱方案对比</title><style>${REPORT_STYLES}</style></head><body><main><h1>装箱方案对比</h1><p>比较 ${escapeHTML(baseline.algorithm)} 与 ${escapeHTML(optimized.algorithm)}。箱数差异仅在相同货物范围、尺寸及约束且全部装入时可用于评估节省；本报告不假设运输价格。</p><table><thead><tr><th>指标</th><th>原方案</th><th>对比方案</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHTML(value)}</td>`).join('')}</tr>`).join('')}</tbody></table><h2>原方案明细</h2>${body(baseline)}<h2>对比方案明细</h2>${body(optimized)}</main></body></html>`
  writeFileSync(outputPath, html, 'utf8')
}
