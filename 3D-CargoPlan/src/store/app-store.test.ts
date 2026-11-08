// #created 11/08/2026
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './app-store'
import type { CargoItem, PackingSolution } from '../types/packing'

const item: CargoItem = { id: 'new-cargo', name: '箱', category: '箱', dimensions: { length: 100, width: 100, height: 100 }, weight: 1, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: true, hasGlass: false, canOffsetStack: false, colorTag: '', rawData: {} }
const solution = (id: string): PackingSolution => ({ id, containers: [], totalContainers: 0, totalItems: 1, avgVolumeUtilization: 0, avgWeightUtilization: 0, unpackedItems: [item], score: 0, algorithm: 'greedy', computeTime: 1 })
beforeEach(() => useAppStore.getState().reset())

describe('workspace result lifecycle', () => {
  it('invalidates results and selection when replacing a cargo list', () => {
    const state = useAppStore.getState()
    state.setSolutions([solution('old')]); state.setProgress(100); state.setError('old error')
    state.setCargoItems([item])
    const next = useAppStore.getState()
    expect(next.cargoItems).toEqual([item])
    expect(next.solutions).toEqual([])
    expect(next.selectedSolutionId).toBeNull()
    expect(next.progress).toBe(0)
    expect(next.error).toBeNull()
  })
  it('invalidates results when dimensions or optimization conditions change', () => {
    const state = useAppStore.getState()
    state.setCargoItems([item]); state.setSolutions([solution('old')])
    state.setConfig({ ...state.config, containerMaxWeight: 100 })
    expect(useAppStore.getState().solutions).toEqual([])
    expect(useAppStore.getState().selectedSolutionId).toBeNull()
    expect(useAppStore.getState().cargoItems).toEqual([item])
  })
  it('selects a returned solution even when the previous selection has disappeared', () => {
    const state = useAppStore.getState()
    state.setSolutions([solution('old')]); state.setSolutions([solution('new'), solution('next')])
    expect(useAppStore.getState().selectedSolutionId).toBe('new')
    state.selectSolution('next'); state.selectSolution('missing')
    expect(useAppStore.getState().selectedSolutionId).toBe('next')
    state.setSolutions([])
    expect(useAppStore.getState().selectedSolutionId).toBeNull()
  })
  it('restores initial configuration along with clearing loaded state', () => {
    const state = useAppStore.getState()
    const initial = state.config.containerMaxWeight
    state.setConfig({ ...state.config, containerMaxWeight: 1 }); state.setCargoItems([item]); state.setOptimizing(true)
    state.reset()
    expect(useAppStore.getState().config.containerMaxWeight).toBe(initial)
    expect(useAppStore.getState().cargoItems).toEqual([])
    expect(useAppStore.getState().isOptimizing).toBe(false)
  })
})
