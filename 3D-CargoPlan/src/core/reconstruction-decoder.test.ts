// #created 11/08/2026
import { describe,expect,it } from 'vitest'
import type {CargoItem} from '../types/packing'
import {DEFAULT_CONFIG} from './optimizer'
import {reconstructOneContainer,reconstructionColumns} from './reconstruction-decoder'
import {validateSolution} from './validation'
import {createEmptyContainer} from './greedy-algorithm'
import {analyzeStacking,calculateActualDimensions,canPlaceAt,updateContainer} from './packing-utils'
import {createPackingSolution} from './solution-builder'

const config={...DEFAULT_CONFIG,loadingProfile:'villa-pdf' as const,verticalSupport:'pdf-clearance-projection' as const,containerDimensions:{length:11600,width:2250,height:2500},containerMaxWeight:28000}
const frame:CargoItem={id:'long',name:'long frame',category:'frame',dimensions:{length:6600,width:990,height:210},weight:68,quantity:1,allowedOrientations:['flat','lying'],orientationVerticalAxes:{flat:'height',lying:'width'},canStackOnTop:true,canOffsetStack:true,stackableWith:['@self'],hasGlass:false,colorTag:'blue',rawData:{_sourceSheet:'door',_sourceRow:23},constraints:{orientationRules:{flat:{maxStackCount:9},lying:{maxStackWeight:120,strictMaxStackWeight:true}}}}
const policy={seed:1,order:'length' as const,columnMode:'mixed' as const,rackYaw:0 as const,rackChain:false}
describe('fixed PDF allocation reconstruction',()=>{
  it('fits 22 constrained long frames using mixed remainder orientations without another container',()=>{
    const units=Array.from({length:22},(_,i)=>({...frame,id:`long-${i}`})),columns=reconstructionColumns(units,config,'mixed')
    expect(columns.some(c=>c.orientation==='flat')).toBe(true)
    expect(columns.some(c=>c.orientation==='lying')).toBe(true)
    const result=reconstructOneContainer(units,config,policy,Date.now()+2000)
    expect(result.totalContainers).toBe(1);expect(result.unpackedItems).toHaveLength(0)
    expect(validateSolution(result,units,config).valid).toBe(true)
    expect(new Set(result.containers.flatMap(c=>c.items.map(p=>p.item.id)))).toEqual(new Set(units.map(i=>i.id)))
  })
  it('retains an impossible assigned unit in the original manifest rather than moving it to a second container',()=>{
    const units=[{...frame,id:'oversized',dimensions:{length:50000,width:50000,height:50000}}]
    const result=reconstructOneContainer(units,config,policy,Date.now()+200)
    expect(result.totalContainers).toBe(0);expect(result.unpackedItems.map(i=>i.id)).toEqual(['oversized'])
    expect(validateSolution(result,units,config).valid).toBe(true)
  })
  it('permits 130kg flat panels shared across 12 same-source supports while each support stays below 120kg',()=>{
    const sash:CargoItem={...frame,id:'sash',dimensions:{length:2654.5,width:1584.5,height:110},weight:130,allowedOrientations:['lying','flat'],constraints:{orientationRules:{lying:{maxStackWeight:120,strictMaxStackWeight:true},flat:{maxStackCount:9}}}}
    const items=Array.from({length:19},(_,i)=>({...sash,id:`sash-${i}`})),container=createEmptyContainer(0,config,items)
    for(let i=0;i<items.length;i++){
      const orientation=i<12?'lying':'flat',position=i<12?{x:0,y:i*115,z:0}:{x:0,y:0,z:1589.5+(i-12)*115}
      expect(canPlaceAt(items[i],position,orientation,0,container)).toBe(true)
      container.items.push({item:items[i],position,orientation,rotation:0,actualDimensions:calculateActualDimensions(sash.dimensions,orientation,0,sash.orientationVerticalAxes)});updateContainer(container)
    }
    expect(Math.max(...analyzeStacking(container.items,container.loadingRules).topLoads.slice(0,12))).toBeLessThan(120)
    expect(validateSolution(createPackingSolution([container],[],'mixed-support-regression',0,0),items,config).valid).toBe(true)
    expect(canPlaceAt({...sash,id:'eighth-flat'},{x:0,y:0,z:2394.5},'flat',0,container)).toBe(false)
  })
})
