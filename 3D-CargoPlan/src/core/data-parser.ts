// #created 11/08/2026
import XLSX from './xlsx-adapter'
import type { WorkBook } from 'xlsx'
import type { CargoItem, Dimensions3D, Orientation } from '../types/packing'

export const MAX_CARGO_UNITS = 5000
const ALL_ORIENTATIONS: Orientation[] = ['standing', 'lying', 'flat']
const aliases = {
  id: ['id', '编号', '货物编号', '门窗编号', '玻璃架编号', '辅材箱号'],
  name: ['name', '名称', '货物名称', '构件名称'],
  category: ['category', '分类', '构件分类'],
  length: ['length', 'lengthmm', '长mm', '长度mm', '包装后长mm'],
  width: ['width', 'widthmm', '宽mm', '宽度mm', '包装后宽mm'],
  height: ['height', 'heightmm', '高mm', '高度mm', '包装后高mm'],
  weight: ['weight', 'weightkg', '单重kg', '重量kg', '单重kg/单位'],
  quantity: ['quantity', '数量', '总数量'],
  allowed: ['allowedorientations', '允许方向', '摆放方向'],
  forbidden: ['forbiddenorientations', '禁止方向', '禁止方向/限制'],
  canStack: ['canstackontop', '顶部可放'],
  maxWeight: ['maxstackweight', '顶部最大重量kg', '顶部承重kg'],
  maxCount: ['maxstackcount', '最大叠放件数'],
  stackable: ['stackablewith', '可叠放对象'],
  glass: ['hasglass', '是否带玻璃'],
  offset: ['canoffsetstack', '是否可错位叠放'],
  color: ['colortag', '颜色', '外观颜色胶带标记'],
} satisfies Record<string, string[]>
type Field = keyof typeof aliases
const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[\s()（）_]/g, '')
const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === ''
const aliasSets = Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, new Set(values.map(normalize))])) as Record<Field, Set<string>>

export class CargoImportError extends Error {
  constructor(message: string) { super(message); this.name = 'CargoImportError' }
}

function numberValue(value: unknown, label: string, context: string, positive = false): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value.trim()) : NaN
  if (!Number.isFinite(n) || (positive ? n <= 0 : n < 0)) {
    throw new CargoImportError(`${context}：${label}必须为${positive ? '大于 0' : '大于等于 0'}的有限数值，当前为“${String(value ?? '')}”。`)
  }
  return n
}

function bool(value: unknown, label: string, context: string): boolean {
  if (blank(value)) return false
  const text = normalize(value)
  if (['是', 'true', '1', 'yes', 'y'].includes(text)) return true
  if (['否', 'false', '0', 'no', 'n'].includes(text)) return false
  throw new CargoImportError(`${context}：${label}应为 是/否 或 true/false，当前为“${String(value)}”。`)
}

function orientations(value: unknown, context: string, forbidden = false): Orientation[] {
  if (blank(value)) return forbidden ? [] : ['standing']
  const text = normalize(value)
  if (['不限', '全部', 'all', 'any'].includes(text)) return forbidden ? [] : [...ALL_ORIENTATIONS]
  if (forbidden && ['无', 'none', '倾斜', '禁止倾斜'].includes(text)) return []
  const result: Orientation[] = []
  for (const token of text.split(/[,，、;；/|]+/).filter(Boolean)) {
    const orientation: Orientation | undefined = ['standing', '立放', '正放', '竖放'].includes(token) ? 'standing'
      : ['lying', '侧放', '侧立'].includes(token) ? 'lying' : ['flat', '平放'].includes(token) ? 'flat' : undefined
    if (orientation) result.push(orientation)
    else if (token !== '底部' && token !== '倾斜' && token !== '禁止倾斜') {
      throw new CargoImportError(`${context}：无法识别${forbidden ? '禁止' : '摆放'}方向“${token}”，可用 standing/lying/flat 或 立放/侧放/平放。`)
    }
  }
  if (!forbidden && !result.length) throw new CargoImportError(`${context}：至少需要一个允许的摆放方向。`)
  return [...new Set(result)]
}

