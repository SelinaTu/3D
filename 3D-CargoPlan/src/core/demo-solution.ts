// #created 11/08/2026
import type { CargoItem, PackingSolution } from '../types/packing'
import { DEFAULT_CONFIG, optimize } from './optimizer'

/** Backward compatibility: example cargo is packed by the real constrained engine. */
export function generateDemoSolution(items: CargoItem[]): PackingSolution { return optimize(items, { ...DEFAULT_CONFIG, algorithm: 'greedy' }) }
