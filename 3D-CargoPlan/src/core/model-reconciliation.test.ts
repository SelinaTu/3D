// #created 11/08/2026
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CargoItem, Container, OptimizationConfig, PlacedItem } from '../types/packing'
import XLSX from './xlsx-adapter'
import { loadingRulesFor } from './loading-profile'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, updateContainer } from './packing-utils'
import { contactRectangles, geometryFor, pairGeometryErrors, solidCentroid, supportedCenter, unionArea } from './solid-geometry'
import { createPackingSolution } from './solution-builder'
import { validateSolution } from './validation'

// These are bounded diagnostic fixtures, not coordinates recovered from PDF pixels.
// Keep the frozen v1 contract: a failed reconstruction is not an infeasibility proof.
const inputs = JSON.parse(readFileSync(new URL('../../data/demo-items.json', import.meta.url), 'utf8')) as CargoItem[]
const config = (JSON.parse(readFileSync(new URL('../../data/calibration/packing-contract.json', import.meta.url), 'utf8')) as { config: OptimizationConfig }).config
const workbook = XLSX.read(readFileSync(new URL('../../data/sample-cargo.xlsx', import.meta.url)), { type: 'buffer' })

function source(sheet: string, row: number, unit = 0): CargoItem {
  const item = inputs.filter(i => i.rawData._sourceSheet === sheet && i.rawData._sourceRow === row)[unit]
  if (!item) throw new Error(`Missing source fixture ${sheet}/${row}/${unit}`)
  return structuredClone(item)
}
function rawRow(sheet: string, row: number): Record<string, unknown> {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: null, blankrows: true })
  const headers = rows.find(r => r.includes('包装后长mm') && r.includes('总数量'))!
  return Object.fromEntries(headers.map((h, i) => [String(h), rows[row - 1][i]]))
}
function place(item: CargoItem, x = 0, y = 0, z = 0, orientation: PlacedItem['orientation'] = 'standing', rotation = 0): PlacedItem {
  return { item, position: { x, y, z }, orientation, rotation, actualDimensions: calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes) }
}
function container(items: PlacedItem[], request: OptimizationConfig = config): Container {
  const c: Container = { id: 'reconciliation', dimensions: { ...request.containerDimensions }, maxWeight: request.containerMaxWeight, items, totalWeight: 0, volumeUtilization: 0, weightUtilization: 0, loadingRules: loadingRulesFor(items.map(p => p.item), request) }
  updateContainer(c)
  return c
}
function audit(items: PlacedItem[], request: OptimizationConfig = config) {
  const c = container(items, request)
  return validateSolution(createPackingSolution([c], [], 'MODEL-RECONCILIATION-FIXTURE', 0, 0), items.map(p => p.item), request)
}
function geometryErrors(items: PlacedItem[]): string[] {
  const c = container(items)
  return items.flatMap((p, i) => items.slice(0, i).flatMap(q => pairGeometryErrors(p, q, c)))
}
function supportCoverage(upper: PlacedItem, lowers: PlacedItem[]) {
  const contacts = lowers.flatMap(lower => contactRectangles(upper, lower, 5))
  const center = solidCentroid(upper)
  return { ratio: unionArea(contacts) / unionArea(geometryFor(upper).bottom), centerInside: supportedCenter(contacts, center.x, center.y) }
}
function generic(id: string, length: number, width: number, height: number): CargoItem {
  return { id, name: id, category: 'diagnostic', dimensions: { length, width, height }, weight: 1, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: true, canOffsetStack: true, hasGlass: false, colorTag: '', rawData: {} }
}
function page2Strategy(): PlacedItem[] {
  const racks = [20, 21, 22].map((number, i) => place(source('玻璃架', number + 4), i * 1488, 0, 0, 'standing', 90))
  const bars = Array.from({ length: 6 }, (_, i) => place(source('门窗', 12, i), 0, 1000, 1076 + i * 225, 'lying'))
  return [...racks, ...bars]
}
const itemOnly: OptimizationConfig = { ...config, offsetStackScope: 'item-only' }
const centroidOnly: OptimizationConfig = { ...itemOnly, supportCriterion: 'centroid-hull' }

