// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { createEmptyContainer } from './greedy-algorithm'
import { DEFAULT_CONFIG } from './optimizer'
import { updateContainer } from './packing-utils'
import { createPackingSolution } from './solution-builder'
import { previewPacking } from './preview-packing'
import type { CargoItem } from '../types/packing'

const cargo = (id:string):CargoItem => ({ id, name:id, category:'箱', dimensions:{length:10,width:10,height:10}, weight:1, quantity:1, allowedOrientations:['standing'], canStackOnTop:false, canOffsetStack:false, hasGlass:false, colorTag:'', rawData:{} })
const config = { ...DEFAULT_CONFIG, containerDimensions:{length:30,width:10,height:10}, containerMaxWeight:100 }
function fixture() {
  const a = cargo('a'), b = cargo('b'), container = createEmptyContainer(0,config)
  container.items = [a,b].map((item,i)=>({item,position:{x:i*10,y:0,z:0},orientation:'standing' as const,rotation:0,actualDimensions:{...item.dimensions}}))
  updateContainer(container)
  return { a,b,seed:createPackingSolution([container],[],'BASE',0,0) }
}
describe('原位置检查',()=>{
  it('修改尺寸发生碰撞时，把修改的货物放入待装区并保留未修改货物的位置',()=>{
    const {a,b,seed} = fixture()
    const next = {...a,dimensions:{...a.dimensions,length:15}}
    const result = previewPacking([next,b],config,seed)
    expect(result.unpackedItems.map(i=>i.id)).toEqual(['a'])
    expect(result.containers[0].items.map(p=>[p.item.id,p.position.x])).toEqual([['b',10]])
    expect(result.validation?.valid).toBe(true)
  })
  it('新增货物先进入待装区，不自动安排位置',()=>{
    const {a,b,seed} = fixture()
    const result = previewPacking([a,b,cargo('c')],config,seed)
    expect(result.containers[0].items).toHaveLength(2)
    expect(result.unpackedItems.map(i=>i.id)).toEqual(['c'])
  })
})
