// #created 11/08/2026
import type { CargoItem, Container, PlacedItem, Position3D, Dimensions3D, Orientation, SpaceBounds } from '../types/packing'
import { geometryFor, contactRectangles, unionArea, supportedCenter, supportGap, pairGeometryErrors, solidBounds, requiredClearance, solidVolume, nestedInside, solidCentroid, cavityFaceMargins } from './solid-geometry'
import { cargoReviewReasons } from './cargo-readiness'

/** Coordinate convention: x=length, y=width, z=height, millimetres. */
export const EPSILON = 1e-6
export function volume(d: Dimensions3D): number { return d.length * d.width * d.height }

/** Standing keeps H vertical, lying keeps W vertical, flat keeps L vertical. */
export function calculateActualDimensions(original: Dimensions3D, orientation: Orientation, rotation: number, verticalAxes?: CargoItem['orientationVerticalAxes']): Dimensions3D {
  let length: number, width: number, height: number
  const vertical = verticalAxes?.[orientation]
  if (vertical === 'length') { length = original.width; width = original.height; height = original.length }
  else if (vertical === 'width') { length = original.length; width = original.height; height = original.width }
  else if (vertical === 'height') ({ length, width, height } = original)
  else switch (orientation) {
    case 'standing': ({ length, width, height } = original); break
    case 'lying': length = original.length; width = original.height; height = original.width; break
    case 'flat': length = original.width; width = original.height; height = original.length; break
    default: throw new Error(`Unknown orientation: ${String(orientation)}`)
  }
  if (rotation === 90 || rotation === 270) [length, width] = [width, length]
  return { length, width, height }
}

export function orientationsFor(item: CargoItem): { orientation: Orientation; rotation: number; dimensions: Dimensions3D }[] {
  const variants: ReturnType<typeof orientationsFor> = [], seen = new Set<string>()
  for (const orientation of item.allowedOrientations) {
    if (item.forbiddenOrientations?.includes(orientation)) continue
    for (const rotation of item.constraints?.horizontalRotations ?? [0, 90]) {
      const dimensions = calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes)
      const key = `${orientation}/${rotation}/${dimensions.length}/${dimensions.width}/${dimensions.height}/${JSON.stringify(item.constraints?.orientationRules?.[orientation] ?? {})}`
      if (!seen.has(key)) { seen.add(key); variants.push({ orientation, rotation, dimensions }) }
    }
  }
  return variants
}