/** Parse a direct numeric limit, never coerce unrecognized prose to zero/NaN. */
function numericLimit(value: unknown, kind: 'weight' | 'count', context: string): number | undefined {
  if (blank(value)) return undefined
  const text = String(value).trim()
  if (/不限|不限制|无限|unlimited/i.test(text)) return undefined
  if (/[-−]\s*\d/.test(text) || (kind === 'count' && /\d+\.\d+\s*件/.test(text))) throw new CargoImportError(`${context}：${kind === 'weight' ? '顶部承重' : '最大叠放件数'}必须是非负${kind === 'count' ? '整数' : '数值'}。`)
  const match = kind === 'weight'
    ? text.match(/(?:总重量|最大重量|承重)[^\d]*(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)/i) ?? text.match(/^\s*(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)?\s*$/i)
    : text.match(/(?:小于等于|不超过|最多|≤|<=)?\s*(\d+)\s*件/) ?? text.match(/^\s*(\d+)\s*$/)
  if (!match) {
    if (!/[\u4e00-\u9fff]/.test(text)) throw new CargoImportError(`${context}：${kind === 'weight' ? '顶部承重' : '最大叠放件数'}必须是非负${kind === 'count' ? '整数' : '数值'}或“不限”。`)
    return undefined
  }
  const n = numberValue(match[1], kind === 'weight' ? '顶部承重 (kg)' : '最大叠放件数', context)
  if (kind === 'count' && !Number.isInteger(n)) throw new CargoImportError(`${context}：最大叠放件数必须为整数。`)
  return n
}

