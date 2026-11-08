// #created 11/08/2026
import type { Container } from '../../types/packing'
import type { Door,Simulation,StopResult } from './model'
import { doorAxis,dimensionAxis,isMax } from './doors'
import { updateContainer } from '../packing-utils'
export type RouteOperation=StopResult['operations'][number]
export type PlaybackStep={stationIndex:number;operationIndex:number;operation?:RouteOperation;before:Container;after:Container}

export function buildPlayback(result:Simulation):PlaybackStep[] {
  let truck=result.initial
  const steps:PlaybackStep[]=[]
  result.stops.forEach((stop,stationIndex)=>{
    steps.push({stationIndex,operationIndex:-1,before:truck,after:truck})
    stop.operations.forEach((operation,operationIndex)=>{
      const after={...truck,items:truck.items.filter(p=>p.item.id!==operation.itemId)}
      if(operation.action==='pickup' || operation.action==='return') after.items.push(operation.placement)
      updateContainer(after)
      steps.push({stationIndex,operationIndex,operation,before:truck,after});truck=after
    })
  })
  return steps
}

/** Presentation only: swept motion between two independently checked stable states. */
export function playbackFrame(step:PlaybackStep,phase:number,door:Door):Container {
  const op=step.operation,t=Math.max(0,Math.min(1,phase))
  if(!op || t<=0) return step.before
  if(t>=1) return step.after
  const outgoing=op.action==='unload' || op.action==='temporary-out'
  const p=op.placement,d=p.actualDimensions
  const face=op.door ?? door,axis=doorAxis(face),size=dimensionAxis(face)
  const outside=isMax(face)?step.before.dimensions[size]+Math.max(300,d[size]*.35):-d[size]-Math.max(300,d[size]*.35)
  const eased=t*t*(3-2*t),from=outgoing?p.position[axis]:outside,to=outgoing?outside:p.position[axis]
  return {...step.before,items:[...step.before.items.filter(i=>i.item.id!==op.itemId),{...p,position:{...p.position,[axis]:from+(to-from)*eased}}]}
}
