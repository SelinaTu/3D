// #created 11/08/2026
import { Quaternion,Vector3 } from 'three'
/** Rotate on a sphere; linear camera interpolation can cut through the Earth. */
export function stepCamera(current:Vector3,target:Vector3,delta:number):Vector3 {
  const amount=1-Math.exp(-Math.max(0,delta)*5),radius=current.length()
  const rotation=new Quaternion().setFromUnitVectors(current.clone().normalize(),target.clone().normalize())
  // Keep the interpolation receiver separate from its target quaternion.
  const partial=new Quaternion().slerp(rotation,amount)
  return current.clone().applyQuaternion(partial).setLength(radius+(target.length()-radius)*amount)
}
