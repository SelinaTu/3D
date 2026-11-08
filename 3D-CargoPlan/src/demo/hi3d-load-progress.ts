// #created 11/08/2026
import type { PackPlan } from './priority-pack'

/** Counts only loaded, blocked pieces; never blocker pairs. */
export function loadProgress(plan: Pick<PackPlan, 'loadOrder' | 'blocking'>, step: number) {
  const shown = Math.max(0, Math.min(Math.floor(step), plan.loadOrder.length))
  const indices = new Map(plan.loadOrder.map((p, i) => [p.item.id, i + 1]))
  const active: Array<{ itemId: string; blockedBy: string[] }> = []
  const events = new Map<number, string[]>()
  for (const row of plan.blocking) {
    const target = indices.get(row.itemId)
    if (target === undefined) continue
    const onsets = row.blockedBy.flatMap(id => {
      const index = indices.get(id)
      return index === undefined ? [] : [Math.max(target, index)]
    })
    if (onsets.length) {
      const onset = Math.min(...onsets)
      events.set(onset, [...(events.get(onset) ?? []), row.itemId])
    }
    if (target > shown) continue
    const blockedBy = row.blockedBy.filter(id => (indices.get(id) ?? Infinity) <= shown)
    if (blockedBy.length) active.push({ itemId: row.itemId, blockedBy })
  }
  return { shown, active, blockedIds: new Set(active.map(row => row.itemId)), blockerIds: new Set(active.flatMap(row => row.blockedBy)), events: [...events].sort(([a], [b]) => a - b).map(([step, itemIds]) => ({ step, itemIds })) }
}
