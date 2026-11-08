// #created 11/08/2026
import XLSX from './xlsx-adapter'
import type { WorkBook } from 'xlsx'
import type { CargoItem, PackingSolution } from '../types/packing'

export const escapeHTML = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const percent = (value: number) => `${(value * 100).toFixed(2)}%`
const text = (value: unknown) => value === undefined || value === null ? '未提供' : String(value)
const source = (item: CargoItem) => item.rawData?._sourceSheet ? `${item.rawData._sourceSheet} / 第 ${item.rawData._sourceRow} 行` : '未提供'
const restrictions = (item: CargoItem) => (item.constraints?.requiresManualReview ?? []).join('；')

function download(data: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Chinese headers match the importer; quantities represent identical units. */
export function buildCargoTemplateWorkbook(): WorkBook {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['货物编号', '货物名称', '分类', '长mm', '宽mm', '高mm', '单重kg', '数量', '允许方向', '禁止方向', '顶部可放', '顶部承重kg', '最大叠放件数', '可叠放对象', '是否带玻璃', '是否可错位叠放', '颜色'],
    ['BOX-001', '示例纸箱（导入前可删除）', '纸箱', 600, 400, 300, 12.5, 10, '立放，侧放，平放', '无', '是', 100, 3, '@self', '否', '否', '蓝色'],
  ])
  sheet['!cols'] = Array.from({ length: 17 }, (_, index) => ({ wch: [1, 8, 13].includes(index) ? 30 : 18 }))
  XLSX.utils.book_append_sheet(workbook, sheet, '货物清单')
  return workbook
}

