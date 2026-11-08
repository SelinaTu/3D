// #created 11/08/2026
import type { CargoItem, Container, OptimizationConfig, PackingSolution, PlacedItem, ValidationReport } from '../types/packing'
import { normalizeItems } from './greedy-algorithm'
import { analyzeStacking, calculateActualDimensions, maxPlacementHeight, EPSILON, volume, mixingPermitted } from './packing-utils'
import { geometryFor, pairGeometryErrors, solidVolume, solidCentroid } from './solid-geometry'
import { loadingRulesFor } from './loading-profile'
import { cargoReviewReasons } from './cargo-readiness'
import { analyzeUnloading } from './unload-analysis'

/** Independent audit of geometry, restrictions, aggregate numbers and physical-unit identity. */
export function validateSolution(solution: PackingSolution, originalItems: CargoItem[], config?: OptimizationConfig): ValidationReport {
  const errors: string[] = [], warnings: string[] = []
  let originals: CargoItem[]
  try { originals = normalizeItems(originalItems) } catch (e) { return { valid: false, errors: [e instanceof Error ? e.message : String(e)], warnings } }
  if (config?.unloadingDoor && originals.some(item => item.unloadStop === undefined)) errors.push('启用站点分析时每件货物都必须提供 unloadStop')
  const expected = new Map(originals.map(i => [i.id, i])), seen = new Set<string>(), containerIds = new Set<string>()
  let placedCount = 0, usedVolume = 0, totalVolume = 0, totalWeight = 0, avgVolume = 0, avgWeight = 0
  const authoritativeContainers: Container[] = []
  const near = (a: number, b: number) => Number.isFinite(a) && Math.abs(a - b) <= Math.max(EPSILON, Math.abs(b) * 1e-9)
  const account = (item: CargoItem, context: string) => {
    if (!expected.has(item.id)) errors.push(`${context}: 未知货物 ${item.id}`)
    if (seen.has(item.id)) errors.push(`${context}: 货物 ${item.id} 重复计入`)
    seen.add(item.id)
    if (item.quantity !== 1) errors.push(`${item.id}: 方案必须按单件记录 quantity=1`)
  }
  for (const container of solution.containers) {
    if (containerIds.has(container.id)) errors.push(`重复集装箱 ID: ${container.id}`)
    containerIds.add(container.id)
    const dims = container.dimensions
    let rules = container.loadingRules
    if (config) {
      rules = loadingRulesFor(originals,config)
      const actual = container.loadingRules
      const same = !actual && !rules || !!actual && !!rules && actual.clearanceMm === rules.clearanceMm && (actual.glassRacksTouch ?? true) === (rules.glassRacksTouch ?? true) && !!actual.preventCrossStopStacking === !!rules.preventCrossStopStacking && actual.supportGapMm === rules.supportGapMm && actual.supportMechanism === rules.supportMechanism && (actual.offsetStackScope ?? 'bidirectional') === (rules.offsetStackScope ?? 'bidirectional') && (actual.supportCriterion ?? 'area-80-centroid') === (rules.supportCriterion ?? 'area-80-centroid') && Object.keys(actual.heightExceptions).length === Object.keys(rules.heightExceptions).length && Object.entries(rules.heightExceptions).every(([id,height]) => actual.heightExceptions[id] === height)
      if (!same) errors.push(`${container.id}: 装载间隙或高度例外与请求口径不一致`)
    }
    if (rules) {
      if (!Number.isFinite(rules.clearanceMm) || rules.clearanceMm < 0 || rules.clearanceMm > 1000 || ![0,5].includes(rules.supportGapMm)) errors.push(`${container.id}: 装载间隙无效`)
      if (!['none','5mm-spacer','pdf-clearance-projection'].includes(rules.supportMechanism) || rules.supportGapMm !== (rules.supportMechanism === 'none' ? 0 : 5)) errors.push(`${container.id}: 承托机理与间距声明不一致`)
      if (rules.offsetStackScope !== undefined && !['bidirectional','item-only'].includes(rules.offsetStackScope)) errors.push(`${container.id}: 不可错位约束作用域无效`)
      if (rules.supportCriterion !== undefined && !['area-80-centroid','centroid-hull'].includes(rules.supportCriterion)) errors.push(`${container.id}: 承托几何判据无效`)
      for (const [id,height] of Object.entries(rules.heightExceptions)) {
        const source = expected.get(id)
        if (!source || source.rawData._sourceSheet !== '门窗' || source.rawData._sourceRow !== 16 || !source.name.includes('W02') || !source.name.includes('框') || source.dimensions.length !== 3030 || source.dimensions.width !== 2560 || source.dimensions.height !== 160 || height !== 2560) errors.push(`${container.id}: 非授权的货物高度例外 ${id}`)
      }
    }
    const authoritativeContainer: Container = { ...container, loadingRules: rules }
    if (config && container.unloadingDoor !== config.unloadingDoor) errors.push(`${container.id}: 卸货门位置与请求不一致`)
    if (config && (dims.length !== config.containerDimensions.length || dims.width !== config.containerDimensions.width || dims.height !== config.containerDimensions.height || container.maxWeight !== config.containerMaxWeight)) errors.push(`${container.id}: 集装箱尺寸或载重与请求口径不一致`)

    if (![dims.length, dims.width, dims.height, container.maxWeight].every(n => Number.isFinite(n) && n > 0)) { errors.push(`${container.id}: 容器尺寸或载重无效`); continue }
    if (!container.items.length) errors.push(`${container.id}: 空容器不应计入方案`)
    totalVolume += volume(dims)
    let weight = 0, used = 0
    const geometry: PlacedItem[] = []
    for (const placed of container.items) {
      placedCount++
      account(placed.item, container.id)
      const original = expected.get(placed.item.id)
      if (!original) continue
      if (cargoReviewReasons(original).length) errors.push(`${original.id}: 未完成货物数据或防滚包装确认，不得计入已装载`)
      if (!near(placed.item.weight, original.weight) || !['length', 'width', 'height'].every(k => near(placed.item.dimensions[k as keyof typeof dims], original.dimensions[k as keyof typeof dims]))) errors.push(`${original.id}: 方案修改了原始尺寸或重量`)
      if (!original.allowedOrientations.includes(placed.orientation) || original.forbiddenOrientations?.includes(placed.orientation) || ![0, 90, 180, 270].includes(placed.rotation)) { errors.push(`${original.id}: 使用禁止的摆放方向或旋转角`); continue }
      if (original.constraints?.horizontalRotations && !original.constraints.horizontalRotations.includes(placed.rotation as 0 | 90 | 180 | 270)) errors.push(`${original.id}: 水平旋转不符合货物约束`)
      const actual = calculateActualDimensions(original.dimensions, placed.orientation, placed.rotation, original.orientationVerticalAxes), p = placed.position, d = placed.actualDimensions
      if (![p.x, p.y, p.z, d.length, d.width, d.height].every(Number.isFinite) || Math.min(p.x, p.y, p.z) < -EPSILON || Math.min(d.length, d.width, d.height) <= 0) { errors.push(`${original.id}: 位置或实际尺寸无效`); continue }
      if (!near(d.length, actual.length) || !near(d.width, actual.width) || !near(d.height, actual.height)) errors.push(`${original.id}: 实际尺寸与方向不一致`)
      if (p.x + actual.length > dims.length + EPSILON || p.y + actual.width > dims.width + EPSILON || p.z + actual.height > maxPlacementHeight(original,authoritativeContainer) + EPSILON) errors.push(`${original.id}: 超出集装箱边界`)
      const authoritative = { ...placed, item: original, actualDimensions: actual }
      try {
        geometryFor(authoritative)
        for (const other of geometry) {
          errors.push(...pairGeometryErrors(authoritative,other,authoritativeContainer))
          if (!mixingPermitted(original, other.item)) errors.push(`${original.id} 与 ${other.item.id}: 不符合同组混装限制`)
        }
      } catch (error) { errors.push(error instanceof Error ? error.message : `${original.id}: 实体几何无效`); continue }

      geometry.push(authoritative)
      weight += original.weight; used += solidVolume(original)
    }
    errors.push(...analyzeStacking(geometry,rules).errors.map(e => `${container.id}: ${e}`))
    authoritativeContainers.push({ ...authoritativeContainer, items: geometry })
    if (weight > container.maxWeight + EPSILON) errors.push(`${container.id}: 超重 ${weight} > ${container.maxWeight} kg`)
    if (!near(container.totalWeight, weight)) errors.push(`${container.id}: 总重量统计不一致`)
    if (!near(container.volumeUtilization, used / volume(dims))) errors.push(`${container.id}: 体积利用率统计不一致`)
    if (!near(container.weightUtilization, weight / container.maxWeight)) errors.push(`${container.id}: 重量利用率统计不一致`)
    if (container.centerOfGravity && weight > 0) {
      const center = geometry.reduce((m, item) => { const c = solidCentroid(item); return { x: m.x + c.x * item.item.weight / weight, y: m.y + c.y * item.item.weight / weight, z: m.z + c.z * item.item.weight / weight } }, { x: 0, y: 0, z: 0 })
      if (!near(container.centerOfGravity.x, center.x) || !near(container.centerOfGravity.y, center.y) || !near(container.centerOfGravity.z, center.z)) errors.push(`${container.id}: 重心统计不一致`)
    }
    usedVolume += used; totalWeight += weight; avgVolume += used / volume(dims); avgWeight += weight / container.maxWeight
  }
  for (const item of solution.unpackedItems) account(item, '未装载清单')
  for (const original of originals) if (!seen.has(original.id)) errors.push(`遗漏货物: ${original.id}`)
  if (solution.totalContainers !== solution.containers.length) errors.push('集装箱总数统计不一致')
  const expectedUnload = analyzeUnloading(authoritativeContainers)
  if (JSON.stringify(solution.unloadAnalysis) !== JSON.stringify(expectedUnload)) errors.push('卸货遮挡分析与原始货物及摆放不一致')
  if (solution.totalItems !== originals.length || solution.totalItems !== placedCount + solution.unpackedItems.length) errors.push('货物总件数统计不一致')
  if (!near(solution.avgVolumeUtilization, avgVolume / (solution.containers.length || 1)) || !near(solution.avgWeightUtilization, avgWeight / (solution.containers.length || 1))) errors.push('平均利用率统计不一致')
  const s = solution.stats
  if (s && (!near(s.totalVolume, totalVolume) || !near(s.usedVolume, usedVolume) || !near(s.totalWeight, totalWeight) || s.placedItems !== placedCount || s.containerCount !== solution.containers.length || !near(s.volumeUtilization, solution.avgVolumeUtilization * 100) || !near(s.weightUtilization, solution.avgWeightUtilization * 100))) errors.push('方案统计信息与实际装载不一致')
  if (!Number.isFinite(solution.score) || !Number.isFinite(solution.computeTime) || solution.computeTime < 0) errors.push('方案评分或耗时无效')
  if (solution.unpackedItems.length) warnings.push(`${solution.unpackedItems.length} 件货物未装载；必须处理未装载清单后才能按本方案完整发运。`)
  if (originals.some(i => i.weight === 0)) warnings.push('存在 0 kg 货物；重量与重心仅反映已知重量，发运前需补齐实际重量。')
  for (const item of originals) {
    const notes = item.rawData._packingNotes
    if (Array.isArray(notes)) warnings.push(...notes.filter((n): n is string => typeof n === 'string'))
  }
  if (originals.some(i => i.cavity)) warnings.push('已按原始授权空腔扣除实体占用体积；嵌套仅允许完整落在空腔内且类别、方向和间隙均符合的货物。')
  if (expectedUnload) warnings.push('站点分析假设货物起初全部在车内，仅按门方向投影及直接支撑识别潜在阻挡；不代表可执行卸货路径或实际倒货次数。')
  if (originals.some(i => ['cylinder','coil','pipe'].includes(i.shape ?? ''))) warnings.push('圆柱、卷材及管材按已确认防滚包装的长方体外包建模；利用率统计的是包装外包体积。')
  const projection = config?.verticalSupport === 'pdf-clearance-projection' || solution.containers.some(c => c.loadingRules?.supportMechanism === 'pdf-clearance-projection')
  if (solution.containers.some(c => c.loadingRules?.supportMechanism === '5mm-spacer')) warnings.push('方案以明确声明的 5 mm 实体隔垫传递承托载荷；装柜时须按支撑接触区域准备和放置隔垫。')
  if (projection) warnings.push('本方案采用 PDF 几何预留与上下实体投影关系核算假定承托和载荷；保持 5 mm 间隔，未新增实物隔垫，未证明空气间隔可传力，现场实际承托尚未证实。')
  const review = originals.filter(i => i.constraints?.requiresManualReview?.length)
  if (review.length) warnings.push(`${review.length} 件存在未建模约束，已要求人工复核: ${[...new Set(review.flatMap(i => i.constraints?.requiresManualReview ?? []))].join('；')}`)
  if (solution.terminationReason === 'time-limit') warnings.push('计算达到时限，当前结果不保证最优。')
  if (solution.algorithm.includes('BRANCH')) warnings.push('分支定界仅在离散候选位置和有界节点数内搜索，不构成全局最优证明。')
  warnings.push(projection ? '支撑投影按真实实体面计算，不将孔内空白计作支撑；均匀密度与面积比例载荷分配属于建模假设，现场承托、绑扎、运输动力载荷及实际包装强度需另行验证。' : '支撑按真实实体底面与承托面的接触区域、均匀密度及面积比例分配载荷；绑扎、运输动力载荷及实际包装强度需装运前复核。')
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)], ...(projection ? { scope: 'geometry-and-load-assumptions' as const } : {}) }
}
