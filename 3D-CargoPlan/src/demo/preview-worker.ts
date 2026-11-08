// #created 11/08/2026
import { DEFAULT_CONFIG } from '../core/optimizer'
import { previewPacking } from '../core/preview-packing'
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'
self.onmessage = (event: MessageEvent<{items: CargoItem[]; config: Partial<OptimizationConfig>; seed: PackingSolution}>) => {
  try { self.postMessage({ result: previewPacking(event.data.items,{ ...DEFAULT_CONFIG,...event.data.config },event.data.seed) }) }
  catch (e) { self.postMessage({ error: e instanceof Error ? e.message : '检查失败' }) }
}
