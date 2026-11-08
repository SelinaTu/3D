// #created 11/08/2026
import type { CargoItem, Container } from '../types/packing'
import { updateContainer } from '../core/packing-utils'

/** Independent demo inventory. Never borrows or changes the user's assembly snapshot. */
export function createRouteDemoContainer(): Container {
  const sizes = [
    { length: 340, width: 400, height: 260 },
    { length: 255, width: 360, height: 200 },
    { length: 300, width: 360, height: 230 },
    { length: 350, width: 430, height: 170 }
  ]
  const container: Container = {
    id: 'independent-route-demo', dimensions: { length: 4200, width: 2100, height: 2300 },
    maxWeight: 3000, unloadingDoor: 'x-max', routeDoors: ['x-max'],
    items: [], totalWeight: 0, volumeUtilization: 0, weightUtilization: 0,
    loadingRules: { clearanceMm: 5, supportGapMm: 0, supportMechanism: 'none', heightExceptions: {} }
  }
  container.items = Array.from({ length: 8 }, (_, i) => {
    const dimensions = { ...sizes[i % sizes.length] }
    const item: CargoItem = {
      id: `demo-aux-${i + 1}`, name: `演示辅材 ${i + 1}`, category: '演示包装箱',
      dimensions, weight: 12 + i, quantity: 1, shape: 'box',
      allowedOrientations: ['standing'], canStackOnTop: false,
      canOffsetStack: false, hasGlass: false, colorTag: '#82aaa2',
      constraints: { mustBeOnFloor: true, horizontalRotations: [0] },
      rawData: { _demo: true, _description: '参考伊拉克辅材尺寸量级的独立演示数据，非用户装配货物' }
    }
    return {
      item, position: { x: 3800 - Math.floor(i / 2) * 400, y: i % 2 ? 1600 : 100, z: 0 },
      orientation: 'standing', rotation: 0, actualDimensions: { ...dimensions }
    }
  })
  updateContainer(container)
  return container
}