function parseConstraints(get: (field: Field) => unknown, raw: Record<string, unknown>, context: string): Pick<CargoItem, 'constraints' | 'maxStackWeight' | 'maxStackCount' | 'stackableWith'> {
  const constraints: NonNullable<CargoItem['constraints']> = {}
  const manual: string[] = []
  const weightText = String(get('maxWeight') ?? '').trim()
  const countText = String(get('maxCount') ?? '').trim()
  const stackText = String(get('stackable') ?? '').trim()
  let maxStackWeight: number | undefined, maxStackCount: number | undefined
  const rules: NonNullable<NonNullable<CargoItem['constraints']>['orientationRules']> = {}
  for (const [kind, text] of [['weight', weightText], ['count', countText]] as const) {
    if (!text) continue
    // Some source weight cells are actually count rules; preserve their meaning.
    const actualKind = kind === 'weight' && /\d+\s*件/.test(text) && !/kg|公斤|千克/i.test(text) ? 'count' : kind
    const limit = numericLimit(text, actualKind, context)
    if (limit === undefined) {
      if (!/不限|不限制|无限|unlimited/i.test(text) && !/^如侧放或平放，可叠放自身相同物品$/.test(text)) manual.push(`${kind === 'weight' ? '顶部最大重量' : '最大叠放件数'}：${text}`)
      continue
    }
    // Numeric template count is the number above this supporting unit. Source
    // prose counts a complete pile, so subtract the supporting unit itself.
    const normalizedLimit = actualKind === 'count' && /件/.test(text) ? Math.max(0, limit - 1) : limit
    const affected: Orientation[] = text.startsWith('如')
      ? (['standing', 'lying', 'flat'] as Orientation[]).filter(direction => text.slice(0, text.indexOf('，') < 0 ? text.length : text.indexOf('，')).includes(direction === 'standing' ? '立放' : direction === 'lying' ? '侧放' : '平放'))
      : []
    if (text.startsWith('如') && !affected.length) { manual.push(text); continue }
    if (affected.length) {
      affected.forEach(direction => {
        rules[direction] ??= {}
        if (actualKind === 'weight') { rules[direction]!.maxStackWeight = limit; rules[direction]!.strictMaxStackWeight = /小于(?!等于)/.test(text) }
        else rules[direction]!.maxStackCount = Math.min(rules[direction]!.maxStackCount ?? Infinity, normalizedLimit)
      })
    } else if (actualKind === 'weight') maxStackWeight = limit
    else maxStackCount = normalizedLimit
  }
  const itemWeight = stackText.match(/单件不超过\s*(\d+(?:\.\d+)?)\s*kg/i)
  const totalWeight = stackText.match(/总重量不超过\s*(\d+(?:\.\d+)?)\s*kg/i)
  if (totalWeight) maxStackWeight = Math.min(maxStackWeight ?? Infinity, Number(totalWeight[1]))
  if (itemWeight) ALL_ORIENTATIONS.forEach(direction => { rules[direction] = { ...rules[direction], maxSupportedItemWeight: Number(itemWeight[1]) } })
  if (Object.keys(rules).length) constraints.orientationRules = rules
  if (String(get('allowed') ?? '').includes('底部')) constraints.mustBeOnFloor = true
  let stackableWith: string[] | undefined
  if (/非自身相同物品/.test(stackText)) stackableWith = ['@not-self']
  else if (/只能叠放自身相同物品|顶部可叠放自身相同物品/.test(stackText)) stackableWith = ['@self']
  else if (stackText && !/顶部可放置单件|顶部可混放/.test(stackText)) {
    if (/^(?:@self|@not-self)$/.test(stackText)) stackableWith = [stackText]
    else if (!/[。且]|可放|只能|物品|顶部|放置|叠放|不能|要求/.test(stackText)) stackableWith = stackText.split(/[,，、;；]/).map(s => s.trim()).filter(Boolean)
    else manual.push(`可叠放对象：${stackText}`)
  }
  // Confirmed by the user on 2026-10-16: "宽面" means the upper item's
  // largest-area face, rather than a fixed original axis or named side.
  if (/宽面向下/.test(stackText)) constraints.supportedItemsLargestFaceDown = true
  const remarks = String(raw['装柜备注'] ?? raw['备注'] ?? '')
  if (/尽量靠柜门/.test(remarks)) raw._packingNotes = ['原表“尽量靠柜门”为软偏好，当前未优化近门位置。']
  else if (remarks && !/空腔|有利于|并排入柜/.test(remarks)) manual.push(`装柜备注：${remarks}`)
  if (manual.length) constraints.requiresManualReview = manual
  return { maxStackWeight, maxStackCount, stackableWith, constraints: Object.keys(constraints).length ? constraints : undefined }
}

/** User-confirmed normalization of the three source cavity profiles. */
function confirmedCavity(raw: Record<string, unknown>, outer: Dimensions3D): CargoItem['cavity'] {
  if (raw['内部可放'] !== '是' || raw['构件名称'] !== '框') return undefined
  const originalVoid = ['内部净空长mm', '内部净空宽mm', '内部净空高mm'].map(field => Number(raw[field]))
  const matches = (id: string, dimensions: number[], voidDimensions: number[]) => raw['门窗编号'] === id
    && [outer.length, outer.width, outer.height].every((n, i) => n === dimensions[i])
    && originalVoid.every((n, i) => n === voidDimensions[i])
  let dimensions: Dimensions3D, allowedSourceSheets: string[], doorOrientation: Orientation | undefined
  if (matches('W02', [3030, 2560, 160], [1200, 160, 2200])) {
    dimensions = { length: 1200, width: 2200, height: 160 }; allowedSourceSheets = ['门窗', '辅材']; doorOrientation = 'lying'
  } else if (matches('W01', [6600, 990, 210], [790, 3000, 210])) {
    dimensions = { length: 3000, width: 790, height: 210 }; allowedSourceSheets = ['门窗', '辅材']; doorOrientation = 'lying'
  } else if (matches('W01', [2094, 1674, 110], [1200, 1600, 110])) {
    dimensions = { length: 1200, width: 1600, height: 110 }; allowedSourceSheets = ['辅材']
  } else {
    raw._packingNotes = [...(Array.isArray(raw._packingNotes) ? raw._packingNotes : []), '该货物空腔未经确认，按完整外包络装载，不使用内部空腔。']
    return undefined
  }
  raw._cavityConfirmation = { confirmedBy: 'user', confirmedOn: '2026-10-16', position: 'centered in original dimension coordinates', sourceFieldsPreserved: true }
  return { dimensions, offset: { x: (outer.length - dimensions.length) / 2, y: (outer.width - dimensions.width) / 2, z: (outer.height - dimensions.height) / 2 }, allowedSourceSheets, ...(doorOrientation ? { doorOrientation } : {}) }
}

