// #created 11/08/2026
import type { CargoItem, Container, Dimensions3D, Orientation, PlacedItem, Position3D, SpaceBounds } from '../types/packing'

const EPS = 1e-6
export interface FaceRectangle { minX: number; maxX: number; minY: number; maxY: number; z: number }
export interface SolidGeometry { envelope: SpaceBounds; solids: SpaceBounds[]; cavity?: SpaceBounds; bottom: FaceRectangle[]; top: FaceRectangle[] }
const size = (d: Dimensions3D) => [d.length, d.width, d.height]
function axisOrder(item: CargoItem, orientation: Orientation): [number, number, number] {
  const vertical = item.orientationVerticalAxes?.[orientation] ?? ({ standing: 'height', lying: 'width', flat: 'length' } as const)[orientation]
  return vertical === 'length' ? [1, 2, 0] : vertical === 'width' ? [0, 2, 1] : [0, 1, 2]
}
function transform(local: SpaceBounds, placed: PlacedItem): SpaceBounds {
  const order = axisOrder(placed.item, placed.orientation)
  const low = [local.min.x, local.min.y, local.min.z], high = [local.max.x, local.max.y, local.max.z]
  let a = order.map(i => low[i]), b = order.map(i => high[i])
  const outer = order.map(i => size(placed.item.dimensions)[i])
  // Right-angle rotations reflect offsets as well as swapping dimensions.
  if (placed.rotation === 90) { a = [outer[1] - b[1], a[0], a[2]]; b = [outer[1] - low[order[1]], high[order[0]], b[2]] }
  else if (placed.rotation === 180) { a = [outer[0] - b[0], outer[1] - b[1], a[2]]; b = [outer[0] - low[order[0]], outer[1] - low[order[1]], b[2]] }
  else if (placed.rotation === 270) { a = [a[1], outer[0] - b[0], a[2]]; b = [high[order[1]], outer[0] - low[order[0]], b[2]] }
  const p = placed.position
  return { min: { x: a[0] + p.x, y: a[1] + p.y, z: a[2] + p.z }, max: { x: b[0] + p.x, y: b[1] + p.y, z: b[2] + p.z } }
}
export function boundsOverlap(a: SpaceBounds, b: SpaceBounds): boolean {
  return a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS && a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS && a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS
}
export function boundsContains(a: SpaceBounds, b: SpaceBounds, gap = 0): boolean {
  return ['x','y','z'].every(key => { const axis = key as keyof Position3D; return b.min[axis] >= a.min[axis] + gap - EPS && b.max[axis] <= a.max[axis] - gap + EPS })
}
function intersect(a: FaceRectangle, b: FaceRectangle): FaceRectangle | null {
  const r = { minX: Math.max(a.minX,b.minX), maxX: Math.min(a.maxX,b.maxX), minY: Math.max(a.minY,b.minY), maxY: Math.min(a.maxY,b.maxY), z: a.z }
  return r.maxX > r.minX + EPS && r.maxY > r.minY + EPS ? r : null
}
function subtract(a: FaceRectangle, b: FaceRectangle): FaceRectangle[] {
  const cut = intersect(a,b)
  if (!cut) return [a]
  return [
    { ...a, maxX: cut.minX }, { ...a, minX: cut.maxX },
    { ...a, minX: cut.minX, maxX: cut.maxX, maxY: cut.minY },
    { ...a, minX: cut.minX, maxX: cut.maxX, minY: cut.maxY }
  ].filter(r => r.maxX > r.minX + EPS && r.maxY > r.minY + EPS)
}
function topFaces(solids: SpaceBounds[]): FaceRectangle[] {
  const faces: FaceRectangle[] = []
  for (const solid of solids) {
    let visible: FaceRectangle[] = [{ minX: solid.min.x, maxX: solid.max.x, minY: solid.min.y, maxY: solid.max.y, z: solid.max.z }]
    for (const other of solids) {
      if (other === solid || other.min.z > solid.max.z + EPS || other.max.z <= solid.max.z + EPS) continue
      const cover = { minX: other.min.x, maxX: other.max.x, minY: other.min.y, maxY: other.max.y, z: solid.max.z }
      visible = visible.flatMap(face => subtract(face,cover))
    }
    faces.push(...visible)
  }
  return faces
}
const geometryCache = new WeakMap<PlacedItem, { key: string; geometry: SolidGeometry }>()
export function geometryFor(placed: PlacedItem): SolidGeometry {
  const d = placed.item.dimensions, p = placed.position, cavity = placed.item.cavity
  const key = [p.x,p.y,p.z,d.length,d.width,d.height,placed.orientation,placed.rotation,placed.actualDimensions.length,placed.actualDimensions.width,placed.actualDimensions.height,
    ...axisOrder(placed.item,placed.orientation), ...(cavity ? [...size(cavity.dimensions),cavity.offset.x,cavity.offset.y,cavity.offset.z] : [])].join('/')
  const cached = geometryCache.get(placed)
  if (cached?.key === key) return cached.geometry
  const envelope = { min: { ...p }, max: { x: p.x + placed.actualDimensions.length, y: p.y + placed.actualDimensions.width, z: p.z + placed.actualDimensions.height } }
  const box = (x0: number,y0: number,z0: number,x1: number,y1: number,z1: number): SpaceBounds => ({ min:{x:x0,y:y0,z:z0},max:{x:x1,y:y1,z:z1} })
  let local = [box(0,0,0,d.length,d.width,d.height)], inner: SpaceBounds | undefined
  if (cavity) {
    const c = cavity.offset, q = cavity.dimensions
    inner = box(c.x,c.y,c.z,c.x+q.length,c.y+q.width,c.z+q.height)
    if (![c.x,c.y,c.z,...size(q)].every(Number.isFinite) || Math.min(c.x,c.y,c.z)<-EPS || Math.min(...size(q))<=0 || !boundsContains(local[0],inner)) throw new Error(`${placed.item.id}: 空腔必须完整位于原始外包尺寸内`)
    local = [box(0,0,0,d.length,d.width,c.z), box(0,0,c.z+q.height,d.length,d.width,d.height),
      box(0,0,c.z,c.x,d.width,c.z+q.height), box(c.x+q.length,0,c.z,d.length,d.width,c.z+q.height),
      box(c.x,0,c.z,c.x+q.length,c.y,c.z+q.height), box(c.x,c.y+q.width,c.z,c.x+q.length,d.width,c.z+q.height)]
      .filter(b => b.max.x>b.min.x+EPS && b.max.y>b.min.y+EPS && b.max.z>b.min.z+EPS)
  }
  if (!local.length) throw new Error(`${placed.item.id}: 空腔不能删除全部实体材料`)
  const solids = local.map(b => transform(b,placed))
  const bottom = solids.filter(b => Math.abs(b.min.z - envelope.min.z) < EPS).map(b => ({minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,z:b.min.z}))
  const geometry = { envelope, solids, cavity: inner ? transform(inner,placed) : undefined, bottom, top: topFaces(solids) }
  geometryCache.set(placed,{key,geometry})
  return geometry
}
export function solidBounds(placed: PlacedItem): SpaceBounds[] { return geometryFor(placed).solids }
export function cavityBounds(placed: PlacedItem): SpaceBounds | undefined { return geometryFor(placed).cavity }
export function bottomSurface(placed: PlacedItem): FaceRectangle[] { return geometryFor(placed).bottom }
export function unionArea(rectangles: FaceRectangle[]): number {
  if (!rectangles.length) return 0
  const xs = [...new Set(rectangles.flatMap(r => [r.minX,r.maxX]))].sort((a,b)=>a-b)
  let area = 0
  for(let i=0;i<xs.length-1;i++) {
    const intervals = rectangles.filter(r=>r.minX<xs[i+1]-EPS&&r.maxX>xs[i]+EPS).map(r=>[r.minY,r.maxY]).sort((a,b)=>a[0]-b[0])
    let covered=0,low=0,high=0,started=false
    for(const [a,b] of intervals) {
      if(!started){low=a;high=b;started=true}
      else if(a>high+EPS){covered+=high-low;low=a;high=b}else high=Math.max(high,b)
    }
    if(started)covered+=high-low
    area+=(xs[i+1]-xs[i])*covered
  }
  return area
}
export function isGlassRack(item: CargoItem): boolean { return item.rawData._sourceSheet === '玻璃架' || /玻璃架/.test(item.category) }
export function requiredClearance(a: CargoItem,b: CargoItem,container?: Pick<Container,'loadingRules'>): number {
  return container?.loadingRules?.glassRacksTouch !== false && isGlassRack(a)&&isGlassRack(b) ? 0 : container?.loadingRules?.clearanceMm ?? 0
}
export function supportGap(a: CargoItem,b: CargoItem,container?: Pick<Container,'loadingRules'>): number {
  return container?.loadingRules?.glassRacksTouch !== false && isGlassRack(a)&&isGlassRack(b) ? 0 : container?.loadingRules?.supportGapMm ?? 0
}
export function contactRectangles(upper: PlacedItem,lower: PlacedItem,gap=0): FaceRectangle[] {
  const z=upper.position.z, lowerTop=lower.position.z+lower.actualDimensions.height
  if(z<lower.position.z+gap-EPS||z>lowerTop+gap+EPS||(!lower.item.cavity&&Math.abs(z-lowerTop-gap)>EPS))return []
  if(upper.position.x>=lower.position.x+lower.actualDimensions.length-EPS||upper.position.x+upper.actualDimensions.length<=lower.position.x+EPS||upper.position.y>=lower.position.y+lower.actualDimensions.width-EPS||upper.position.y+upper.actualDimensions.width<=lower.position.y+EPS)return []
  const a=geometryFor(upper),b=geometryFor(lower),contacts:FaceRectangle[]=[]
  for(const bottom of a.bottom)for(const top of b.top) {
    if(Math.abs(bottom.z-top.z-gap)>EPS)continue
    const overlap=intersect(bottom,top)
    if(overlap)contacts.push(overlap)
  }
  return contacts
}
export function supportedCenter(rectangles:FaceRectangle[],x:number,y:number):boolean {
  const points=rectangles.flatMap(r=>[[r.minX,r.minY],[r.minX,r.maxY],[r.maxX,r.minY],[r.maxX,r.maxY]])
  if(!points.length)return false
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1])
  const cross=(a:number[],b:number[],c:number[]) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
  const lower:number[][]=[],upper:number[][]=[]
  for(const p of points){while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,p)<=EPS)lower.pop();lower.push(p)}
  for(const p of [...points].reverse()){while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,p)<=EPS)upper.pop();upper.push(p)}
  const hull=[...lower.slice(0,-1),...upper.slice(0,-1)]
  return hull.length>=3&&hull.every((p,i)=>cross(p,hull[(i+1)%hull.length],[x,y])>=-EPS)
}
export function nestedInside(child:PlacedItem,host:PlacedItem):boolean {
  const cavity=host.item.cavity,inner=cavityBounds(host)
  const permitted = cavity?.allowedSourceSheets?.includes(String(child.item.rawData._sourceSheet)) || cavity?.allowedCategories?.includes(child.item.category)
  return !!cavity&&!!inner&&!!permitted&&(!cavity.doorOrientation||child.item.rawData._sourceSheet!=='门窗'||child.orientation===cavity.doorOrientation)&&boundsContains(inner,geometryFor(child).envelope)
}
export function pairGeometryErrors(a:PlacedItem,b:PlacedItem,container?:Pick<Container,'loadingRules'>):string[] {
  const gap=requiredClearance(a.item,b.item,container)
  const ea={min:a.position,max:{x:a.position.x+a.actualDimensions.length,y:a.position.y+a.actualDimensions.width,z:a.position.z+a.actualDimensions.height}}
  const eb={min:b.position,max:{x:b.position.x+b.actualDimensions.length,y:b.position.y+b.actualDimensions.width,z:b.position.z+b.actualDimensions.height}}
  const envelopeOverlap=boundsOverlap(ea,eb)
  if(!envelopeOverlap){
    const dx=Math.max(ea.min.x-eb.max.x,eb.min.x-ea.max.x,0),dy=Math.max(ea.min.y-eb.max.y,eb.min.y-ea.max.y,0),dz=Math.max(ea.min.z-eb.max.z,eb.min.z-ea.max.z,0)
    if(gap<=0||Math.max(dx,dy,dz)>=gap-EPS)return []
    if(!a.item.cavity&&!b.item.cavity)return [`${a.item.id} 与 ${b.item.id} 实体间隙不足 ${gap} mm`]
  }else if(!a.item.cavity&&!b.item.cavity)return [`${a.item.id} 与 ${b.item.id} 实体碰撞`]
  const ga=geometryFor(a),gb=geometryFor(b)
  for(const sa of ga.solids)for(const sb of gb.solids)if(boundsOverlap(sa,sb))return [`${a.item.id} 与 ${b.item.id} 实体碰撞`]
  if(boundsOverlap(ga.envelope,gb.envelope)&&!nestedInside(b,a)&&!nestedInside(a,b))return [`${a.item.id} 与 ${b.item.id} 外包交叠，未完整位于获准空腔内`]
  for(const sa of ga.solids)for(const sb of gb.solids){
    if(gap>0){const dx=Math.max(sa.min.x-sb.max.x,sb.min.x-sa.max.x,0),dy=Math.max(sa.min.y-sb.max.y,sb.min.y-sa.max.y,0),dz=Math.max(sa.min.z-sb.max.z,sb.min.z-sa.max.z,0)
      if(Math.max(dx,dy,dz)<gap-EPS)return [`${a.item.id} 与 ${b.item.id} 实体间隙不足 ${gap} mm`]
    }
  }
  return []
}
export function solidVolume(item:CargoItem):number {
  const d=item.dimensions,c=item.cavity?.dimensions
  return d.length*d.width*d.height-(c?c.length*c.width*c.height:0)
}

