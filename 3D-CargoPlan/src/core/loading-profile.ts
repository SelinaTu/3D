// #created 11/08/2026
import type { CargoItem, Container, OptimizationConfig } from '../types/packing'

/** User-approved reference: PDF net loading envelope, W02 source row exception. */
export function loadingRulesFor(items: CargoItem[], config: OptimizationConfig): Container['loadingRules'] {
  if (config.loadingProfile !== 'villa-pdf') return config.clearanceMm === undefined && !config.preventCrossStopStacking ? undefined : { clearanceMm: config.clearanceMm ?? 0, glassRacksTouch: false, supportGapMm: 0, supportMechanism: 'none', heightExceptions: {}, ...(config.preventCrossStopStacking ? { preventCrossStopStacking: true } : {}) }
  const heightExceptions: Record<string, number> = {}
  for (const item of items) {
    if (item.rawData._sourceSheet === '门窗' && item.rawData._sourceRow === 16 && item.name.includes('W02') && item.name.includes('框') && item.dimensions.length === 3030 && item.dimensions.width === 2560 && item.dimensions.height === 160) heightExceptions[item.id] = 2560
  }
  const supportMechanism = config.verticalSupport ?? 'none'
  return { clearanceMm: 5, glassRacksTouch: true, supportGapMm: supportMechanism === 'none' ? 0 : 5, supportMechanism, heightExceptions, ...(config.preventCrossStopStacking ? { preventCrossStopStacking: true } : {}), ...(config.offsetStackScope ? { offsetStackScope: config.offsetStackScope } : {}), ...(config.supportCriterion ? { supportCriterion: config.supportCriterion } : {}) }
}
