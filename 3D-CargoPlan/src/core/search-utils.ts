// #created 11/08/2026
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'
import { compareSolutions } from './evaluator'

export function randomFor(items: CargoItem[]): () => number {
  let state = items.reduce((s, i) => { for (const c of i.id) s = Math.imul(s ^ c.charCodeAt(0), 16777619); return s }, 2166136261) >>> 0
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export function shuffled<T>(values: T[], random: () => number): T[] { const result = [...values]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] } return result }
export function swapOrder<T>(values: T[], i: number, j: number): T[] { const result = [...values]; [result[i], result[j]] = [result[j], result[i]]; return result }
export function finishSearch(best: PackingSolution, algorithm: string, start: number, deadline: number, mode: PackingSolution['searchMode'] = 'heuristic', extraNotes: string[] = []): PackingSolution {
  const computeTime = Date.now() - start
  return { ...best, id: `solution-${algorithm}-${Date.now()}`, algorithm, computeTime, stats: best.stats ? { ...best.stats, executionTime: computeTime } : undefined, searchMode: mode, terminationReason: Date.now() >= deadline ? 'time-limit' : 'iteration-limit', notes: [...(best.notes ?? []), ...extraNotes] }
}
export function better(a: PackingSolution, b: PackingSolution): boolean { return compareSolutions(a, b) < 0 }
export function withDeadline(config: OptimizationConfig, deadline: number): OptimizationConfig { return { ...config, deadline, timeLimit: Math.max(0, deadline - Date.now()) } }