/** Parse all cargo sheets, retaining every source field and the physical row. */
export function parseExcelWorkbook(workbook: WorkBook): CargoItem[] {
  const items: CargoItem[] = []
  let totalUnits = 0
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, blankrows: true })
    if (!rows.some(row => row.some(value => !blank(value)))) continue
    const headerIndex = rows.findIndex(row => (['length', 'width', 'height', 'weight', 'quantity'] as Field[])
      .every(field => row.some(value => aliasSets[field].has(normalize(value)))))
    if (headerIndex < 0) throw new CargoImportError(`工作表“${sheetName}”：找不到有效表头。需要 长/宽/高 (mm)、单重 (kg)、数量；支持下载模板和原始中文清单。`)
    const headers = rows[headerIndex].map(value => String(value ?? '').trim())
    for (const field of ['length', 'width', 'height', 'weight', 'quantity'] as Field[]) {
      if (headers.filter(header => aliasSets[field].has(normalize(header))).length > 1) throw new CargoImportError(`工作表“${sheetName}”第 ${headerIndex + 1} 行：${field} 对应多列，无法确定应使用哪一列。`)
    }
    const columns = Object.fromEntries((Object.keys(aliases) as Field[]).map(field => [field, headers.findIndex(header => aliasSets[field].has(normalize(header)))])) as Record<Field, number>
    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]
      if (row.every(blank)) continue
      const context = `工作表“${sheetName}”第 ${rowIndex + 1} 行`
      const get = (field: Field) => columns[field] < 0 ? undefined : row[columns[field]]
      const rawData: Record<string, unknown> = {}
      headers.forEach((header, index) => { if (header) rawData[header] = row[index] ?? null })
      rawData._sourceSheet = sheetName; rawData._sourceRow = rowIndex + 1
      if (normalize(rawData['是否计入本批']) === '否') throw new CargoImportError(`${context}：标记为“不计入本批”，请在导入前移除此行或确认改为“是”。`)
      const quantity = numberValue(get('quantity'), '数量', context, true)
      if (!Number.isInteger(quantity)) throw new CargoImportError(`${context}：数量必须为正整数。`)
      totalUnits += quantity
      if (totalUnits > MAX_CARGO_UNITS) throw new CargoImportError(`${context}：展开后数量超过 ${MAX_CARGO_UNITS} 件上限，请拆分批次。`)
      const namePart = String(get('name') ?? '').trim()
      const sourceId = String(get('id') ?? '').trim()
      if (!sourceId && !namePart) throw new CargoImportError(`${context}：缺少货物名称或编号。`)
      const allowedOrientations = orientations(get('allowed'), context)
      const forbiddenOrientations = orientations(get('forbidden'), context, true)
      if (allowedOrientations.every(value => forbiddenOrientations.includes(value))) throw new CargoImportError(`${context}：允许方向全部被禁止，无法装箱。`)
      const dimensions = { length: numberValue(get('length'), '长度 (mm)', context, true), width: numberValue(get('width'), '宽度 (mm)', context, true), height: numberValue(get('height'), '高度 (mm)', context, true) }
      items.push({
        id: `${sheetName}:${sourceId || namePart}:r${rowIndex + 1}`,
        name: [sourceId, namePart].filter(Boolean).join(' '),
        category: String(get('category') || namePart || '未分类'),
        dimensions, cavity: confirmedCavity(rawData, dimensions),
        weight: numberValue(get('weight'), '单重 (kg)', context), quantity,
        allowedOrientations, forbiddenOrientations: forbiddenOrientations.length ? forbiddenOrientations : undefined,
        // The source W02 note explicitly says 侧放 yields height=2560 (its W).
        // Window dimensions describe a flat package, unlike upright glass racks.
        orientationVerticalAxes: headers.includes('门窗编号') ? { standing: 'length', lying: 'width', flat: 'height' } : undefined,
        canStackOnTop: bool(get('canStack'), '顶部可放', context),
        ...parseConstraints(get, rawData, context),
        hasGlass: bool(get('glass'), '是否带玻璃', context), canOffsetStack: bool(get('offset'), '是否可错位叠放', context),
        colorTag: String(get('color') || '默认'), rawData,
      })
    }
  }
  if (!items.length) throw new CargoImportError('文件中没有可导入的货物记录。')
  return items
}