export function downloadCargoTemplate(): void {
  download(XLSX.write(buildCargoTemplateWorkbook(), { bookType: 'xlsx', type: 'array' }), '装箱货物导入模板.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

/** Include original item constraints, provenance, all coordinates, and validation. */
export function buildSolutionJSON(solution: PackingSolution): string {
  return JSON.stringify({ ...solution, exportMetadata: { schemaVersion: 1, generatedAt: new Date().toISOString(), dimensionsUnit: 'mm', weightUnit: 'kg', axes: { x: 'length', y: 'width', z: 'height' } } }, null, 2)
}

export function exportSolutionJSON(solution: PackingSolution): void {
  download(buildSolutionJSON(solution), `packing-${solution.id}.json`, 'application/json;charset=utf-8')
}

/** Numeric coordinates are kept as numeric Excel cells, without rounding. */
export function buildSolutionWorkbook(solution: PackingSolution): WorkBook {
  const workbook = XLSX.utils.book_new()
  const validation = solution.validation
  const summary: unknown[][] = [
    ['装箱方案', solution.id], ['算法', solution.algorithm], ['长度单位', 'mm'], ['重量单位', 'kg'], ['坐标定义', 'x=长 / y=宽 / z=高，原点=集装箱内底角'],
    ['集装箱数', solution.containers.length], ['已装件数', solution.containers.reduce((sum, container) => sum + container.items.length, 0)],
    ['未装件数', solution.unpackedItems.length], ['平均体积利用率', solution.avgVolumeUtilization], ['平均重量利用率', solution.avgWeightUtilization],
    ['计算时间(ms)', solution.computeTime], ['校验', validation ? validation.valid ? '通过' : '未通过' : '未校验'],
    ['方案搜索模式', solution.searchMode ?? '未提供'], ['停止原因', solution.terminationReason ?? '未提供'], ['生成时间(UTC)', new Date().toISOString()], [],
    ['柜号', '内长(mm)', '内宽(mm)', '内高(mm)', '最大载重(kg)', '货物重量(kg)', '体积利用率', '重量利用率', '重心x(mm)', '重心y(mm)', '重心z(mm)'],
    ...solution.containers.map(c => [c.id, c.dimensions.length, c.dimensions.width, c.dimensions.height, c.maxWeight, c.totalWeight, c.volumeUtilization, c.weightUtilization, c.centerOfGravity?.x ?? '', c.centerOfGravity?.y ?? '', c.centerOfGravity?.z ?? '']),
  ]
  const manifest: unknown[][] = [['柜号', '柜内序号', '货物编号', '名称', '分类', '来源表/行', 'x(mm)', 'y(mm)', 'z(mm)', '实际长(mm)', '实际宽(mm)', '实际高(mm)', '方向', '水平旋转(度)', '单重(kg)', '原始长(mm)', '原始宽(mm)', '原始高(mm)', '允许方向', '禁止方向', '顶部可放', '顶部承重(kg)', '最大上叠件数', '可叠放对象', '条件约束(JSON)', '原始字段(JSON)', '方向竖轴规则(JSON)']]
  for (const container of solution.containers) for (const [index, placed] of container.items.entries()) {
    const { item, position, actualDimensions: dims } = placed
    manifest.push([container.id, index + 1, item.id, item.name, item.category, source(item), position.x, position.y, position.z, dims.length, dims.width, dims.height, placed.orientation, placed.rotation, item.weight, item.dimensions.length, item.dimensions.width, item.dimensions.height, item.allowedOrientations.join(', '), item.forbiddenOrientations?.join(', ') ?? '', item.canStackOnTop ? '是' : '否', item.maxStackWeight ?? '', item.maxStackCount ?? '', item.stackableWith?.join(', ') ?? '', JSON.stringify(item.constraints ?? {}), JSON.stringify(item.rawData ?? {}), JSON.stringify(item.orientationVerticalAxes ?? { standing: 'height', lying: 'width', flat: 'length' })])
  }
  const unpacked: unknown[][] = [['货物编号', '名称', '分类', '来源表/行', '长(mm)', '宽(mm)', '高(mm)', '单重(kg)', '待确认条件', '全部条件(JSON)', '原始字段(JSON)'], ...solution.unpackedItems.map(item => [item.id, item.name, item.category, source(item), item.dimensions.length, item.dimensions.width, item.dimensions.height, item.weight, restrictions(item), JSON.stringify(item.constraints ?? {}), JSON.stringify(item.rawData ?? {})])]
  const checks: unknown[][] = [['级别', '详情'], ...(validation ? [['结论', validation.valid ? '通过' : '未通过'], ...validation.errors.map(message => ['错误', message]), ...validation.warnings.map(message => ['警告', message])] : [['警告', '本方案尚未校验']]), ...(solution.notes ?? []).map(message => ['说明', message])]
  for (const [name, rows] of [['方案概览', summary], ['装柜明细', manifest], ['未装入货物', unpacked], ['校验与说明', checks]] as const) {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = Array.from({ length: Math.max(...rows.map(row => row.length)) }, (_, index) => ({ wch: index === 0 ? 24 : index < 6 ? 28 : 18 }))
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  }
  return workbook
}

export function exportSolutionExcel(solution: PackingSolution): void {
  download(XLSX.write(buildSolutionWorkbook(solution), { bookType: 'xlsx', type: 'array' }), `packing-${solution.id}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export const REPORT_STYLES = `body{font:14px/1.6 system-ui,-apple-system,"Microsoft YaHei",sans-serif;color:#172738;margin:32px;background:#fff}main{max-width:1500px;margin:auto}h1{font-size:26px;margin-bottom:4px}h2{margin-top:30px;border-bottom:2px solid #257576;padding-bottom:6px}h3{margin-top:22px}.muted{color:#526478}.status{border-left:5px solid #257576;padding:10px 16px;background:#eff8f7}.error{border-color:#b32727;background:#fff1f1}.metrics{display:flex;gap:25px;flex-wrap:wrap;margin:20px 0}.metrics b{font-size:22px;display:block}table{border-collapse:collapse;width:100%;margin:12px 0;font-size:12px}th,td{border:1px solid #ccd6de;padding:7px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eef3f6}tr{break-inside:avoid}thead{display:table-header-group}.scroll{overflow-x:auto}button{background:#176a6b;color:#fff;border:0;border-radius:6px;padding:10px 18px;cursor:pointer}li{overflow-wrap:anywhere}@media print{body{margin:8mm;font-size:10pt}.no-print{display:none}.scroll{overflow:visible}table{font-size:8pt}h2,h3{break-after:avoid}a{color:inherit;text-decoration:none}}@page{size:A4 landscape;margin:10mm}`

const table = (headers: string[], rows: unknown[][]) => `<div class="scroll"><table><thead><tr>${headers.map(v => `<th>${escapeHTML(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${escapeHTML(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`

export function buildSolutionReport(solution: PackingSolution): string {
  const validation = solution.validation
  const placed = solution.containers.reduce((sum, container) => sum + container.items.length, 0)
  const status = validation ? validation.valid ? '几何与已建模约束校验通过' : '校验未通过，请勿直接执行' : '尚未校验，请先校验方案'
  const messages = [...(validation?.errors ?? []).map(v => `错误：${v}`), ...(validation?.warnings ?? []).map(v => `警告：${v}`), ...(solution.notes ?? []).map(v => `说明：${v}`)]
  const containerSections = solution.containers.map((container, index) => `<section><h2>集装箱 ${index + 1} · ${escapeHTML(container.id)}</h2><p>内部尺寸：${escapeHTML(container.dimensions.length)} × ${escapeHTML(container.dimensions.width)} × ${escapeHTML(container.dimensions.height)} mm · 额定载重 ${escapeHTML(container.maxWeight)} kg · 已装 ${escapeHTML(container.totalWeight)} kg · 体积利用率 ${percent(container.volumeUtilization)}</p><p>重心 (x, y, z)：${container.centerOfGravity ? `${escapeHTML(container.centerOfGravity.x)}, ${escapeHTML(container.centerOfGravity.y)}, ${escapeHTML(container.centerOfGravity.z)} mm` : '未提供'}</p>${table(['序号', '编号 / 来源', '名称 / 分类', 'x (mm)', 'y (mm)', 'z (mm)', '实际长 (mm)', '实际宽 (mm)', '实际高 (mm)', '方向 / 旋转', '重量 (kg)'], container.items.map((p, i) => [i + 1, `${p.item.id} / ${source(p.item)}`, `${p.item.name} / ${p.item.category}`, p.position.x, p.position.y, p.position.z, p.actualDimensions.length, p.actualDimensions.width, p.actualDimensions.height, `${p.orientation} / ${p.rotation}°`, p.item.weight]))}</section>`).join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>装箱方案 ${escapeHTML(solution.id)}</title><style>${REPORT_STYLES}</style></head><body><main><button class="no-print" onclick="window.print()">打印 / 另存为 PDF</button><h1>集装箱装载方案报告</h1><p class="muted">方案 ${escapeHTML(solution.id)} · 算法 ${escapeHTML(solution.algorithm)} · 生成时间 ${escapeHTML(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))}（北京时间）</p><div class="status${validation?.valid ? '' : ' error'}"><strong>${status}</strong><p>未装入 ${solution.unpackedItems.length} 件。只有已装入货物参与几何校验；未装入货物必须另行安排。报告坐标为集装箱内底角原点，x=长、y=宽、z=高，尺寸与坐标单位均为 mm，重量为 kg。</p></div><div class="metrics"><div><b>${solution.containers.length}</b>集装箱</div><div><b>${placed}</b>已装入</div><div><b>${solution.unpackedItems.length}</b>未装入</div><div><b>${percent(solution.avgVolumeUtilization)}</b>平均体积利用率</div><div><b>${percent(solution.avgWeightUtilization)}</b>平均重量利用率</div></div><p>计算时间 ${escapeHTML(solution.computeTime)} ms · 搜索模式 ${escapeHTML(text(solution.searchMode))} · 停止原因 ${escapeHTML(text(solution.terminationReason))}</p><h2>校验、限制与说明</h2>${messages.length ? `<ul>${messages.map(message => `<li>${escapeHTML(message)}</li>`).join('')}</ul>` : '<p>没有记录错误或警告；请确认已运行校验。</p>'}${containerSections}<h2>未装入货物（${solution.unpackedItems.length} 件）</h2>${table(['货物编号 / 来源', '名称', '分类', '长 × 宽 × 高 (mm)', '重量 (kg)', '需要人工确认的条件'], solution.unpackedItems.map(item => [item.id + ' / ' + source(item), item.name, item.category, `${item.dimensions.length} × ${item.dimensions.width} × ${item.dimensions.height}`, item.weight, restrictions(item) || '超出尺寸/约束限制或搜索未找到可行位置，请结合校验说明复核']))}<p class="muted">方向：standing=立放/正放，lying=侧放，flat=平放。实际占用尺寸以表格为准。此报告不含运输价格假设；请结合实际箱型、载荷分布、绑扎和现场条件复核。</p></main></body></html>`
}

export function exportSolutionReport(solution: PackingSolution): void {
  download(buildSolutionReport(solution), `packing-${solution.id}.html`, 'text/html;charset=utf-8')
}

export function printSolutionReport(solution: PackingSolution): void {
  const popup = window.open('', '_blank')
  if (!popup) { exportSolutionReport(solution); return }
  popup.opener = null
  popup.document.open(); popup.document.write(buildSolutionReport(solution)); popup.document.close()
  popup.focus()
  setTimeout(() => popup.print(), 300)
}
