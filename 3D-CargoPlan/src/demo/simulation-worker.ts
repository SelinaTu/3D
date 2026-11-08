// #created 11/08/2026
import type { Container } from '../types/packing'
import type { RouteProblem,SolveOptions } from '../core/multistop/model'
import { solveRoute } from '../core/multistop/engine'
import { generateRouteProblem,type ScenarioOptions } from '../core/multistop/scenarios'
type Request={type:'generate';container:Container;options:ScenarioOptions} | {type:'solve';problem:RouteProblem;options?:SolveOptions}
self.onmessage = (event: MessageEvent<Request>) => {
  const progress=(stage:string)=>self.postMessage({stage})
  try {
    const input=event.data
    if(input.type==='generate') self.postMessage({problem:generateRouteProblem(input.container,input.options,progress)})
    else self.postMessage({result:solveRoute(input.problem,progress,input.options)})
  }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '模拟失败' }) }
}
