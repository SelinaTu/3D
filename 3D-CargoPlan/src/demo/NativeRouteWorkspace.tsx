// #created 11/08/2026
import { useEffect, useState } from 'react'
import { MultiStopTest } from './MultiStopTest'
import type { PackingSolution } from '../types/packing'
import './packing-studio.css'
type Context = { seed?: PackingSolution; bayIndex: number; dirty: boolean }
declare global { interface Window { cargoPlanNativeContext?: Context } }
export function NativeRouteWorkspace() {
  const [context,setContext]=useState<Context|undefined>(()=>window.cargoPlanNativeContext)
  useEffect(()=>{const receive=()=>setContext(window.cargoPlanNativeContext);window.addEventListener('cargoplan-native-context',receive);receive();return()=>window.removeEventListener('cargoplan-native-context',receive)},[])
  const container=context?.seed?.containers[context.bayIndex]
  return <main className="studio native-route-workspace"><div className="native-route-context">{container?`装配 / 第 ${context!.bayIndex+1} 柜 · ${container.items.length} 件 / 多站点作业`:'正在读取装配数据；也可导入独立计划。'}</div><MultiStopTest container={container} dirty={context?.dirty ?? false} door="x-max" /></main>
}
