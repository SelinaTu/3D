// #created 11/08/2026
import fs from 'node:fs'

const inputPath = process.argv[2]
const outputPath = process.argv[3]
if (!inputPath || !outputPath) {
  console.error('用法: node --import tsx mac/assembly/repack.mjs <input.json> <output.json>')
  process.exit(2)
}

const { planWithComparison } = await import('../../src/demo/planning-runner.ts')

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('items 不能为空')
const inputIds = input.items.map(item => item.id)
if (inputIds.some(id => typeof id !== 'string' || !id) || new Set(inputIds).size !== inputIds.length) throw new Error('货物 ID 必须唯一且非空')
let lastProgressAt = 0, lastPhase = ''
const result = planWithComparison({
  items: input.items,
  config: input.config || {},
  seed: input.seed,
  mode: input.mode === 'compare' ? 'compare' : 'quick'
}, (stage, detail) => {
  const now=Date.now()
  if(detail && (detail.phase!==lastPhase || now-lastProgressAt>=100 || detail.percent===100)) {
    process.stdout.write(JSON.stringify({type:'progress',stage,...detail})+'\n')
    lastProgressAt=now;lastPhase=detail.phase
  }
})
const solution = result.solution
const outputIds = [...solution.containers.flatMap(c => c.items.map(p => p.item.id)), ...solution.unpackedItems.map(i => i.id)]
if (outputIds.length !== inputIds.length || new Set(outputIds).size !== inputIds.length || outputIds.some(id => !inputIds.includes(id))) throw new Error('重算结果货物守恒校验失败')
const first = solution.containers[0] || {
  dimensions: input.config?.containerDimensions || { length: 11600, width: 2250, height: 2500 },
  maxWeight: input.config?.containerMaxWeight || 26000
}
const scene = {
  config: {
    algorithm: 'greedy',
    containerDimensions: { ...first.dimensions },
    containerMaxWeight: first.maxWeight,
    timeLimit: input.config?.timeLimit ?? 20000,
    loadingProfile: input.config?.loadingProfile ?? 'villa-pdf',
    verticalSupport: input.config?.verticalSupport,
    supportCriterion: input.config?.supportCriterion,
    offsetStackScope: input.config?.offsetStackScope,
    clearanceMm: input.config?.clearanceMm
  },
  containers: solution.containers.map((container, index) => ({
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
  })),
  pending: solution.unpackedItems.map(item => ({
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
  })),
  seed: solution,
  summary: result.summary
}
fs.writeFileSync(outputPath, JSON.stringify(scene))
process.stdout.write(JSON.stringify({
  ok: true,
  containers: scene.containers.length,
  placed: scene.containers.reduce((sum, container) => sum + container.items.length, 0),
  pending: scene.pending.length,
  summary: result.summary
}) + '\n')
