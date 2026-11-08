// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { buildCargoTemplateWorkbook, buildSolutionJSON, buildSolutionReport, buildSolutionWorkbook } from './export-utils'
import { parseExcelBuffer } from './data-parser'
import XLSX from './xlsx-adapter'
import type { CargoItem, PackingSolution } from '../types/packing'

const item: CargoItem = { id: '<img src=x onerror=alert(1)>', name: '门窗 & "玻璃"', category: '窗', dimensions: { length: 600, width: 300, height: 100 }, weight: 10, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: false, hasGlass: true, canOffsetStack: false, colorTag: '蓝', rawData: { _sourceSheet: '原始表', _sourceRow: 5 } }
const solution: PackingSolution = { id: 'report-test', algorithm: 'test', totalContainers: 1, totalItems: 2, avgVolumeUtilization: 0.1, avgWeightUtilization: 0.2, score: 0, computeTime: 20, unpackedItems: [{ ...item, id: 'unpacked', constraints: { requiresManualReview: ['<script>alert(1)</script>'] } }], validation: { valid: false, errors: ['错误 <img src=x>'], warnings: ['检查 & 复核'] }, containers: [{ id: 'C-1', dimensions: { length: 12032, width: 2352, height: 2698 }, maxWeight: 28000, items: [{ item, position: { x: 1.23456789, y: 2.34567891, z: 0 }, orientation: 'standing', rotation: 90, actualDimensions: { length: 300, width: 600, height: 100 } }], totalWeight: 10, volumeUtilization: 0.1, weightUtilization: 0.2, centerOfGravity: { x: 151.23456789, y: 302.34567891, z: 50 } }] }

describe('delivery exports', () => {
  it('produces a downloadable template that imports with the same units and limits', () => {
    const buffer = XLSX.write(buildCargoTemplateWorkbook(), { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const items = parseExcelBuffer(buffer)
    expect(items).toHaveLength(10)
    expect(items[0]).toMatchObject({ weight: 12.5, dimensions: { length: 600, width: 400, height: 300 }, maxStackCount: 3 })
  })

  it('escapes report data and retains exact coordinates, validation and unpacked rows', () => {
    const html = buildSolutionReport(solution)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('1.23456789')
    expect(html).toContain('151.23456789')
    expect(html).toContain('校验未通过')
    expect(html).toContain('unpacked')
    expect(html).toContain('原始表 / 第 5 行')
  })

  it('exports numeric Excel manifest cells plus errors, provenance and CoG', () => {
    const workbook = buildSolutionWorkbook(solution)
    expect(workbook.SheetNames).toEqual(['方案概览', '装柜明细', '未装入货物', '校验与说明'])
    const manifest = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['装柜明细'], { header: 1 })
    expect(manifest[1][6]).toBe(1.23456789)
    expect(manifest[1][9]).toBe(300)
    expect(manifest[1][25]).toContain('原始表')
    expect(XLSX.utils.sheet_to_csv(workbook.Sheets['校验与说明'])).toContain('错误 <img src=x>')
    const json = JSON.parse(buildSolutionJSON(solution))
    expect(json.containers[0].items[0].position.x).toBe(1.23456789)
    expect(json.exportMetadata.dimensionsUnit).toBe('mm')
  })
})
