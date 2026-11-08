// #created 11/08/2026
import presets from '../../data/vehicle-presets.json'
import type { RouteProblem, RouteVehicle, Door } from './model'
import type { HandlingAccess } from '../../types/packing'
import { DOORS } from './doors'
export type VehiclePreset=RouteVehicle & {body:string;hint:string;mode:HandlingAccess['mode']}
export const VEHICLES=presets as VehiclePreset[]
export function validateVehicle(value:unknown):asserts value is RouteVehicle {
  const v=value as RouteVehicle
  if(!v || typeof v!=='object' || typeof v.id!=='string' || typeof v.name!=='string' || !v.dimensions || ![v.dimensions.length,v.dimensions.width,v.dimensions.height].every(n=>Number.isFinite(n) && n>=100 && n<=50000) || !Number.isFinite(v.maxWeight) || v.maxWeight<=0 || !Array.isArray(v.doors) || !v.doors.length || new Set(v.doors).size!==v.doors.length || v.doors.some(d=>!DOORS.includes(d)))throw new Error('车型规格无效：净空为 100–50000 mm、载重为正数，并至少选择一个装卸面')
}
export const routeVehicle=(p:RouteProblem):RouteVehicle=>p.vehicle ?? {id:'custom',name:'当前装配货舱',dimensions:p.initial.dimensions,maxWeight:p.initial.maxWeight,doors:[p.door]}
export const primaryDoor=(doors:Door[])=>doors[0]
