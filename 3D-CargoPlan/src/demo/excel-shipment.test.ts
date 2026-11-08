// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { expandCargoItems, parseExcelData } from '../core/data-parser'
import { packPlan } from './priority-pack'
import { shipmentFromItems } from './excel-shipment'
import { seaVehicle } from './scenarios'

describe('excel shipment', () => {
  it('groups the Iraq workbook by worksheet and respects payload', () => {
    const items = expandCargoItems(parseExcelData('data/sample-cargo.xlsx'))
    const shipment = shipmentFromItems(items, 'data/sample-cargo.xlsx')
    expect(shipment.count).toBe(1371)
    expect(shipment.stops.map((stop) => stop.name).sort()).toEqual(['玻璃架', '辅材', '门窗'])
    expect(shipment.stops.find((stop) => stop.name === '辅材')?.priority).toBe(1)
    const plan = packPlan(
      { ...seaVehicle, dimensions: { length: 40000, width: 2350, height: 2700 }, maxWeightKg: 28000 },
      shipment.pieces,
      shipment.stops,
      'priority',
      { respectWeight: true },
    )
    expect(plan.totalWeightKg).toBeLessThanOrEqual(28000.5)
    expect(plan.unpacked.some((piece) => piece.reason === '超过当前载重')).toBe(true)
  })
})
