// #created 11/08/2026
import { it,expect } from 'vitest'
import { Vector3 } from 'three'
import { stepCamera } from './camera'
import { geoVector } from './model'
it('从美洲定位新加坡时镜头确实转向目标，而非只改变距离',()=>{
  const start=new Vector3(...geoVector(25,-100,3.25)),target=new Vector3(...geoVector(1.28,103.85,3.25))
  const first=stepCamera(start,target,.016)
  expect(first.angleTo(target)).toBeLessThan(start.angleTo(target))
  let current=start
  for(let i=0;i<150;i++)current=stepCamera(current,target,.016)
  expect(current.distanceTo(target)).toBeLessThan(.001)
})
it('跨越对跖点的定位保持在球体外，输入相机位置不被修改',()=>{
  const start=new Vector3(3,0,0),target=new Vector3(-2.3,0,0),copy=start.clone()
  let current=start
  for(let i=0;i<100;i++){current=stepCamera(current,target,.016);expect(current.length()).toBeGreaterThanOrEqual(2.3)}
  expect(start).toEqual(copy);expect(current.distanceTo(target)).toBeLessThan(.01)
})
