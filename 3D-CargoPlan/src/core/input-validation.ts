// #created 11/08/2026
import type { CargoItem, OptimizationConfig } from '../types/packing'
import { DEFAULT_CONFIG } from './optimizer'

const orientations = ['standing', 'lying', 'flat']
const algorithms = ['greedy', 'genetic', 'tabu', 'ant-colony', 'branch-bound', 'hybrid', 'compare']
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function finite(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}
function dimensions(v: unknown): boolean {
  return record(v) && ['length', 'width', 'height'].every(k => finite(v[k], 0.001, 100000))
}

export function validateRequest(body: unknown): { items: CargoItem[]; config: OptimizationConfig; compare: boolean } {
  if (!record(body) || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 5000) {
    throw new Error('items 必须包含 1–5000 个货物单元')
  }
  const ids = new Set<string>()
  for (const [i, item] of body.items.entries()) {
    const label = `第 ${i + 1} 件货物`
    if (!record(item) || typeof item.id !== 'string' || !item.id.trim() || item.id.length > 500 || ids.has(item.id)) throw new Error(`${label} ID 为空、过长或重复`)
    ids.add(item.id)
    if (typeof item.name !== 'string' || !item.name.trim() || typeof item.category !== 'string' || typeof item.colorTag !== 'string') throw new Error(`${label} 缺少名称、分类或颜色标记`)
    if (!record(item.rawData)) throw new Error(`${label} rawData 必须为对象；无原始字段时请提供 {}`)
    if (!dimensions(item.dimensions) || !finite(item.weight, 0, 1000000)) throw new Error(`${label} 的尺寸或重量无效（单位 mm / kg）`)
    if (item.shape !== undefined && !['box','frame','cylinder','coil','pipe'].includes(item.shape as string)) throw new Error(`${label} 货物形状无效`)
    if (item.packaging !== undefined && (!record(item.packaging) || ['envelopeConfirmed','antiRoll'].some(key => item.packaging && (item.packaging as Record<string,unknown>)[key] !== undefined && typeof (item.packaging as Record<string,unknown>)[key] !== 'boolean'))) throw new Error(`${label} 包装确认信息无效`)
    if (item.quantity !== 1) throw new Error(`${label} quantity 必须为 1；请先按数量展开并使用唯一 ID`)
    if (item.unloadStop !== undefined && (!Number.isSafeInteger(item.unloadStop) || (item.unloadStop as number) < 1)) throw new Error(`${label} unloadStop 必须为正整数`)
    if (!Array.isArray(item.allowedOrientations) || item.allowedOrientations.length === 0 || item.allowedOrientations.some(v => !orientations.includes(v))) throw new Error(`${label} 摆放方向无效`)
    if (item.forbiddenOrientations !== undefined && (!Array.isArray(item.forbiddenOrientations) || item.forbiddenOrientations.some(v => !orientations.includes(v)))) throw new Error(`${label} 禁止方向无效`)
    if (item.allowedOrientations.every(v => (item.forbiddenOrientations as unknown[] | undefined)?.includes(v))) throw new Error(`${label} 所有摆放方向均被禁止`)
    if (['canStackOnTop', 'canOffsetStack', 'hasGlass'].some(k => typeof item[k] !== 'boolean')) throw new Error(`${label} 堆叠或玻璃标志无效`)
    if (item.maxStackWeight !== undefined && !finite(item.maxStackWeight, 0, 1000000)) throw new Error(`${label} 顶部承重无效`)
    if (item.maxStackCount !== undefined && (!finite(item.maxStackCount, 0, 5000) || !Number.isInteger(item.maxStackCount))) throw new Error(`${label} 最大叠放件数无效`)
    if (item.stackableWith !== undefined && (!Array.isArray(item.stackableWith) || item.stackableWith.some(v => typeof v !== 'string'))) throw new Error(`${label} 可叠放分类无效`)
    if (item.orientationVerticalAxes !== undefined && (!record(item.orientationVerticalAxes) || Object.entries(item.orientationVerticalAxes).some(([key, value]) => !orientations.includes(key) || !['length', 'width', 'height'].includes(value as string)))) throw new Error(`${label} 方向竖轴映射无效`)
    if (item.cavity !== undefined) {
      const cavity = item.cavity
      if (!record(cavity) || !dimensions(cavity.dimensions) || !record(cavity.offset) || !['x','y','z'].every(axis => finite((cavity.offset as Record<string,unknown>)[axis],0,100000))) throw new Error(`${label} 空腔尺寸或位置无效`)
      const dims = cavity.dimensions as Record<string,number>, offset = cavity.offset as Record<string,number>, outer = item.dimensions as Record<string,number>
      if ([['length','x'],['width','y'],['height','z']].some(([d,p]) => offset[p] + dims[d] > outer[d])) throw new Error(`${label} 空腔超出货物外包尺寸`)
      if (![['length','x'],['width','y'],['height','z']].some(([d,p]) => offset[p] === 0 && dims[d] === outer[d])) throw new Error(`${label} 仅支持贯穿框体的净空，不支持封闭空洞`)
      const lists = [cavity.allowedSourceSheets, cavity.allowedCategories]
      if (lists.every(value => value === undefined) || lists.some(value => value !== undefined && (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || !entry.trim()))) || (cavity.doorOrientation !== undefined && !orientations.includes(cavity.doorOrientation as string))) throw new Error(`${label} 空腔内货物或方向规则无效`)
    }
    if (item.constraints !== undefined) {
      const c = item.constraints
      if (!record(c)) throw new Error(`${label} 条件约束必须为对象`)
      if (c.horizontalRotations !== undefined && (!Array.isArray(c.horizontalRotations) || c.horizontalRotations.length === 0 || c.horizontalRotations.some(v => ![0, 90, 180, 270].includes(v as number)))) throw new Error(`${label} 水平旋转必须是 0、90、180、270 中的非空列表`)
      if (c.mixGroup !== undefined && (typeof c.mixGroup !== 'string' || !c.mixGroup.trim())) throw new Error(`${label} 混装组必须为非空字符串`)
      if (c.onlySameMixGroup !== undefined && typeof c.onlySameMixGroup !== 'boolean') throw new Error(`${label} 同组混装标志无效`)
      if (c.onlySameMixGroup === true && (typeof c.mixGroup !== 'string' || !c.mixGroup.trim())) throw new Error(`${label} 启用同组混装时必须指定混装组`)
      if (c.mustBeOnFloor !== undefined && typeof c.mustBeOnFloor !== 'boolean') throw new Error(`${label} 落地约束无效`)
      if (c.supportedItemsLargestFaceDown !== undefined && typeof c.supportedItemsLargestFaceDown !== 'boolean') throw new Error(`${label} 上件宽面朝下约束无效`)
      if (c.requiresManualReview !== undefined && (!Array.isArray(c.requiresManualReview) || c.requiresManualReview.some(v => typeof v !== 'string'))) throw new Error(`${label} 人工复核说明无效`)
      if (c.orientationRules !== undefined) {
        if (!record(c.orientationRules)) throw new Error(`${label} 方向约束无效`)
        for (const [direction, rule] of Object.entries(c.orientationRules)) {
          if (!orientations.includes(direction) || !record(rule)) throw new Error(`${label} 方向约束无效`)
          for (const key of ['maxStackWeight', 'maxSupportedItemWeight', 'maxStackCount']) if (rule[key] !== undefined && !finite(rule[key], 0, 1000000)) throw new Error(`${label} 条件载荷无效`)
          if (rule.maxStackCount !== undefined && !Number.isInteger(rule.maxStackCount)) throw new Error(`${label} 条件叠放件数必须为整数`)
          if (rule.strictMaxStackWeight !== undefined && typeof rule.strictMaxStackWeight !== 'boolean') throw new Error(`${label} 严格载荷约束无效`)
        }
      }
    }
  }
  if (body.config !== undefined && !record(body.config)) throw new Error('config 必须为对象')
  const supplied = (body.config ?? {}) as Record<string, unknown>
  const algorithm = supplied.algorithm ?? 'compare'
  if (supplied.verticalSupport !== undefined && !['none','5mm-spacer','pdf-clearance-projection'].includes(supplied.verticalSupport as string)) throw new Error('verticalSupport 必须是 none、5mm-spacer 或 pdf-clearance-projection')
  if (supplied.offsetStackScope !== undefined && !['bidirectional','item-only'].includes(supplied.offsetStackScope as string)) throw new Error('offsetStackScope 必须是 bidirectional 或 item-only')
  if (supplied.supportCriterion !== undefined && !['area-80-centroid','centroid-hull'].includes(supplied.supportCriterion as string)) throw new Error('supportCriterion 必须是 area-80-centroid 或 centroid-hull')
  if (supplied.loadingProfile !== undefined && !['villa-pdf', 'custom'].includes(supplied.loadingProfile as string)) throw new Error('未知装载模型')
  if (supplied.unloadingDoor !== undefined && !['x-min', 'x-max'].includes(supplied.unloadingDoor as string)) throw new Error('unloadingDoor 必须为 x-min 或 x-max')
  if (supplied.unloadingDoor && body.items.some(item => item.unloadStop === undefined)) throw new Error('启用站点分析时每件货物都必须提供 unloadStop')
  if (supplied.preventCrossStopStacking !== undefined && typeof supplied.preventCrossStopStacking !== 'boolean') throw new Error('preventCrossStopStacking 必须是布尔值')
  if (supplied.preventCrossStopStacking && !supplied.unloadingDoor) throw new Error('禁止跨站叠放须先启用站点分析')
  if (supplied.clearanceMm !== undefined && (!finite(supplied.clearanceMm, 0, 1000) || supplied.loadingProfile === 'villa-pdf')) throw new Error('clearanceMm 须为 0–1000 mm 且仅用于自定义装载模型')
  if (!algorithms.includes(algorithm as string)) throw new Error('不支持的优化算法')
  const config = {
    ...DEFAULT_CONFIG,
    ...supplied,
    algorithm: algorithm === 'compare' ? 'hybrid' : algorithm,
    weights: { ...DEFAULT_CONFIG.weights, ...(record(supplied.weights) ? supplied.weights : {}) }
  } as OptimizationConfig
  delete config.deadline
  if (supplied.verticalSupport !== undefined && config.loadingProfile !== 'villa-pdf') throw new Error('verticalSupport 仅适用于 villa-pdf 装载模型')
  if (supplied.offsetStackScope !== undefined && config.loadingProfile !== 'villa-pdf') throw new Error('offsetStackScope 仅适用于 villa-pdf 装载模型')
  if (supplied.supportCriterion !== undefined && config.loadingProfile !== 'villa-pdf') throw new Error('supportCriterion 仅适用于 villa-pdf 装载模型')
  if (!dimensions(config.containerDimensions) || !finite(config.containerMaxWeight, 0.001, 1000000)) throw new Error('集装箱内尺寸或额定载重无效')
  if (config.loadingProfile === 'villa-pdf' && (config.containerDimensions.length !== 11600 || config.containerDimensions.width !== 2250 || config.containerDimensions.height !== 2500)) throw new Error('原 PDF 口径必须使用 11600×2250×2500 mm 净空')
  if (!finite(config.timeLimit, 1000, 120000)) throw new Error('timeLimit 必须在 1000–120000 毫秒之间')
  if (!finite(config.populationSize, 2, 100) || !Number.isInteger(config.populationSize) || !finite(config.generations, 1, 500) || !Number.isInteger(config.generations)) throw new Error('种群数须为 2–100、代数须为 1–500 的整数')
  if (!Object.values(config.weights).every(v => finite(v, 0, 100000))) throw new Error('目标权重必须为有效非负数')
  return { items: body.items as CargoItem[], config, compare: algorithm === 'compare' }
}
