// #created 11/08/2026
import { create } from 'zustand'
import type { CargoItem, PackingSolution, OptimizationConfig } from '../types/packing'

// Keep browser state independent of the server's algorithm implementations.
const initialConfig: OptimizationConfig = {
  containerDimensions: { length: 12032, width: 2352, height: 2698 },
  containerMaxWeight: 28000,
  weights: { containerCount: 0.5, volumeUtilization: 0.3, weightBalance: 0.1, stabilityPenalty: 0.1 },
  algorithm: 'greedy', timeLimit: 30000, populationSize: 20, generations: 30
}
interface AppState {
  cargoItems: CargoItem[]
  solutions: PackingSolution[]
  selectedSolutionId: string | null
  config: OptimizationConfig
  isOptimizing: boolean
  progress: number
  error: string | null
  setCargoItems: (items: CargoItem[]) => void
  setSolutions: (solutions: PackingSolution[]) => void
  selectSolution: (id: string) => void
  setConfig: (config: OptimizationConfig) => void
  setOptimizing: (optimizing: boolean) => void
  setProgress: (progress: number) => void
  setError: (error: string | null) => void
  reset: () => void
}
const emptyResults = { solutions: [], selectedSolutionId: null, progress: 0, error: null }
export const useAppStore = create<AppState>((set) => ({
  cargoItems: [], ...emptyResults, config: initialConfig, isOptimizing: false,
  setCargoItems: (cargoItems) => set({ cargoItems, ...emptyResults }),
  setSolutions: (solutions) => set({ solutions, selectedSolutionId: solutions[0]?.id ?? null }),
  selectSolution: (id) => set((state) => ({ selectedSolutionId: state.solutions.some((solution) => solution.id === id) ? id : state.selectedSolutionId })),
  setConfig: (config) => set({ config, ...emptyResults }),
  setOptimizing: (isOptimizing) => set({ isOptimizing }),
  setProgress: (progress) => set({ progress: Math.min(100, Math.max(0, progress)) }),
  setError: (error) => set({ error }),
  reset: () => set({ cargoItems: [], ...emptyResults, config: initialConfig, isOptimizing: false })
}))
export const useSelectedSolution = () => useAppStore((state) => state.solutions.find((solution) => solution.id === state.selectedSolutionId) ?? null)
