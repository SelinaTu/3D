// #created 11/08/2026
import type { Dimensions3D } from '../types/packing'
/** JSON key order can be alphabetical after native encoding. Always label L / W / H. */
export const dimensionText=(d:Dimensions3D)=>[d.length,d.width,d.height].join(' × ')
