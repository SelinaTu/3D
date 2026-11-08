// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { validateRequest } from './input-validation'
import { loadingRulesFor } from '../core/loading-profile'
import type { CargoItem } from '../types/packing'

const item:CargoItem={id:'crate',name:'箱',category:'箱',dimensions:{length:100,width:100,height:100},weight:1,quantity:1,allowedOrientations:['standing'],canStackOnTop:true,hasGlass:false,canOffsetStack:false,colorTag:'',rawData:{}}
const pdf={loadingProfile:'villa-pdf',containerDimensions:{length:11600,width:2250,height:2500}}

describe('explicit vertical-support configuration',()=>{
  it('does not enable spacer support by default or for none',()=>{
    for(const config of [pdf,{...pdf,verticalSupport:'none'}]){
      const parsed=validateRequest({items:[item],config})
      expect(loadingRulesFor(parsed.items,parsed.config)?.supportGapMm).toBe(0)
    }
  })
  it('prepares five-millimetre spacer support only when the PDF configuration explicitly requests it',()=>{
    const parsed=validateRequest({items:[item],config:{...pdf,verticalSupport:'5mm-spacer'}})
    expect(parsed.config.verticalSupport).toBe('5mm-spacer')
    expect(loadingRulesFor(parsed.items,parsed.config)?.supportGapMm).toBe(5)
    expect(loadingRulesFor(parsed.items,parsed.config)?.clearanceMm).toBe(5)
  })
  it('serializes PDF projection semantics separately from physical spacer support',()=>{
    const parsed=validateRequest({items:[item],config:{...pdf,verticalSupport:'pdf-clearance-projection'}})
    expect(loadingRulesFor(parsed.items,parsed.config)).toMatchObject({clearanceMm:5,supportGapMm:5,supportMechanism:'pdf-clearance-projection'})
  })
  it.each(['air','',null,5,false])('rejects invalid support contracts %#',verticalSupport=>{
    expect(()=>validateRequest({items:[item],config:{...pdf,verticalSupport}})).toThrow('verticalSupport')
  })
  it.each(['none','5mm-spacer','pdf-clearance-projection'])('rejects a spacer-contract field on a custom model: %s',verticalSupport=>{
    expect(()=>validateRequest({items:[item],config:{loadingProfile:'custom',verticalSupport}})).toThrow('仅适用于')
  })
})


describe('explicit support-area criterion configuration', () => {
  it('keeps the frozen area criterion implicit and serializes explicit centroid mode', () => {
    const legacy = validateRequest({ items: [item], config: pdf })
    expect(legacy.config.supportCriterion).toBeUndefined()
    expect(loadingRulesFor(legacy.items, legacy.config)?.supportCriterion).toBeUndefined()
    const current = validateRequest({ items: [item], config: { ...pdf, supportCriterion: 'centroid-hull' } })
    expect(current.config.supportCriterion).toBe('centroid-hull')
    expect(loadingRulesFor(current.items, current.config)?.supportCriterion).toBe('centroid-hull')
  })
  it.each(['none', 'ignore-support', '', null, 0, false, {}, []])('rejects invalid area criteria %#', supportCriterion => {
    expect(() => validateRequest({ items: [item], config: { ...pdf, supportCriterion } })).toThrow('supportCriterion')
  })
  it.each(['area-80-centroid', 'centroid-hull'])('rejects PDF-only criteria on custom models: %s', supportCriterion => {
    expect(() => validateRequest({ items: [item], config: { loadingProfile: 'custom', supportCriterion } })).toThrow('仅适用于')
  })
})
