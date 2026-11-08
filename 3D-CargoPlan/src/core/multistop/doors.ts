// #created 11/08/2026
import type { Container, Dimensions3D, PlacedItem, Position3D } from '../../types/packing'
import type { Door } from './model'
export const DOORS:Door[]=['x-min','x-max','y-min','y-max','z-max']
export const doorLabel:Record<Door,string>={'x-min':'前端','x-max':'后门','y-min':'左侧','y-max':'右侧','z-max':'顶部吊装'}
export const doorAxis=(door:Door):keyof Position3D=>door.startsWith('y')?'y':door.startsWith('z')?'z':'x'
export const dimensionAxis=(door:Door):keyof Dimensions3D=>door.startsWith('y')?'width':door.startsWith('z')?'height':'length'
export const isMax=(door:Door)=>door.endsWith('max')
export const doorsFor=(c:Container,fallback:Door):Door[]=>c.routeDoors?.length?c.routeDoors:[fallback]
export const doorDepth=(c:Container,p:PlacedItem,door:Door)=>isMax(door)?c.dimensions[dimensionAxis(door)]-p.position[doorAxis(door)]-p.actualDimensions[dimensionAxis(door)]:p.position[doorAxis(door)]
const overlap=(a:number,al:number,b:number,bl:number)=>a<b+bl-1e-6 && b<a+al-1e-6
/** Every allowed face has its own swept rectangular extraction column. */
export function pathClear(target:PlacedItem,items:PlacedItem[],door:Door):boolean {
  const axis=doorAxis(door),size=dimensionAxis(door),pairs=[['x','length'],['y','width'],['z','height']] as const
  return !items.some(o=>o.item.id!==target.item.id && pairs.filter(([a])=>a!==axis).every(([a,s])=>overlap(target.position[a],target.actualDimensions[s],o.position[a],o.actualDimensions[s])) && (isMax(door)?o.position[axis]+o.actualDimensions[size]>target.position[axis]+1e-6:o.position[axis]<target.position[axis]+target.actualDimensions[size]-1e-6))
}
/** Access-only projection; physical orientations and stacking always stay in original axes. */
export function swapSideView(c:Container,target:PlacedItem):{container:Container;target:PlacedItem} {
  const swap=(p:PlacedItem):PlacedItem=>({...p,position:{x:p.position.y,y:p.position.x,z:p.position.z},actualDimensions:{length:p.actualDimensions.width,width:p.actualDimensions.length,height:p.actualDimensions.height}})
  return {container:{...c,dimensions:{length:c.dimensions.width,width:c.dimensions.length,height:c.dimensions.height},items:c.items.map(swap)},target:swap(target)}
}