export function solidCentroid(placed:PlacedItem):Position3D {
  const p=placed.position,d=placed.actualDimensions
  if(!placed.item.cavity)return {x:p.x+d.length/2,y:p.y+d.width/2,z:p.z+d.height/2}
  const moments={x:0,y:0,z:0};let total=0
  for(const b of solidBounds(placed)){
    const v=(b.max.x-b.min.x)*(b.max.y-b.min.y)*(b.max.z-b.min.z);total+=v
    moments.x+=(b.min.x+b.max.x)/2*v;moments.y+=(b.min.y+b.max.y)/2*v;moments.z+=(b.min.z+b.max.z)/2*v
  }
  return {x:moments.x/total,y:moments.y/total,z:moments.z/total}
}

/** Only material cavity walls consume clearance. Through-opening faces are not walls. */
export function cavityFaceMargins(host:PlacedItem,gap:number):{min:Position3D;max:Position3D}|undefined {
  const geometry=geometryFor(host),inner=geometry.cavity
  if(!inner)return undefined
  return {
    min:{x:Math.abs(inner.min.x-geometry.envelope.min.x)<EPS?0:gap,y:Math.abs(inner.min.y-geometry.envelope.min.y)<EPS?0:gap,z:Math.abs(inner.min.z-geometry.envelope.min.z)<EPS?0:gap},
    max:{x:Math.abs(inner.max.x-geometry.envelope.max.x)<EPS?0:gap,y:Math.abs(inner.max.y-geometry.envelope.max.y)<EPS?0:gap,z:Math.abs(inner.max.z-geometry.envelope.max.z)<EPS?0:gap}
  }
}
