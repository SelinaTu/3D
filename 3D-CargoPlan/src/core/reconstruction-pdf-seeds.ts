// #created 11/08/2026
import type {CargoItem,Container,OptimizationConfig,Orientation,Position3D} from '../types/packing'
import {createEmptyContainer} from './greedy-algorithm'
import {calculateActualDimensions,canPlaceAt,findPlacementPoints,updateContainer} from './packing-utils'
import {analyzeStacking} from './packing-utils'
import {pairGeometryErrors} from './solid-geometry'
import {isGlassRack} from './solid-geometry'

/** Coordinates are hypotheses read from PDF structure; common rules accept or reject each unit. */
export function reconstructionPdfSeed(number:number,items:CargoItem[],config:OptimizationConfig){
  const container=createEmptyContainer(0,config,items),used=new Set<string>(),attempts:unknown[]=[]
  const take=(sheet:string,row:number)=>items.filter(i=>i.rawData._sourceSheet===sheet&&i.rawData._sourceRow===row&&!used.has(i.id))
  const add=(item:CargoItem|undefined,position:Position3D,orientation:Orientation,rotation=0)=>{
    if(!item)return false
    const candidate={item,position,orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)},accepted=canPlaceAt(item,position,orientation,rotation,container)
    attempts.push({id:item.id,position,orientation,rotation,accepted,...(!accepted?{errors:[...container.items.flatMap(other=>pairGeometryErrors(candidate,other,container)),...analyzeStacking([...container.items,candidate],container.loadingRules).errors].slice(0,8)}:{})})
    if(accepted){container.items.push(candidate);updateContainer(container);used.add(item.id)}
    return accepted
  }
  if(number===1){
    for(let i=0;i<3;i++)add(take('玻璃架',24+i)[0],{x:i*1488,y:0,z:0},'standing',90)
    const long=take('门窗',23)
    for(let lane=0;lane<2;lane++)for(let layer=0;layer<10;layer++)add(long[lane*10+layer],{x:4469,y:lane*995,z:layer*215},'flat')
    const w09=take('门窗',12)
    for(let lane=0;lane<3;lane++)for(let layer=0;layer<8;layer++)add(w09[lane*8+layer],{x:lane*3615,y:1990,z:layer*305},'flat')
    for(let i=0;i<6;i++)add(w09[24+i],{x:0,y:1000,z:1076+i*225},'lying')
    add(take('门窗',16)[0],{x:0,y:1820,z:0},'lying')
  }
  if(number===11){
    const rackNumbers=[6,10,14,15,17,19,29,30],rackPositions=new Map<number,{item:CargoItem;position:Position3D}>();let x=0
    for(const n of rackNumbers){const item=items.find(i=>i.rawData._sourceSheet==='玻璃架'&&i.name.startsWith(`${n}#`));if(item&&add(item,{x,y:0,z:0},'standing',90)){rackPositions.set(n,{item,position:{x,y:0,z:0}});x+=item.dimensions.width}}
    const sashes=take('门窗',22)
    for(const [lane,n] of [6,10,14,15].entries()){const rack=rackPositions.get(n);if(!rack)continue;for(let layer=0;layer<6;layer++)add(sashes[lane*6+layer],{x:rack.position.x+5,y:0,z:rack.item.dimensions.height+5+layer*115},'flat',90)}
  }
  return {container:container as Container,attempts,accepted:used.size,rejected:attempts.filter(a=>!(a as {accepted:boolean}).accepted).length}
}

export function reconstructionRackSeed(items:CargoItem[],config:OptimizationConfig,yaw:0|90,smallFirst:boolean,deadline:number){
  const container=createEmptyContainer(0,config,items),attempts:unknown[]=[],racks=items.filter(isGlassRack).sort((a,b)=>b.dimensions.length*b.dimensions.width-a.dimensions.length*a.dimensions.width)
  for(const item of racks){let placed=false;for(const p of findPlacementPoints(container)){if(placed||Date.now()>=deadline)break;if(p.z>0)continue;for(const rotation of [yaw,(yaw+90)%180])if(canPlaceAt(item,p,'standing',rotation,container)){container.items.push({item,position:{...p},orientation:'standing',rotation,actualDimensions:calculateActualDimensions(item.dimensions,'standing',rotation,item.orientationVerticalAxes)});updateContainer(container);placed=true;break}}attempts.push({id:item.id,kind:'rack-floor',accepted:placed})}
  const priority=smallFirst?[5,6,7,22,20,17,9,14,15]:[20,17,22,5,6,7,9,14,15]
  const panels=items.filter(i=>i.rawData._sourceSheet==='门窗'&&priority.includes(Number(i.rawData._sourceRow))).sort((a,b)=>priority.indexOf(Number(a.rawData._sourceRow))-priority.indexOf(Number(b.rawData._sourceRow)))
  for(const item of panels){
    if(Date.now()>=deadline)break
    if(!item.allowedOrientations.includes('flat'))continue
    let placed=false
    for(const rotation of [0,90]){
      const d=calculateActualDimensions(item.dimensions,'flat',rotation,item.orientationVerticalAxes)
      const points=findPlacementPoints(container).filter(p=>p.z>0)
      for(const lower of container.items){points.push({x:lower.position.x+5,y:lower.position.y+5,z:lower.position.z+lower.actualDimensions.height+5})}
      for(const p of points){if(Date.now()>=deadline)break;if(canPlaceAt(item,p,'flat',rotation,container)){container.items.push({item,position:{...p},orientation:'flat',rotation,actualDimensions:d});updateContainer(container);placed=true;break}}
      if(placed)break
    }
    if(placed)attempts.push({id:item.id,kind:'rack-flat-preload',accepted:true})
  }
  return {container,attempts,accepted:container.items.length,rejected:racks.length-container.items.filter(p=>isGlassRack(p.item)).length}
}
