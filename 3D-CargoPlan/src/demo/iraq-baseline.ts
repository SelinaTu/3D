// #created 11/08/2026
import frozenUrl from '../../output/reports/iraq-villa-current-best.plan.json?url'
import type { PackingSolution } from '../types/packing'

/** Shared with the HTML workbench: identical cargo, poses and report cabinet order. */
export function requireIraqBaseline(value: unknown): PackingSolution {
  const solution = (value as { solution?: PackingSolution })?.solution
  if (!solution || !Array.isArray(solution.containers) || solution.containers.length !== 11 ||
      !Array.isArray(solution.unpackedItems) || solution.unpackedItems.length || !solution.validation?.valid) {
    throw new Error('伊拉克完整基线缺失或未通过校验')
  }
  const ids = solution.containers.flatMap(c => c.items.map(p => p.item.id))
  if (ids.length !== 1371 || new Set(ids).size !== 1371) throw new Error('伊拉克基线必须包含 1371 件唯一货物')
  return solution
}

let pending: Promise<PackingSolution> | undefined
export async function loadIraqBaseline(): Promise<PackingSolution> {
  pending ??= fetch(frozenUrl).then(async response => {
    if (!response.ok) throw new Error('读取伊拉克完整基线失败')
    return requireIraqBaseline(await response.json())
  }).catch(error => { pending = undefined; throw error })
  return structuredClone(await pending)
}
