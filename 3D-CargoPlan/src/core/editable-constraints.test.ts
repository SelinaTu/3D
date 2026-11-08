// #created 11/08/2026
import { describe,expect,it } from 'vitest'
import type { CargoItem } from '../types/packing'
import { DEFAULT_CONFIG,optimize } from './optimizer'
import { previewPacking } from './preview-packing'
import { createEmptyContainer } from './greedy-algorithm'
import { canPlaceAt,updateContainer } from './packing-utils'
const item=(id:string):CargoItem=>({id,name:id,category:'箱',dimensions:{length:10,width:10,height:2},weight:id==='base'?10:5,quantity:1,allowedOrientations:['standing'],canStackOnTop:id==='base',canOffsetStack:false,hasGlass:false,colorTag:'',rawData:{},constraints:{horizontalRotations:[0]}})
const config={...DEFAULT_CONFIG,algorithm:'greedy' as const,containerDimensions:{length:10,width:10,height:4},containerMaxWeight:100,timeLimit:100}
describe('编辑参数贯穿原位置检查和重新计算',()=>{
  const cases:Array<[string,(items:CargoItem[])=>void,number,number]>=[
    ['顶部承重',a=>{a[0].maxStackWeight=4},2,0],
    ['上方最多件数',a=>{a[0].maxStackCount=0},2,0],
    ['禁止顶部承托',a=>{a[0].canStackOnTop=false},2,0],
    ['必须落地',a=>{a[1].constraints!.mustBeOnFloor=true},2,0],
    ['单方向顶部总承重',a=>{a[0].constraints!.orientationRules={standing:{maxStackWeight:4}}},2,0],
    ['单方向上方件数',a=>{a[0].constraints!.orientationRules={standing:{maxStackCount:0}}},2,0],
    ['单方向单件限重',a=>{a[0].constraints!.orientationRules={standing:{maxSupportedItemWeight:4}}},2,0],
    ['同组混装',a=>{a[0].constraints={...a[0].constraints,mixGroup:'A',onlySameMixGroup:true};a[1].constraints!.mixGroup='B'},2,0],
    ['重量超过额定载重',a=>{a[1].weight=101},1,1],
    ['尺寸超过净空',a=>{a[1].dimensions.width=11},1,1],
    ['允许方向',a=>{a[1].allowedOrientations=['lying']},1,1],
    ['水平旋转',a=>{a[1].constraints!.horizontalRotations=[90]},1,0],
  ]
  for(const [name,edit,bins,pending] of cases) it(name,()=>{
    const items=[item('base'),item('top')],seed=optimize(items,config)
    expect(seed.totalContainers).toBe(1);expect(seed.unpackedItems).toHaveLength(0)
    const changed=structuredClone(items);edit(changed)
    const preview=previewPacking(changed,config,seed)
    expect(preview.unpackedItems.length).toBeGreaterThan(0)
    const result=optimize(changed,config)
    expect(result.totalContainers).toBe(bins);expect(result.unpackedItems).toHaveLength(pending)
    expect(result.validation?.valid).toBe(true)
    if(name==='水平旋转') expect(result.containers[0].items.find(p=>p.item.id==='top')?.rotation).toBe(90)
  })
  it('错位叠放与上方最大面要求均改变实际摆放判定',()=>{
    const base={...item('base'),canOffsetStack:true},top=item('top'),truck=createEmptyContainer(0,{...config,containerDimensions:{length:20,width:10,height:12}})
    truck.items=[{item:base,position:{x:0,y:0,z:0},orientation:'standing',rotation:0,actualDimensions:base.dimensions}];updateContainer(truck)
    expect(canPlaceAt(top,{x:1,y:0,z:2},'standing',0,truck)).toBe(false)
    top.canOffsetStack=true
    expect(canPlaceAt(top,{x:1,y:0,z:2},'standing',0,truck)).toBe(true)
    base.constraints!.supportedItemsLargestFaceDown=true;updateContainer(truck)
    top.dimensions={length:10,width:2,height:10};top.allowedOrientations=['standing','lying']
    expect(canPlaceAt(top,{x:0,y:0,z:2},'standing',0,truck)).toBe(false)
    expect(canPlaceAt(top,{x:0,y:0,z:2},'lying',0,truck)).toBe(true)
  })
})
