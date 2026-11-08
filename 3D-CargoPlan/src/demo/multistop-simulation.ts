// #created 11/08/2026
// Compatibility entry for earlier scripts. New callers should use the core data-driven engine.
import type { Container } from '../types/packing'
import type { Door,RouteTask } from '../core/multistop/model'
import { solveRoute } from '../core/multistop/engine'
import { generateRouteProblem } from '../core/multistop/scenarios'
export type { Simulation,StopResult,RouteTask,RouteProblem } from '../core/multistop/model'
export { createTrainingContainer } from '../core/multistop/scenarios'
export function simulateThreeStops(source:Container,seed=20261030,door:Door='x-max',progress:(stage:string)=>void=()=>{},tasks?:RouteTask[]) {
  return solveRoute(tasks?{schema:'cargoplan.route-problem/v1',seed,door,initial:source,stops:tasks}:generateRouteProblem(source,{seed,door,mode:'challenge',stopCount:3},progress),progress)
}
export function simulateFeasibleThreeStops(source:Container,seed=20261030,door:Door='x-max',progress:(stage:string)=>void=()=>{}) {
  return solveRoute(generateRouteProblem(source,{seed,door,mode:'feasible',stopCount:3},progress),progress)
}
