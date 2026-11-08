// #created 11/08/2026
import type { CargoItem } from '../types/packing'
import sample from './iraq-sample.json'
import { packPlan, type DemoPiece, type DemoStop, type DemoVehicle, type PackPlan } from './priority-pack'

interface SampleFile {
  project: string
  note: string
  items: CargoItem[]
  landStops: Record<string, string[]>
  seaStops: Record<string, string[]>
}

const data = sample as SampleFile
const catalog = new Map(data.items.map((item) => [item.id, item]))

function pieces(groups: Record<string, string[]>): DemoPiece[] {
  return Object.entries(groups).flatMap(([stopId, ids]) => ids.map((id) => {
    const item = catalog.get(id)
    if (!item) throw new Error(`样例缺少货物 ${id}`)
    return { item, stopId }
  }))
}

export const sampleNote = `${data.project}。${data.note}`
export const sampleCount = data.items.length

export const landVehicle: DemoVehicle = {
  id: 'land-box-demo',
  name: '演示厢式尾门',
  dimensions: { length: 7600, width: 2300, height: 2400 },
  maxWeightKg: 8000,
  doorLabel: '尾门在车长外端',
}

export const seaVehicle: DemoVehicle = {
  id: 'sea-40hc-demo',
  name: '演示 40 尺高柜内廓',
  dimensions: { length: 11600, width: 2250, height: 2500 },
  maxWeightKg: 26000,
  doorLabel: '柜门在箱长外端',
}

export const landStops: DemoStop[] = [
  { id: 'A', name: '工地北区', priority: 1, color: '#156a66' },
  { id: 'B', name: '工地南区', priority: 2, color: '#dca54e' },
  { id: 'C', name: '集货仓', priority: 3, color: '#8c87ac' },
]

export const seaStops: DemoStop[] = [
  { id: 'door', name: '到场先卸辅材', priority: 1, color: '#156a66' },
  { id: 'mid', name: '窗与小件', priority: 2, color: '#dca54e' },
  { id: 'deep', name: '大件靠里', priority: 3, color: '#8c87ac' },
]

export interface Scenario {
  id: 'land' | 'sea'
  title: string
  summary: string
  vehicle: DemoVehicle
  stops: DemoStop[]
  pieces: DemoPiece[]
}

export const scenarios: Scenario[] = [
  {
    id: 'land',
    title: '陆运三站',
    summary: '一辆尾门货车依次卸北区、南区，最后到集货仓。先卸的货靠尾门。',
    vehicle: landVehicle,
    stops: landStops,
    pieces: pieces(data.landStops),
  },
  {
    id: 'sea',
    title: '海运一柜',
    summary: '同一批货装进一只高柜。三个组是目的地卸货顺序，先卸的靠柜门。',
    vehicle: seaVehicle,
    stops: seaStops,
    pieces: pieces(data.seaStops),
  },
]

export function buildPlan(scenario: Scenario, mode: 'priority' | 'bulk', omittedId?: string): PackPlan {
  const piecesForPlan = omittedId ? scenario.pieces.filter((piece) => piece.item.id !== omittedId) : scenario.pieces
  return packPlan(scenario.vehicle, piecesForPlan, scenario.stops, mode)
}
