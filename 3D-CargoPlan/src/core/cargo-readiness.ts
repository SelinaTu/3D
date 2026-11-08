// #created 11/08/2026
import type { CargoItem } from '../types/packing'

/** The dimensions of roll-prone goods must describe an explicitly stabilized package. */
export function cargoReviewReasons(item: CargoItem): string[] {
  const reasons = [...(item.constraints?.requiresManualReview ?? [])]
  if (item.shape && ['cylinder', 'coil', 'pipe'].includes(item.shape)) {
    if (item.packaging?.envelopeConfirmed !== true) reasons.push('请确认含包装的外包尺寸')
    if (item.packaging?.antiRoll !== true) reasons.push('请确认防滚包装措施')
  }
  return [...new Set(reasons)]
}