/** Browser entry point always returns individually identified units. */
export function parseExcelBuffer(data: ArrayBuffer): CargoItem[] {
  try { return expandCargoItems(parseExcelWorkbook(XLSX.read(data, { type: 'array' }))) }
  catch (error) { if (error instanceof CargoImportError) throw error; throw new CargoImportError(`无法读取 Excel 文件：${error instanceof Error ? error.message : String(error)}`) }
}

/** Node compatibility entry point; call expandCargoItems for individual units. */
export function parseExcelData(filePath: string): CargoItem[] {
  // SheetJS ESM intentionally has no filesystem provider. Node 20.16+ exposes
  // builtins synchronously, avoiding an fs import in the shared browser module.
  if (typeof process === 'undefined' || typeof process.getBuiltinModule !== 'function') throw new CargoImportError('文件路径导入需要 Node.js 20.16+；浏览器请使用 parseExcelBuffer。')
  const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
  return parseExcelWorkbook(XLSX.read(fs.readFileSync(filePath), { type: 'buffer' }))
}

export function expandCargoItems(items: CargoItem[]): CargoItem[] {
  const total = items.reduce((sum, item) => sum + item.quantity, 0)
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_CARGO_UNITS) throw new CargoImportError(`货物总数量必须为不超过 ${MAX_CARGO_UNITS} 的非负整数。`)
  const ids = new Set<string>()
  return items.flatMap(item => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new CargoImportError(`货物“${item.name}”数量必须为正整数。`)
    return Array.from({ length: item.quantity }, (_, index) => {
      const id = item.quantity === 1 ? item.id : `${item.id}:u${index + 1}`
      if (ids.has(id)) throw new CargoImportError(`货物编号重复：“${id}”。`)
      ids.add(id)
      return { ...item, id, dimensions: { ...item.dimensions }, quantity: 1 }
    })
  })
}

export interface CargoStatistics {
  totalItems: number
  totalWeight: number
  totalVolume: number
  categories: Map<string, number>
  averageDimensions: { length: number; width: number; height: number }
}

export function calculateStatistics(items: CargoItem[]): CargoStatistics {
  const categories = new Map<string, number>()
  let totalItems = 0, totalWeight = 0, totalVolume = 0, length = 0, width = 0, height = 0
  for (const item of items) {
    const count = item.quantity
    totalItems += count; totalWeight += item.weight * count
    totalVolume += item.dimensions.length * item.dimensions.width * item.dimensions.height * count
    length += item.dimensions.length * count; width += item.dimensions.width * count; height += item.dimensions.height * count
    categories.set(item.category, (categories.get(item.category) ?? 0) + count)
  }
  return { totalItems, totalWeight, totalVolume, categories, averageDimensions: { length: totalItems ? length / totalItems : 0, width: totalItems ? width / totalItems : 0, height: totalItems ? height / totalItems : 0 } }
}
