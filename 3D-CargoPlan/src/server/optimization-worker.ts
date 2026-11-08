// #created 11/08/2026
import { parentPort, workerData } from 'node:worker_threads'
import { optimize, optimizeMultiple } from '../core/optimizer'
import { validateSolution } from '../core/validation'
import type { CargoItem, OptimizationConfig } from '../types/packing'

const { items, config, compare } = workerData as { items: CargoItem[]; config: OptimizationConfig; compare: boolean }
try {
  const progress = (data: { progress: number; message: string; algorithm: string }) => parentPort?.postMessage({ type: 'progress', data })
  const solutions = compare ? await optimizeMultiple(items, config, progress) : [optimize(items, config)]
  for (const solution of solutions) {
    if (solution.containers.some(container => container.maxWeight !== config.containerMaxWeight || container.dimensions.length !== config.containerDimensions.length || container.dimensions.width !== config.containerDimensions.width || container.dimensions.height !== config.containerDimensions.height)) throw new Error('方案中的箱型或额定载重与请求配置不一致')
    const validation = validateSolution(solution, items, config)
    solution.validation = validation
    if (!validation.valid) throw new Error(`方案未通过独立校验：${validation.errors.slice(0, 3).join('；')}`)
  }
  parentPort?.postMessage({ type: 'complete', solutions })
} catch (error) {
  parentPort?.postMessage({ type: 'failed', error: error instanceof Error ? error.message : '优化失败' })
}
