// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import type { CargoItem, Container, OptimizationConfig, PlacedItem } from '../types/packing'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, findPlacementPoints, maxPlacementHeight, orientationsFor, tryPlaceItem, updateContainer } from './packing-utils'
import { boundsOverlap, cavityBounds, geometryFor, pairGeometryErrors, solidVolume, solidCentroid, unionArea } from './solid-geometry'
import { validateSolution } from './validation'
import { createPackingSolution } from './solution-builder'
import { DEFAULT_CONFIG, optimize } from './optimizer'
import { loadingRulesFor } from './loading-profile'

const cargo=(id:string,length=100,width=50,height=100):CargoItem=>({id,name:id,category:'箱',dimensions:{length,width,height},weight:1,quantity:1,allowedOrientations:['standing','lying','flat'],canStackOnTop:true,canOffsetStack:false,hasGlass:false,colorTag:'',rawData:{_sourceSheet:'辅材'}})
const frame=(id='frame'):CargoItem=>({...cargo(id,1000,800,100),rawData:{_sourceSheet:'门窗'},cavity:{dimensions:{length:800,width:600,height:100},offset:{x:100,y:100,z:0},allowedSourceSheets:['辅材','门窗'],doorOrientation:'lying'}})
const place=(item:CargoItem,x=0,y=0,z=0,orientation:PlacedItem['orientation']='standing',rotation=0):PlacedItem=>({item,position:{x,y,z},orientation,rotation,actualDimensions:calculateActualDimensions(item.dimensions,orientation,rotation,item.orientationVerticalAxes)})
const container=(items:PlacedItem[]=[],clearance=0,support=0):Container=>{const c:Container={id:'c',dimensions:{length:2000,width:1200,height:1600},maxWeight:1000,items,totalWeight:0,volumeUtilization:0,weightUtilization:0,...(clearance?{loadingRules:{clearanceMm:clearance,supportGapMm:support,supportMechanism:support===5?'5mm-spacer' as const:'none' as const,heightExceptions:{}}}:{})};updateContainer(c);return c}

