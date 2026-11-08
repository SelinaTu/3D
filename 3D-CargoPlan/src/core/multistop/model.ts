// #created 11/08/2026
import type { CargoItem,Container,PlacedItem,HandlingAccess,AccessFace,Dimensions3D } from '../../types/packing'
export type Door = AccessFace
export type RouteVehicle={id:string;name:string;dimensions:Dimensions3D;maxWeight:number;doors:Door[]}
export type StopResult = { name: string; scheduledUnload: string[]; plannedUnload: string[]; unloaded: PlacedItem[]; blockedUnload: string[]; cancelledDelivery: string[]; plannedPickup: CargoItem[]; loaded: PlacedItem[]; failedPickup: CargoItem[]; unloadIssues: Record<string,string>; pickupIssues: Record<string,string>; rehandled: { before: PlacedItem; after: PlacedItem; outDoor?:Door; returnDoor?:Door }[]; operations: { action:'unload'|'temporary-out'|'return'|'pickup'; itemId:string; name:string; placement:PlacedItem; door?:Door }[]; after: Container }
export type RouteTask = { name:string; unloadIds:string[]; pickup:CargoItem[]; pickupPlacements?:PlacedItem[] }
export type Simulation = { initial: Container; stops: StopResult[]; seed: number; door: Door; method?:string; problem?:RouteProblem; initialPlanning?: { changedItems:number; note:string }; audit?: {valid:boolean; errors:string[]} }

export type RouteProblem = { schema:'cargoplan.route-problem/v1'; seed:number; door:Door; initial:Container; stops:RouteTask[]; description?:string; handling?:HandlingAccess; vehicle?:RouteVehicle }
export type SolveOptions = { perStopTimeLimitMs?:number; repackInitial?:boolean }
