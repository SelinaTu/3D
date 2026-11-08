// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import XLSX from './xlsx-adapter'
import { calculateStatistics, expandCargoItems, parseExcelBuffer, parseExcelData } from './data-parser'
import { fileURLToPath } from 'node:url'
import { calculateActualDimensions } from './packing-utils'

const headers = ['id', 'name', 'category', 'length (mm)', 'width (mm)', 'height (mm)', 'weight (kg)', 'quantity', 'allowedOrientations', 'forbiddenOrientations', 'canStackOnTop', 'maxStackWeight', 'maxStackCount']
const row = ['A', '纸箱', 'box', 600, 400, 300, 12.5, 2, 'standing,flat', 'lying', 'true', 100, 3]
function buffer(rows: unknown[][], second?: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '货物')
  if (second) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(second), '第二表')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

describe('Excel cargo import', () => {
  it('detects headers and expands all sheets into unique units', () => {
    const items = parseExcelBuffer(buffer([['项目说明'], [], headers, row, row], [headers, row]))
    expect(items).toHaveLength(6)
    expect(new Set(items.map(item => item.id)).size).toBe(6)
    expect(items.every(item => item.quantity === 1)).toBe(true)
    expect(items[0]).toMatchObject({ allowedOrientations: ['standing', 'flat'], forbiddenOrientations: ['lying'], maxStackWeight: 100, maxStackCount: 3, rawData: { _sourceSheet: '货物', _sourceRow: 4 } })
  })

  it.each([[3, 0], [4, -1], [5, 'Infinity'], [6, -1], [7, 1.5], [7, 5001], [8, 'diagonal'], [11, -2], [12, 1.5], [11, '顶部总重量小于-10kg'], [12, '不超过1.5件']])('rejects invalid cell %s=%s with physical row context', (column, value) => {
    const invalid = [...row]; invalid[column as number] = value as never
    expect(() => parseExcelBuffer(buffer([headers, invalid]))).toThrow(/第 2 行/)
  })

  it('rejects contradictory orientation and unknown sheets instead of dropping them', () => {
    const invalid = [...row]; invalid[9] = 'standing,flat'
    expect(() => parseExcelBuffer(buffer([headers, invalid]))).toThrow(/全部被禁止/)
    expect(() => parseExcelBuffer(buffer([headers, row], [['Unrecognized cargo data']]))).toThrow(/第二表.*找不到有效表头/)
  })

  it('parses the entire real workbook without losing rows or constraints', () => {
    const grouped = parseExcelData(fileURLToPath(new URL('../../data/sample-cargo.xlsx', import.meta.url)))
    const items = expandCargoItems(grouped), stats = calculateStatistics(items)
    expect(grouped).toHaveLength(90)
    expect(items).toHaveLength(1371)
    expect(stats.totalWeight).toBeCloseTo(134777.37, 6)
    expect(stats.totalVolume).toBe(590112711447)
    expect(items.filter(item => item.constraints?.requiresManualReview?.length)).toHaveLength(0)
    expect(items.filter(item => item.constraints?.supportedItemsLargestFaceDown)).toHaveLength(32)
    expect(items.filter(item => Array.isArray(item.rawData._packingNotes))).toHaveLength(3)
    const rack = items.find(item => item.category === '玻璃架')!
    expect(rack).toMatchObject({ allowedOrientations: ['standing'], maxStackWeight: 600, stackableWith: ['@not-self'] })
    const conditional = grouped.find(item => String(item.rawData['顶部最大重量kg']).includes('小于120kg'))!
    expect(conditional.constraints?.orientationRules?.lying).toMatchObject({ maxStackWeight: 120, strictMaxStackWeight: true })
    expect(conditional.constraints?.orientationRules?.flat).toMatchObject({ maxStackCount: 9 })
    const w02 = items.find(item => item.rawData._sourceSheet === '门窗' && item.rawData._sourceRow === 16)!
    expect(w02.orientationVerticalAxes).toEqual({ standing: 'length', lying: 'width', flat: 'height' })
    expect(calculateActualDimensions(w02.dimensions, 'lying', 0, w02.orientationVerticalAxes).height).toBe(2560)
    expect(items.filter(item => item.cavity)).toHaveLength(230)
    expect(w02.cavity).toEqual({ dimensions: { length: 1200, width: 2200, height: 160 }, offset: { x: 915, y: 180, z: 0 }, allowedSourceSheets: ['门窗', '辅材'], doorOrientation: 'lying' })
    const longFrame = items.find(item => item.rawData._sourceSheet === '门窗' && item.rawData._sourceRow === 23)!
    expect(longFrame.cavity).toEqual({ dimensions: { length: 3000, width: 790, height: 210 }, offset: { x: 1800, y: 100, z: 0 }, allowedSourceSheets: ['门窗', '辅材'], doorOrientation: 'lying' })
    const shortFrame = items.find(item => item.rawData._sourceSheet === '门窗' && item.rawData._sourceRow === 21)!
    expect(shortFrame.cavity).toEqual({ dimensions: { length: 1200, width: 1600, height: 110 }, offset: { x: 447, y: 37, z: 0 }, allowedSourceSheets: ['辅材'] })
    expect(shortFrame.rawData._cavityConfirmation).toMatchObject({ confirmedBy: 'user', confirmedOn: '2026-10-16' })
  })

  it('handles empty statistics and rejects malformed quantities during expansion', () => {
    expect(calculateStatistics([]).averageDimensions).toEqual({ length: 0, width: 0, height: 0 })
    const [item] = parseExcelBuffer(buffer([headers, row]))
    expect(() => expandCargoItems([{ ...item, quantity: 1.2 }])).toThrow()
    expect(() => expandCargoItems([item, item])).toThrow(/编号重复/)
  })
})