describe('hollow-frame solid geometry',()=>{
  it('splits an opening into disjoint real rails and rotates the centered cavity with all six axis permutations',()=>{
    const item=frame()
    for(const variant of orientationsFor(item)){
      const p=place(item,13,17,19,variant.orientation,variant.rotation),g=geometryFor(p),inner=cavityBounds(p)!
      expect(g.solids).toHaveLength(4)
      expect(g.solids.some(s=>boundsOverlap(s,inner))).toBe(false)
      expect(g.solids.reduce((sum,s)=>sum+(s.max.x-s.min.x)*(s.max.y-s.min.y)*(s.max.z-s.min.z),0)).toBe(solidVolume(item))
      expect((inner.min.x+inner.max.x)/2).toBeCloseTo(13+p.actualDimensions.length/2)
      expect((inner.min.y+inner.max.y)/2).toBeCloseTo(17+p.actualDimensions.width/2)
      expect((inner.min.z+inner.max.z)/2).toBeCloseTo(19+p.actualDimensions.height/2)
    }
  })
  it('uses real material centroids for an asymmetric opening and rotates its offsets consistently',()=>{
    const item={...frame(),cavity:{...frame().cavity!,dimensions:{length:500,width:600,height:100},offset:{x:100,y:100,z:0}}}
    const p=place(item),c=solidCentroid(p)
    expect(c.x).toBeCloseTo((1000*800*500-500*600*350)/(1000*800-500*600))
    expect(c.y).toBeCloseTo(400)
    const rotated=solidCentroid(place(item,0,0,0,'standing',90))
    expect(rotated.x).toBeCloseTo(800-c.y)
    expect(rotated.y).toBeCloseTo(c.x)
  })
  it('retains semantically different labels even when their dimensions match',()=>{
    const square={...cargo('square',200,200,20),orientationVerticalAxes:{standing:'length',lying:'width',flat:'height'} as CargoItem['orientationVerticalAxes']}
    expect(orientationsFor(square).some(v=>v.orientation==='standing')).toBe(true)
    expect(orientationsFor(square).some(v=>v.orientation==='lying')).toBe(true)
  })
  it('allows authorized nesting, rejects rail penetration, wrong category, wrong orientation and protrusion',()=>{
    const host=place(frame(),0,0,0,'lying'),child=cargo('child'),c=container([host])
    expect(canPlaceAt(child,{x:110,y:10,z:100},'standing',0,c)).toBe(true)
    expect(canPlaceAt(child,{x:90,y:10,z:100},'standing',0,c)).toBe(false)
    expect(canPlaceAt({...child,rawData:{_sourceSheet:'玻璃架'}},{x:110,y:10,z:100},'standing',0,c)).toBe(false)
    const door={...child,rawData:{_sourceSheet:'门窗'}}
    expect(canPlaceAt(door,{x:110,y:0,z:100},'standing',0,c)).toBe(false)
    expect(pairGeometryErrors(host,place(child,110,-1,100))).not.toEqual([])
    const sideways=place(door,110,0,100,'lying')
    expect(pairGeometryErrors(host,sideways)).toEqual([])
  })
  it('does not treat the empty center as a support slab, while matching frame rails support another complete frame',()=>{
    const host=place(frame()),c=container([host])
    expect(canPlaceAt(cargo('floating',100,100,100),{x:200,y:200,z:100},'standing',0,c)).toBe(false)
    const upper=place(frame('upper'),0,0,100)
    expect(analyzeStacking([host,upper]).errors).toEqual([])
    expect(unionArea(geometryFor(host).bottom)).toBe(320000)
  })
  it('treats cavity-bottom support separately from forbidden top stacking while transferring its weight to lower supports',()=>{
    const host={...frame(),canStackOnTop:false,stackableWith:['@self'],maxStackWeight:0,maxStackCount:0},child=cargo('nested')
    const floorHost=place(host,0,0,0,'lying'),floorContainer=container([floorHost])
    expect(canPlaceAt(child,{x:110,y:10,z:100},'standing',0,floorContainer)).toBe(true)
    const base={...cargo('base',1000,100,100),maxStackWeight:2,maxStackCount:1},h=place(host,0,0,100,'lying'),p=place(child,110,10,200)
    const analysis=analyzeStacking([place(base),h,p])
    expect(analysis.errors).toEqual([])
    expect(analysis.topLoads[1]).toBe(0)
    expect(analysis.carriedLoads[1]).toBe(1)
    expect(analysis.topLoads[0]).toBe(2)
    expect(analysis.descendants[1].size).toBe(0)
    expect(analysis.descendants[0].size).toBe(1)
    const weak=container([place({...base,maxStackWeight:1}),h])
    expect(canPlaceAt(child,{x:110,y:10,z:200},'standing',0,weak)).toBe(false)
  })
  it('creates candidate points inside transformed cavities',()=>{
    const c=container([place(frame(),0,0,0,'lying')]),child=cargo('small')
    expect(findPlacementPoints(c)).toContainEqual({x:100,y:0,z:100})
    const p=tryPlaceItem(child,c)!
    expect(p).not.toBeNull()
    // Other free floor positions may precede the opening, but every cavity point remains inspectable.
    expect(canPlaceAt(child,{x:100,y:0,z:100},'standing',0,c)).toBe(true)
  })
})

