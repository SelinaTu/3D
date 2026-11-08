// #created 11/08/2026
import fs from 'node:fs'

const source = process.argv[2]
const destination = process.argv[3]
const document = JSON.parse(fs.readFileSync(source, 'utf8'))
const solution = document.solution
const first = solution.containers[0]
const config = {
  algorithm: 'greedy',
  containerDimensions: { ...first.dimensions },
  containerMaxWeight: first.maxWeight,
  timeLimit: 20000,
  loadingProfile: 'villa-pdf',
  verticalSupport: 'pdf-clearance-projection',
  supportCriterion: 'centroid-hull',
  offsetStackScope: 'item-only'
}
const containers = solution.containers.map((container, index) => ({
  id: container.id,
  title: `柜 ${index + 1}`,
  length: container.dimensions.length,
  width: container.dimensions.width,
  height: container.dimensions.height,
  maxWeight: container.maxWeight,
  items: container.items.map(placed => ({
    id: placed.item.id,
    name: placed.item.name,
    category: placed.item.category,
    x: placed.position.x,
    y: placed.position.y,
    z: placed.position.z,
    l: placed.actualDimensions.length,
    w: placed.actualDimensions.width,
    h: placed.actualDimensions.height,
    kg: placed.item.weight,
    glass: placed.item.hasGlass === true,
    cargo: placed.item
  }))
}))
const pending = (solution.unpackedItems || []).map(item => ({
  id: item.id,
  name: item.name,
  category: item.category,
  x: 0,
  y: 0,
  z: 0,
  l: item.dimensions.length,
  w: item.dimensions.width,
  h: item.dimensions.height,
  kg: item.weight,
  glass: item.hasGlass === true,
  cargo: item
}))
fs.writeFileSync(destination, JSON.stringify({ config, containers, pending, seed: solution }, null, 0))
const placed = containers.reduce((sum, container) => sum + container.items.length, 0)
console.log(`导出 ${containers.length} 柜、${placed} 件已装、${pending.length} 件待装`)