describe('source/PDF reconciliation diagnostics without changing source constraints', () => {
  it('removes only the explicit support area fraction and rejects cross-model validation', () => {
    const lower = place(generic('narrow-centered', 100, 100, 100), 450)
    const upper = place(generic('wide-centered', 1000, 100, 100), 0, 0, 105)
    expect(supportCoverage(upper, [lower])).toEqual({ ratio: .1, centerInside: true })
    expect(canPlaceAt(upper.item, upper.position, upper.orientation, 0, container([lower], centroidOnly))).toBe(true)
    expect(audit([lower, upper], centroidOnly).valid).toBe(true)
    expect(audit([lower, upper], itemOnly).valid).toBe(false)
    const c = container([lower, upper], centroidOnly)
    expect(validateSolution(createPackingSolution([c], [], 'V3', 0, 0), [lower.item, upper.item], itemOnly).errors.some(e => e.includes('口径不一致'))).toBe(true)
  })

  it('still rejects a floating item or a center outside the actual support hull in centroid mode', () => {
    const lower = place(generic('edge-support', 100, 100, 100))
    const upper = place(generic('outside-center', 1000, 100, 100), 0, 0, 105)
    expect(canPlaceAt(upper.item, upper.position, upper.orientation, 0, container([lower], centroidOnly))).toBe(false)
    expect(canPlaceAt(upper.item, { x: 0, y: 0, z: 106 }, upper.orientation, 0, container([lower], centroidOnly))).toBe(false)
    expect(audit([lower, upper], centroidOnly).valid).toBe(false)
  })

  it('retains source unit loads, exact-source compatibility and no-offset restrictions in centroid mode', () => {
    const rack = place(source('玻璃架', 7)), base = place(source('门窗', 14), 25, 76, 1650, 'flat'), upper = place(source('门窗', 14, 1), 25, 76, 1805, 'flat')
    expect(audit([rack, base, upper], centroidOnly).errors.some(e => e.includes('顶部单件超过 5 kg'))).toBe(true)
    const w04 = place(source('门窗', 6), 0, 0, 0, 'flat'), different = place(source('门窗', 7), 0, 0, 125, 'flat')
    expect(audit([w04, different], centroidOnly).errors.some(e => e.includes('不允许承托'))).toBe(true)
    const left = place(generic('left-new', 100, 100, 100)), right = place(generic('right-new', 100, 100, 100), 900)
    const rigid = place({ ...generic('rigid-upper', 1000, 100, 100), canOffsetStack: false }, 0, 0, 105)
    expect(audit([left, right, rigid], centroidOnly).errors.some(e => e.includes('禁止错位'))).toBe(true)
  })

  it('reproduces the PDF page 2 cross-rack W09 strategy and isolates the extra lower-item offset veto', () => {
    const items = page2Strategy(), racks = items.slice(0, 3), bars = items.slice(3), c = container(items), analysis = analyzeStacking(items, c.loadingRules)
    expect(rawRow('玻璃架', 24)['是否可错位叠放']).toBe('否')
    expect(rawRow('门窗', 12)['是否可错位叠放']).toBe('是')
    expect(bars[0].actualDimensions).toEqual({ length: 3610, width: 300, height: 220 })
    expect(bars.at(-1)!.position.z + bars.at(-1)!.actualDimensions.height).toBe(2421)
    expect(supportCoverage(bars[0], racks)).toEqual({ ratio: 1, centerInside: true })
    expect(geometryErrors(items)).toEqual([])
    expect(analysis.topLoads.slice(0, 3)).toEqual([100.90371191135733, 100.90371191135733, 42.99257617728532])
    expect(analysis.errors).toEqual(racks.map(r => `${r.item.id}: 不允许顶部货物错位`))
    expect(audit(items).errors).toEqual(analysis.errors.map(e => `reconciliation: ${e}`))
  })

  it('accepts the identical page 2 coordinates in explicit item-only scope but rejects that result against the frozen v1 request', () => {
    const items = page2Strategy(), c = container(items, itemOnly), originals = items.map(p => p.item)
    expect(c.loadingRules?.offsetStackScope).toBe('item-only')
    expect(analyzeStacking(items, c.loadingRules).errors).toEqual([])
    const solution = createPackingSolution([c], [], 'PDF-P2-MACRO-REPLAY', 0, 0)
    expect(validateSolution(solution, originals, itemOnly).valid).toBe(true)
    const legacy = validateSolution(solution, originals, config)
    expect(legacy.valid).toBe(false)
    expect(legacy.errors.some(e => e.includes('口径不一致'))).toBe(true)
    expect(legacy.errors.filter(e => e.includes('不允许顶部货物错位'))).toHaveLength(3)
    const racks = items.slice(0, 3), first = items[3]
    expect(canPlaceAt(first.item, first.position, first.orientation, 0, container(racks, itemOnly))).toBe(true)
  })

  it('preserves the upper item own no-offset veto in item-only scope even with 80 percent support and a supported center', () => {
    const left = place(generic('left', 400, 100, 100)), right = place(generic('right', 400, 100, 100), 600)
    const upper = place({ ...generic('upper-no-offset', 1000, 100, 100), canOffsetStack: false }, 0, 0, 105)
    const c = container([left, right], itemOnly)
    expect(supportCoverage(upper, [left, right])).toEqual({ ratio: .8, centerInside: true })
    expect(canPlaceAt(upper.item, upper.position, upper.orientation, 0, c)).toBe(false)
    expect(audit([left, right, upper], itemOnly).errors).toEqual(['reconciliation: upper-no-offset: 禁止错位叠放，需要单件完整支撑'])
  })

  it('isolates the same scope veto for a W12 with only 28.5 mm overhang at either end', () => {
    const rack = place(source('玻璃架', 18), 28.5), door = place(source('门窗', 15), 0, 59, 1028, 'flat')
    const items = [rack, door], c = container(items), analysis = analyzeStacking(items, c.loadingRules)
    expect(supportCoverage(door, [rack]).ratio).toBeCloseTo(2173 / 2230, 12)
    expect(supportCoverage(door, [rack]).centerInside).toBe(true)
    expect(geometryErrors(items)).toEqual([])
    expect(analysis.topLoads[0]).toBe(74)
    expect(analysis.errors).toEqual([`${rack.item.id}: 不允许顶部货物错位`])
    expect(canPlaceAt(door.item, door.position, 'flat', 0, container([rack]))).toBe(false)
    expect(audit(items, itemOnly).valid).toBe(true)
  })

  it('identifies 80 percent as an exact engineering threshold, separate from center stability and source limits', () => {
    const upper = place(generic('wide', 1000, 100, 100), 0, 0, 105)
    const narrow = place(generic('79.9-percent', 799, 100, 100), 100.5)
    const boundary = place(generic('80-percent', 800, 100, 100), 100)
    expect(supportCoverage(upper, [narrow])).toEqual({ ratio: .799, centerInside: true })
    expect(geometryErrors([narrow, upper])).toEqual([])
    expect(analyzeStacking([narrow, upper], container([narrow, upper]).loadingRules).errors).toEqual(['wide: 实体底面支撑不足 80% 或重心投影不在支撑多边形内'])
    expect(supportCoverage(upper, [boundary])).toEqual({ ratio: .8, centerInside: true })
    expect(audit([boundary, upper]).valid).toBe(true)
  })

  it('shows that @self uses source-row identity even when physical dimensions and weights match', () => {
    const base = place(source('门窗', 6), 0, 0, 0, 'flat')
    const same = place(source('门窗', 6, 1), 0, 0, 125, 'flat')
    const otherFloor = place(source('门窗', 7), 0, 0, 125, 'flat')
    expect(base.item.dimensions).toEqual(otherFloor.item.dimensions)
    expect(base.item.weight).toBe(otherFloor.item.weight)
    expect(audit([base, same]).valid).toBe(true)
    expect(geometryErrors([base, otherFloor])).toEqual([])
    expect(audit([base, otherFloor]).errors).toEqual([`reconciliation: ${base.item.id}: 不允许承托 ${otherFloor.item.id}`])
    expect(audit([base, otherFloor], itemOnly).errors).toEqual([`reconciliation: ${base.item.id}: 不允许承托 ${otherFloor.item.id}`])
    // A diagnostic duplicate row with otherwise identical SKU fields is also vetoed.
    const duplicate = place({ ...structuredClone(same.item), id: 'duplicate-source-row', rawData: { ...same.item.rawData, _sourceRow: 999 } }, 0, 0, 125, 'flat')
    expect(audit([base, duplicate]).errors).toEqual([`reconciliation: ${base.item.id}: 不允许承托 duplicate-source-row`])
  })

  it('documents the inclusive-pile interpretation: ten W01 flat frames fit but an eleventh exceeds nine above the base', () => {
    const pile = Array.from({ length: 11 }, (_, i) => place(source('门窗', 23, i), 0, 0, i * 215, 'flat'))
    expect(rawRow('门窗', 23)['最大叠放件数']).toBe('如平放，可叠放自身相同物品且小于等于10件')
    expect(pile[0].item.constraints?.orientationRules?.flat?.maxStackCount).toBe(9)
    expect(pile[10].position.z + pile[10].actualDimensions.height).toBe(2360)
    expect(geometryErrors(pile)).toEqual([])
    expect(audit(pile.slice(0, 10)).valid).toBe(true)
    expect(audit(pile).errors).toEqual([`reconciliation: ${pile[0].item.id}: 上方累计件数超过 9`])
    expect(audit(pile, itemOnly).errors).toEqual([`reconciliation: ${pile[0].item.id}: 上方累计件数超过 9`])
  })

  it('does not infer an illegal eleven-layer pile from the PDF page 3 manifest of twenty-two W01 frames', () => {
    // A legal alternative to the unsupported inference "22 = 2 piles of 11":
    // two ten-high flat piles plus two lying frames in the remaining side strip.
    const flat = Array.from({ length: 20 }, (_, i) => place(source('门窗', 23, i), 0, i < 10 ? 215 : 1210, (i % 10) * 215, 'flat'))
    const lying = Array.from({ length: 2 }, (_, i) => place(source('门窗', 23, i + 20), 0, 0, i * 995, 'lying'))
    const items = [...flat, ...lying]
    expect(items).toHaveLength(22)
    expect(Math.max(...items.map(p => p.position.y + p.actualDimensions.width))).toBe(2200)
    expect(Math.max(...items.map(p => p.position.z + p.actualDimensions.height))).toBe(2145)
    expect(geometryErrors(items)).toEqual([])
    expect(audit(items).valid).toBe(true)
    expect(audit(items, itemOnly).valid).toBe(true)
  })

  it('counts every supported descendant rather than maximum stack depth or direct children alone', () => {
    const base = place({ ...generic('base', 1000, 100, 100), maxStackCount: 1 })
    const left = place(generic('left', 400, 100, 100), 0, 0, 105)
    const right = place(generic('right', 400, 100, 100), 600, 0, 105)
    const analysis = analyzeStacking([base, left, right], container([base, left, right]).loadingRules)
    expect(analysis.descendants[0].size).toBe(2)
    expect(analysis.errors).toEqual(['base: 上方累计件数超过 1'])
  })

  it('rejects the page-19-like five-layer W11 surrogate solely on the original single-upper-unit weight restriction', () => {
    const rack = place(source('玻璃架', 7))
    const doors = Array.from({ length: 5 }, (_, i) => place(source('门窗', 14, i), 25, 76, 1650 + i * 155, 'flat'))
    const items = [rack, ...doors], c = container(items), analysis = analyzeStacking(items, c.loadingRules)
    expect(rawRow('门窗', 14)['可叠放对象']).toBe('顶部可放置单件不超过5kg的物品')
    expect(doors.every(p => p.item.weight === 81)).toBe(true)
    expect(doors.at(-1)!.position.z + doors.at(-1)!.actualDimensions.height).toBe(2420)
    expect(analysis.topLoads[0]).toBe(405)
    expect(geometryErrors(items)).toEqual([])
    expect(supportCoverage(doors[0], [rack])).toEqual({ ratio: 1, centerInside: true })
    expect(analysis.errors).toEqual(doors.slice(0, 4).map(d => `${d.item.id}: 顶部单件超过 5 kg`))
    expect(audit(items).errors).toEqual(analysis.errors.map(e => `reconciliation: ${e}`))
    expect(audit(items, itemOnly).errors).toEqual(analysis.errors.map(e => `reconciliation: ${e}`))
    expect(canPlaceAt(doors[0].item, doors[0].position, 'flat', 0, container([rack]))).toBe(true)
    expect(canPlaceAt(doors[1].item, doors[1].position, 'flat', 0, container([rack, doors[0]]))).toBe(false)
  })
})