describe('clearance, real support and authoritative auditing',()=>{
  it('requires five millimetres in nested cavities and only supports a five-millimetre gap when the profile explicitly declares spacers',()=>{
    const host=place(frame(),0,0,0,'lying'),child=cargo('child'),c=container([host],5,5)
    expect(canPlaceAt(child,{x:105,y:5,z:105},'standing',0,c)).toBe(true)
    expect(canPlaceAt(child,{x:104,y:5,z:105},'standing',0,c)).toBe(false)
    expect(canPlaceAt(child,{x:105,y:5,z:100},'standing',0,c)).toBe(false)
    expect(canPlaceAt(child,{x:105,y:5,z:106},'standing',0,c)).toBe(false)
    const noSpacers=container([host],5,0)
    expect(canPlaceAt(child,{x:105,y:5,z:105},'standing',0,noSpacers)).toBe(false)
    expect(canPlaceAt(child,{x:105,y:5,z:100},'standing',0,noSpacers)).toBe(false)
  })
  it('leaves no fictitious clearance at open hole ends, preserving real-wall clearance and full containment',()=>{
    const host=place(frame(),0,0,0,'lying'),child=cargo('flush',100,100,100),c=container([host],5,5)
    expect(canPlaceAt(child,{x:105,y:0,z:105},'standing',0,c)).toBe(true)
    expect(findPlacementPoints(c)).toContainEqual({x:105,y:0,z:105})
    expect(canPlaceAt(child,{x:104,y:0,z:105},'standing',0,c)).toBe(false)
    expect(canPlaceAt(child,{x:105,y:-1,z:105},'standing',0,c)).toBe(false)
    // The same through-opening can reach the real floor without an invented air gap.
    const flatHost=place(frame()),flat=container([flatHost],5,0),floorChild=cargo('floor-child',100,100,80)
    expect(canPlaceAt(floorChild,{x:105,y:105,z:0},'standing',0,flat)).toBe(true)
  })
  it('accepts declared physical spacer support and rejects results under a different request contract',()=>{
    const base=cargo('base',100,100,100),upper=cargo('upper',100,100,100),items=[base,upper]
    const cfg:OptimizationConfig={...DEFAULT_CONFIG,loadingProfile:'villa-pdf',verticalSupport:'5mm-spacer',containerDimensions:{length:11600,width:2250,height:2500}}
    const c=container([place(base)]);c.dimensions={...cfg.containerDimensions};c.maxWeight=cfg.containerMaxWeight;c.loadingRules=loadingRulesFor(items,cfg)
    expect(canPlaceAt(upper,{x:0,y:0,z:105},'standing',0,c)).toBe(true)
    c.items.push(place(upper,0,0,105));updateContainer(c)
    const s=createPackingSolution([c],[],'fixture',0,1)
    expect(validateSolution(s,items,cfg).valid).toBe(true)
    expect(validateSolution(s,items,{...cfg,verticalSupport:'none'}).errors.some(e=>e.includes('口径不一致'))).toBe(true)
    expect(validateSolution(s,items,{...cfg,verticalSupport:undefined}).valid).toBe(false)
  })
  it('labels PDF clearance projection as an assumption model without inserting or claiming physical spacers',()=>{
    const base=cargo('base',100,100,100),upper=cargo('upper',100,100,100),items=[base,upper]
    const cfg:OptimizationConfig={...DEFAULT_CONFIG,loadingProfile:'villa-pdf',verticalSupport:'pdf-clearance-projection',containerDimensions:{length:11600,width:2250,height:2500}}
    const c=container([place(base)]);c.dimensions={...cfg.containerDimensions};c.maxWeight=cfg.containerMaxWeight;c.loadingRules=loadingRulesFor(items,cfg)
    expect(c.loadingRules?.supportMechanism).toBe('pdf-clearance-projection')
    expect(canPlaceAt(upper,{x:0,y:0,z:105},'standing',0,c)).toBe(true)
    c.items.push(place(upper,0,0,105));updateContainer(c)
    const s=createPackingSolution([c],[],'projection-fixture',0,1),validation=validateSolution(s,items,cfg)
    expect(c.items).toHaveLength(2)
    expect(validation.valid).toBe(true)
    expect(validation.scope).toBe('geometry-and-load-assumptions')
    expect(validation.warnings.some(w=>w.includes('未新增实物隔垫'))).toBe(true)
    expect(validation.warnings.some(w=>w.includes('须按支撑接触区域准备和放置隔垫'))).toBe(false)
    expect(validateSolution(s,items,{...cfg,verticalSupport:'5mm-spacer'}).errors.some(e=>e.includes('口径不一致'))).toBe(true)
  })
  it('keeps zero spacing only for two actual glass-rack units',()=>{
    const rack={...cargo('rack',100,100,100),category:'玻璃架',rawData:{_sourceSheet:'玻璃架'}},c=container([place(rack)],5,5)
    expect(canPlaceAt({...rack,id:'rack2'},{x:100,y:0,z:0},'standing',0,c)).toBe(true)
    expect(canPlaceAt(cargo('crate',100,100,100),{x:100,y:0,z:0},'standing',0,c)).toBe(false)
    expect(canPlaceAt(cargo('crate',100,100,100),{x:105,y:0,z:0},'standing',0,c)).toBe(true)
  })
  it('propagates cumulative loads through explicitly spaced support contacts',()=>{
    const base={...cargo('base',100,100,100),maxStackWeight:1},mid=cargo('middle',100,100,100),top=cargo('top',100,100,100)
    const c=container([place(base),place(mid,0,0,105)],5,5)
    expect(canPlaceAt(top,{x:0,y:0,z:210},'standing',0,c)).toBe(false)
    expect(analyzeStacking([...c.items,place(top,0,0,210)],c.loadingRules).topLoads[0]).toBe(2)
  })
  it('audits original cavities rather than forged placed-item metadata and counts only material volume',()=>{
    const host=frame(),child=cargo('child'),h=place(host,0,0,0,'lying'),p=place(child,110,10,100),c=container([h,p]),s=createPackingSolution([c],[],'test',0,1)
    expect(s.stats!.usedVolume).toBe(solidVolume(host)+solidVolume(child))
    expect(validateSolution(s,[host,child]).valid).toBe(true)
    const original={...host,cavity:undefined}
    expect(validateSolution(s,[original,child]).errors.some(e=>e.includes('碰撞'))).toBe(true)
    const wrong={...child,rawData:{_sourceSheet:'禁止类别'}}
    expect(validateSolution(s,[host,wrong]).errors.some(e=>e.includes('获准空腔'))).toBe(true)
  })
  it('packs a small real decoder workload through authorized holes without treating empty centers as supporting slabs',()=>{
    const hosts=Array.from({length:10},(_,i)=>({...frame(`frame-${i}`),canStackOnTop:false,maxStackWeight:0,maxStackCount:0}))
    const children=Array.from({length:40},(_,i)=>cargo(`child-${i}`))
    const solution=optimize([...hosts,...children],{...DEFAULT_CONFIG,loadingProfile:'custom',algorithm:'greedy',containerDimensions:{length:1000,width:100,height:800},timeLimit:3000})
    expect(solution.unpackedItems).toEqual([])
    expect(solution.totalContainers).toBe(10)
    expect(solution.validation?.errors).toEqual([])
    expect(solution.containers.flatMap(c=>c.items).filter(p=>p.item.id.startsWith('child-')).every(p=>p.position.z>0)).toBe(true)
  })
  it('limits the PDF height exception to original W02 source units and detects removed profile rules',()=>{
    const special={...cargo('special',3030,2560,160),name:'W02 框',rawData:{_sourceSheet:'门窗',_sourceRow:16}},c=container()
    c.dimensions.length=4000;c.dimensions.height=2500;c.loadingRules={clearanceMm:5,supportGapMm:0,supportMechanism:'none',heightExceptions:{special:2560}}
    expect(maxPlacementHeight(special,c)).toBe(2560)
    expect(canPlaceAt(special,{x:0,y:0,z:0},'lying',0,c)).toBe(true)
    c.items=[place(special,0,0,0,'lying')];updateContainer(c)
    const s=createPackingSolution([c],[],'test',0,1),cfg:OptimizationConfig={...DEFAULT_CONFIG,loadingProfile:'villa-pdf',containerDimensions:{...c.dimensions},containerMaxWeight:c.maxWeight}
    expect(validateSolution(s,[special],cfg).valid).toBe(true)
    delete s.containers[0].loadingRules
    expect(validateSolution(s,[special],cfg).errors.some(e=>e.includes('口径不一致'))).toBe(true)
  })
})
