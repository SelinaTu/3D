// #created 11/08/2026
import {describe,it,expect} from 'vitest'
import {tryPlaceItem} from './packing-utils'
import {DEFAULT_CONFIG} from './optimizer'
import {createEmptyContainer} from './greedy-algorithm'
import type {CargoItem} from '../types/packing'
const item:CargoItem={id:'frame',name:'frame',category:'frame',dimensions:{length:100,width:100,height:2560},weight:1,quantity:1,allowedOrientations:['standing'],canStackOnTop:false,canOffsetStack:false,hasGlass:false,colorTag:'',rawData:{}}
describe('方向尺寸预筛选保留装载例外',()=>{
  it('正常高度不适配时拒绝，但专项高度例外仍能装入',()=>{
    const container=createEmptyContainer(0,{...DEFAULT_CONFIG,containerDimensions:{length:1000,width:1000,height:2500}})
    expect(tryPlaceItem(item,container)).toBeNull()
    container.loadingRules={...container.loadingRules!,heightExceptions:{frame:2560}}
    expect(tryPlaceItem(item,container)?.actualDimensions.height).toBe(2560)
  })
  it('过滤不适配方向后仍尝试允许的侧放方向',()=>{
    const container=createEmptyContainer(0,{...DEFAULT_CONFIG,containerDimensions:{length:100,width:500,height:100}})
    const cargo={...item,dimensions:{length:100,width:100,height:400},allowedOrientations:['standing','lying'] as CargoItem['allowedOrientations']}
    expect(tryPlaceItem(cargo,container)?.orientation).toBe('lying')
  })
})
