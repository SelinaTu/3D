// #created 11/08/2026
import {describe,expect,it} from 'vitest'
import type {CargoItem,Container,OptimizationConfig,PlacedItem} from '../types/packing'
import {DEFAULT_CONFIG} from './optimizer'
import {loadingRulesFor} from './loading-profile'
import {updateContainer} from './packing-utils'
import {createPackingSolution} from './solution-builder'
import {validateSolution} from './validation'
const legacy:OptimizationConfig={...DEFAULT_CONFIG,loadingProfile:'villa-pdf',verticalSupport:'pdf-clearance-projection',offsetStackScope:'item-only',containerDimensions:{length:11600,width:2250,height:2500}}
const current:OptimizationConfig={...legacy,supportCriterion:'centroid-hull'}
const cargo=(id:string,length:number,width:number,height:number):CargoItem=>({id,name:id,category:'fixture',dimensions:{length,width,height},weight:1,quantity:1,allowedOrientations:['standing'],canStackOnTop:true,canOffsetStack:true,hasGlass:false,colorTag:'',rawData:{}})
function fixture(config:OptimizationConfig=current){
  const lower=cargo('support',100,100,100),upper=cargo('upper',1000,100,100),placed:PlacedItem[]=[{item:lower,position:{x:450,y:0,z:0},orientation:'standing',rotation:0,actualDimensions:lower.dimensions},{item:upper,position:{x:0,y:0,z:105},orientation:'standing',rotation:0,actualDimensions:upper.dimensions}]
  const c:Container={id:'scope-fixture',dimensions:{...config.containerDimensions},maxWeight:config.containerMaxWeight,totalWeight:0,volumeUtilization:0,weightUtilization:0,items:placed,loadingRules:loadingRulesFor([lower,upper],config)}
  updateContainer(c)
  return {originals:[lower,upper],c,solution:createPackingSolution([c],[],'CONTRACT-AUDIT',0,0)}
}
describe('authoritative support-contract validation',()=>{
  it('requires the current criterion to be declared, not inferred from legal geometry',()=>{
    const {originals,c,solution}=fixture();delete c.loadingRules!.supportCriterion
    const validation=validateSolution(solution,originals,current)
    expect(validation.valid).toBe(false)
    expect(validation.errors.some(e=>e.includes('口径不一致'))).toBe(true)
  })
  it('never accepts a declared centroid mode as legacy evidence',()=>{
    const {originals,solution}=fixture(),validation=validateSolution(solution,originals,legacy)
    expect(validation.valid).toBe(false)
    expect(validation.errors.some(e=>e.includes('口径不一致'))).toBe(true)
    expect(validation.errors.some(e=>e.includes('80%'))).toBe(true)
  })
  it.each(['ignore-support','',null,0,false])('rejects a tampered serialized support criterion %#',value=>{
    const {originals,c,solution}=fixture()
    ;(c.loadingRules as unknown as Record<string,unknown>).supportCriterion=value
    const authoritative=validateSolution(solution,originals,current)
    expect(authoritative.valid).toBe(false)
    expect(authoritative.errors.some(e=>e.includes('口径不一致'))).toBe(true)
    const standalone=validateSolution(solution,originals)
    expect(standalone.valid).toBe(false)
    expect(standalone.errors.some(e=>e.includes('承托几何判据无效'))).toBe(true)
  })
})