export function calculateBounds(placed: PlacedItem): SpaceBounds {
  const { position: p, actualDimensions: d } = placed
  return { min: { ...p }, max: { x: p.x + d.length, y: p.y + d.width, z: p.z + d.height } }
}
export function checkOverlap(a: SpaceBounds, b: SpaceBounds): boolean {
  return a.min.x < b.max.x - EPSILON && a.max.x > b.min.x + EPSILON &&
    a.min.y < b.max.y - EPSILON && a.max.y > b.min.y + EPSILON &&
    a.min.z < b.max.z - EPSILON && a.max.z > b.min.z + EPSILON
}
function contactArea(upper: PlacedItem, lower: PlacedItem, rules?: Container['loadingRules']): number {
  return unionArea(contactRectangles(upper, lower, supportGap(upper.item, lower.item, { loadingRules: rules })))
}
function allContacts(upper: PlacedItem, items: PlacedItem[], rules?: Container['loadingRules']) {
  return items.map((lower,index) => ({ index, rectangles: contactRectangles(upper, lower, supportGap(upper.item,lower.item,{loadingRules:rules})) }))
    .map(c => ({ ...c, area: unionArea(c.rectangles), internal: nestedInside(upper,items[c.index]) })).filter(c => c.area > EPSILON)
}
function validSupportGeometry(upper: PlacedItem, contacts: ReturnType<typeof allContacts>, rules?: Container['loadingRules']): boolean {
  const rectangles = contacts.flatMap(c => c.rectangles)
  const area = unionArea(rectangles), baseArea = unionArea(geometryFor(upper).bottom)
  const {x:cx,y:cy} = solidCentroid(upper)
  return baseArea > EPSILON && area > EPSILON && (rules?.supportCriterion === 'centroid-hull' || area + EPSILON >= baseArea * 0.8) && supportedCenter(rectangles,cx,cy)
}
function containsFootprint(lower: PlacedItem, upper: PlacedItem): boolean {
  const a = calculateBounds(lower), b = calculateBounds(upper)
  return b.min.x >= a.min.x - EPSILON && b.min.y >= a.min.y - EPSILON &&
    b.max.x <= a.max.x + EPSILON && b.max.y <= a.max.y + EPSILON
}
function permitsStack(lower: CargoItem, upper: CargoItem): boolean {
  if (!lower.canStackOnTop) return false
  const allowed = lower.stackableWith?.map(s => s.trim()).filter(Boolean)
  if (!allowed?.length || allowed.some(s => /^(不限|任意|全部|任何|all|any|\*)$/i.test(s))) return true
  const same = lower.rawData._sourceSheet !== undefined && lower.rawData._sourceRow !== undefined && upper.rawData._sourceSheet !== undefined && upper.rawData._sourceRow !== undefined
    ? lower.rawData._sourceSheet === upper.rawData._sourceSheet && lower.rawData._sourceRow === upper.rawData._sourceRow
    : lower.name === upper.name && lower.weight === upper.weight && lower.dimensions.length === upper.dimensions.length && lower.dimensions.width === upper.dimensions.width && lower.dimensions.height === upper.dimensions.height
  return allowed.some(s => s === upper.category || s === upper.name || s === upper.id || (s === '@self' && same) || (s === '@not-self' && !same))
}
function stackRule(placed: PlacedItem) {
  return { maxStackCount: placed.item.maxStackCount, maxStackWeight: placed.item.maxStackWeight, ...placed.item.constraints?.orientationRules?.[placed.orientation] }
}
function tooMuchLoad(load: number, placed: PlacedItem): boolean {
  const rule = stackRule(placed)
  return rule.maxStackWeight !== undefined && (rule.strictMaxStackWeight ? load > EPSILON && load >= rule.maxStackWeight - EPSILON : load > rule.maxStackWeight + EPSILON)
}
function largestFaceDown(placed: PlacedItem): boolean {
  const d = placed.item.dimensions, area = placed.actualDimensions.length * placed.actualDimensions.width
  const largest = Math.max(d.length * d.width, d.length * d.height, d.width * d.height)
  return Math.abs(area - largest) <= Math.max(EPSILON, largest * 1e-9)
}
export interface StackAnalysis {
  errors: string[]
  supports: { index: number; share: number; internal?: boolean }[][]
  topLoads: number[]
  carriedLoads: number[]
  descendants: Set<number>[]
}
/** Area-proportional load transfer includes every layer below a stacked item. */
export function analyzeStacking(items: PlacedItem[], loadingRules?: Container['loadingRules']): StackAnalysis {
  const errors: string[] = [], supports: StackAnalysis['supports'] = items.map(() => [])
  const topLoads = items.map(() => 0), carriedLoads = items.map(() => 0), descendants = items.map(() => new Set<number>())
  for (let i = 0; i < items.length; i++) {
    const upper = items[i]
    if (upper.item.constraints?.mustBeOnFloor && upper.position.z > EPSILON) errors.push(`${upper.item.id}: 必须放置在地板上`)
    if (upper.item.constraints?.requiresManualReview?.length) errors.push(`${upper.item.id}: 存在未完成的人工约束复核`)
    if (upper.position.z <= EPSILON) continue
    const contacts = allContacts(upper, items, loadingRules).filter(c => c.index !== i)
    const area = contacts.reduce((sum,c) => sum+c.area,0)
    if (!validSupportGeometry(upper,contacts,loadingRules)) errors.push(`${upper.item.id}: ${loadingRules?.supportCriterion === 'centroid-hull' ? '缺少实体承托投影或重心投影不在支撑多边形内' : '实体底面支撑不足 80% 或重心投影不在支撑多边形内'}`)
    if (!upper.item.canOffsetStack && !contacts.some(c => containsFootprint(items[c.index], upper))) errors.push(`${upper.item.id}: 禁止错位叠放，需要单件完整支撑`)
    for (const c of contacts) {
      const lower = items[c.index]
      if (!c.internal && loadingRules?.preventCrossStopStacking && lower.item.unloadStop !== upper.item.unloadStop) errors.push(`${lower.item.id} 与 ${upper.item.id}: 不允许不同卸货站组叠放`)
      if (!c.internal && !permitsStack(lower.item, upper.item)) errors.push(`${lower.item.id}: 不允许承托 ${upper.item.id}`)
      if (!c.internal && lower.item.constraints?.supportedItemsLargestFaceDown && !largestFaceDown(upper)) errors.push(`${lower.item.id}: 直接承托的 ${upper.item.id} 必须最大面积面朝下`)
      const maxUnit = stackRule(lower).maxSupportedItemWeight
      if (!c.internal && maxUnit !== undefined && upper.item.weight > maxUnit + EPSILON) errors.push(`${lower.item.id}: 顶部单件超过 ${maxUnit} kg`)
      if (!c.internal && loadingRules?.offsetStackScope !== 'item-only' && !lower.item.canOffsetStack && !containsFootprint(lower, upper)) errors.push(`${lower.item.id}: 不允许顶部货物错位`)
      supports[i].push({ index: c.index, share: c.area / (area || 1), internal: c.internal })
    }
  }
  const order = items.map((_, i) => i).sort((a, b) => items[b].position.z - items[a].position.z)
  for (const i of order) {
    for (const support of supports[i]) {
      const load = (items[i].item.weight + carriedLoads[i]) * support.share
      carriedLoads[support.index] += load
      if (!support.internal) {
        topLoads[support.index] += load
        descendants[support.index].add(i)
        for (const child of descendants[i]) descendants[support.index].add(child)
      }
    }
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i].item
    if (tooMuchLoad(topLoads[i], items[i])) errors.push(`${item.id}: 累计顶部载荷超过 ${stackRule(items[i]).maxStackWeight} kg`)
    const limit = stackRule(items[i]).maxStackCount
    if (limit !== undefined && descendants[i].size > limit) errors.push(`${item.id}: 上方累计件数超过 ${limit}`)
  }
  return { errors, supports, topLoads, carriedLoads, descendants }
}
const stackCache = new WeakMap<Container, { count: number; last: PlacedItem | undefined; rules: Container['loadingRules']; analysis: StackAnalysis }>()
function existingStack(container: Container): StackAnalysis {
  const cached = stackCache.get(container)
  if (cached?.count === container.items.length && cached.last === container.items.at(-1) && cached.rules === container.loadingRules) return cached.analysis
  const analysis = analyzeStacking(container.items, container.loadingRules)
  stackCache.set(container, { count: container.items.length, last: container.items.at(-1), rules: container.loadingRules, analysis })
  return analysis
}
function validAddedStack(candidate: PlacedItem, container: Container): boolean {
  const items = container.items
  const supportsExisting = items.some(p => contactArea(p, candidate, container.loadingRules) > EPSILON)
  if (candidate.position.z <= EPSILON) return !supportsExisting || analyzeStacking([...items, candidate], container.loadingRules).errors.length === 0
  if (supportsExisting) return analyzeStacking([...items, candidate], container.loadingRules).errors.length === 0
  const contacts = allContacts(candidate, items, container.loadingRules)
  const area = contacts.reduce((sum,c)=>sum+c.area,0)
  if (!validSupportGeometry(candidate,contacts,container.loadingRules)) return false
  if (!candidate.item.canOffsetStack && !contacts.some(c => containsFootprint(items[c.index], candidate))) return false
  for (const c of contacts) {
    const lower = items[c.index], maxUnit = stackRule(lower).maxSupportedItemWeight
    if (!c.internal && container.loadingRules?.preventCrossStopStacking && lower.item.unloadStop !== candidate.item.unloadStop) return false
    if (!c.internal && (!permitsStack(lower.item, candidate.item) || (container.loadingRules?.offsetStackScope !== 'item-only' && !lower.item.canOffsetStack && !containsFootprint(lower, candidate)) || (maxUnit !== undefined && candidate.item.weight > maxUnit + EPSILON) || (lower.item.constraints?.supportedItemsLargestFaceDown && !largestFaceDown(candidate)))) return false
  }
  const existing = existingStack(container)
  if (existing.errors.length) return false
  const extraLoad = items.map(() => 0), extraTopLoad = items.map(() => 0), affected = new Set<number>()
  for (const c of contacts) {
    const load = candidate.item.weight * c.area / area
    extraLoad[c.index] += load
    if (!c.internal) { extraTopLoad[c.index] += load; affected.add(c.index) }
  }
  const order = items.map((_, i) => i).sort((a, b) => items[b].position.z - items[a].position.z)
  for (const i of order) {
    if (tooMuchLoad(existing.topLoads[i] + extraTopLoad[i], items[i])) return false
    const limit = stackRule(items[i]).maxStackCount
    if (affected.has(i) && limit !== undefined && existing.descendants[i].size + 1 > limit) return false
    for (const c of existing.supports[i]) {
      const load = extraLoad[i] * c.share
      extraLoad[c.index] += load
      if (!c.internal) { extraTopLoad[c.index] += load; if (affected.has(i)) affected.add(c.index) }
    }
  }
  return true
}
export function canPlaceAt(item: CargoItem, position: Position3D, orientation: Orientation, rotation: number, container: Container, existingItems: PlacedItem[] = container.items): boolean {
  if (cargoReviewReasons(item).length) return false
  if (item.constraints?.requiresManualReview?.length || (item.constraints?.mustBeOnFloor && position.z > EPSILON)) return false
  if (!item.allowedOrientations.includes(orientation) || item.forbiddenOrientations?.includes(orientation) || ![0, 90, 180, 270].includes(rotation)) return false
  if (item.constraints?.horizontalRotations && !item.constraints.horizontalRotations.includes(rotation as 0 | 90 | 180 | 270)) return false
  if (existingItems.some(p => !mixingPermitted(item, p.item))) return false
  const d = calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes)
  if (![position.x, position.y, position.z, d.length, d.width, d.height, item.weight].every(Number.isFinite)) return false
  if (d.length <= 0 || d.width <= 0 || d.height <= 0 || item.weight < 0 || Math.min(position.x, position.y, position.z) < -EPSILON) return false
  if (position.x + d.length > container.dimensions.length + EPSILON || position.y + d.width > container.dimensions.width + EPSILON || position.z + d.height > maxPlacementHeight(item,container) + EPSILON) return false
  if (existingItems.reduce((sum, p) => sum + p.item.weight, 0) + item.weight > container.maxWeight + EPSILON) return false
  const candidate: PlacedItem = { item, position, orientation, rotation, actualDimensions: d }
  if (existingItems.some(p => pairGeometryErrors(candidate,p,container).length > 0)) return false
  return validAddedStack(candidate, existingItems === container.items ? container : { ...container, items: existingItems })
}
export function mixingPermitted(a: CargoItem, b: CargoItem): boolean {
  if (!a.constraints?.onlySameMixGroup && !b.constraints?.onlySameMixGroup) return true
  return !!a.constraints?.mixGroup && a.constraints.mixGroup === b.constraints?.mixGroup
}
export function maxPlacementHeight(item: CargoItem, container: Container): number {
  return Math.max(container.dimensions.height,container.loadingRules?.heightExceptions[item.id] ?? 0)
}
export function findPlacementPoints(container: Container): Position3D[] {
  const cache = pointCache.get(container)
  if (cache?.count === container.items.length && cache.last === container.items.at(-1) && cache.rules === container.loadingRules) return cache.points
  const incremental = cache && cache.count + 1 === container.items.length && cache.rules === container.loadingRules
  const added = incremental ? container.items.slice(-1) : container.items
  const points: Position3D[] = incremental ? [...cache.points] : [{ x: 0, y: 0, z: 0 }], seen = new Set<string>()
  const oldCount = points.length, clearance = container.loadingRules?.clearanceMm ?? 0
  const support = container.loadingRules?.supportGapMm ?? 0
  for (const p of added) {
    const b = calculateBounds(p)
    for(const gap of new Set([0,clearance])) points.push({x:b.max.x+gap,y:b.min.y,z:b.min.z},{x:b.min.x,y:b.max.y+gap,z:b.min.z},{x:b.max.x+gap,y:0,z:0},{x:0,y:b.max.y+gap,z:0})
    if (p.item.canStackOnTop || p.item.cavity) for(const face of geometryFor(p).top) {
      if (!p.item.canStackOnTop && Math.abs(face.z-b.max.z)<EPSILON) continue
      for(const gap of new Set([0,support])) points.push({x:face.minX,y:face.minY,z:face.z+gap})
    }
    const cavity=geometryFor(p).cavity
    if(cavity) { const margin=cavityFaceMargins(p,clearance)!; points.push({x:cavity.min.x+margin.min.x,y:cavity.min.y+margin.min.y,z:cavity.min.z+margin.min.z}) }
  }
  const ceiling=Math.max(container.dimensions.height,...Object.values(container.loadingRules?.heightExceptions ?? {}))
  const result=points.filter((p,i)=>{
    const key=`${p.x}/${p.y}/${p.z}`
    if(seen.has(key)||p.x<0||p.y<0||p.z<0||p.x>=container.dimensions.length||p.y>=container.dimensions.width||p.z>=ceiling)return false
    seen.add(key)
    return !(incremental&&i<oldCount?added:container.items).some(item=>{
      const b=calculateBounds(item)
      if(!(p.x>=b.min.x-EPSILON&&p.x<b.max.x-EPSILON&&p.y>=b.min.y-EPSILON&&p.y<b.max.y-EPSILON&&p.z>=b.min.z-EPSILON&&p.z<b.max.z-EPSILON))return false
      return !item.item.cavity || solidBounds(item).some(s=>p.x>=s.min.x-EPSILON&&p.x<s.max.x-EPSILON&&p.y>=s.min.y-EPSILON&&p.y<s.max.y-EPSILON&&p.z>=s.min.z-EPSILON&&p.z<s.max.z-EPSILON)
    })
  }).sort((a,b)=>a.z-b.z||a.x-b.x||a.y-b.y)
  pointCache.set(container,{count:container.items.length,last:container.items.at(-1),rules:container.loadingRules,points:result})
  return result
}
const pointCache=new WeakMap<Container,{count:number;last:PlacedItem|undefined;rules:Container['loadingRules'];points:Position3D[]}>()
export function tryPlaceItem(item: CargoItem, container: Container, deadline = Infinity): PlacedItem | null {
  if (container.totalWeight + item.weight > container.maxWeight + EPSILON) return null
  const variants=orientationsFor(item).filter(({dimensions:d})=>d.length<=container.dimensions.length+EPSILON && d.width<=container.dimensions.width+EPSILON && d.height<=maxPlacementHeight(item,container)+EPSILON)
  if(!variants.length)return null
  const points=findPlacementPoints(container)
  for(const position of points){
    if(Date.now()>=deadline)return null
    for(const variant of variants)if(canPlaceAt(item,position,variant.orientation,variant.rotation,container))return {item,position:{...position},orientation:variant.orientation,rotation:variant.rotation,actualDimensions:variant.dimensions}
  }
  // Opposite cavity corners enable fitting beside earlier nested children without
  // pretending that the frame's hollow center is a supporting solid face.
  for(const host of container.items){
    const inner=geometryFor(host).cavity
    if(!inner)continue
    const gap=requiredClearance(host.item,item,container),margin=cavityFaceMargins(host,gap)!
    for(const variant of variants){
      const d=variant.dimensions
      for(const x of new Set([inner.min.x+margin.min.x,inner.max.x-margin.max.x-d.length]))for(const y of new Set([inner.min.y+margin.min.y,inner.max.y-margin.max.y-d.width])){
        if(Date.now()>=deadline)return null
        const position={x,y,z:inner.min.z+margin.min.z}
        if(canPlaceAt(item,position,variant.orientation,variant.rotation,container))return {item,position,orientation:variant.orientation,rotation:variant.rotation,actualDimensions:d}
      }
    }
  }
  return null
}
export function calculateUtilization(container: Container): { volume: number; weight: number } {
  return { volume: container.items.reduce((sum, p) => sum + solidVolume(p.item), 0) / volume(container.dimensions), weight: container.items.reduce((sum, p) => sum + p.item.weight, 0) / container.maxWeight }
}
export function updateContainer(container: Container): void {
  stackCache.delete(container)
  const points=pointCache.get(container)
  // A replacement/rollback or edited geometry can retain the same count and last item.
  // Only append-only growth may reuse the incremental point cache.
  if(points && points.count>=container.items.length) pointCache.delete(container)
  container.totalWeight = container.items.reduce((sum, p) => sum + p.item.weight, 0)
  const util = calculateUtilization(container)
  container.volumeUtilization = util.volume; container.weightUtilization = util.weight
  const moments = { x: 0, y: 0, z: 0 }
  for (const p of container.items) {
    const center = solidCentroid(p)
    moments.x += center.x * p.item.weight
    moments.y += center.y * p.item.weight
    moments.z += center.z * p.item.weight
  }
  container.centerOfGravity = { x: moments.x / (container.totalWeight || 1), y: moments.y / (container.totalWeight || 1), z: moments.z / (container.totalWeight || 1) }
}
