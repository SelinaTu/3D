// #created 11/08/2026
import { planWithComparison } from './planning-runner'
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'
self.onmessage = (event: MessageEvent<{ items: CargoItem[]; config: Partial<OptimizationConfig>; seed?: PackingSolution; mode?:'quick'|'compare' }>) => {
  let last=0,phase=''
  try { self.postMessage(planWithComparison(event.data,(stage,detail)=>{const now=Date.now();if(detail && (detail.phase!==phase || now-last>=100 || detail.percent===100)){self.postMessage({stage,detail});last=now;phase=detail.phase}})) }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '计算失败' }) }
}
