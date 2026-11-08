// #created 11/08/2026
import type { Container, HandlingAccess, PlacedItem } from '../../types/packing'
import { swapSideView } from './doors'
import type { Door } from './model'

export const DEFAULT_HANDLING: HandlingAccess = { mode:'worker-aisle', aisleWidthMm:600, aisleHeightMm:1800, reachMm:800, maxReachHeightMm:2100 }
export function validateHandling(value: unknown): asserts value is HandlingAccess {
  if(!value || typeof value!=='object')throw new Error('作业参数须为对象')
  const h=value as HandlingAccess
  if(!['worker-aisle','door-only','mechanical'].includes(h.mode) || ![h.aisleWidthMm,h.aisleHeightMm,h.reachMm,h.maxReachHeightMm].every(n=>Number.isFinite(n) && n>=100 && n<=10000)) throw new Error('作业参数须为 100–10000 mm，且选择有效的作业方式')
}
type Rect={ x:number;y:number;l:number;w:number }
const EPS=1e-6
const cache=new WeakMap<PlacedItem[],Map<string,{points:{x:number;y:number}[];obstacles:Rect[]}>>()
function intersects(ax:number,ay:number,bx:number,by:number,r:Rect):boolean {
  let lo=0,hi=1
  for(const [a,b,min,max] of [[ax,bx,r.x+EPS,r.x+r.l-EPS],[ay,by,r.y+EPS,r.y+r.w-EPS]]) {
    const d=b-a
    if(Math.abs(d)<EPS) {if(a<min || a>max)return false;continue}
    const u=(min-a)/d,v=(max-a)/d
    lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v))
    if(lo>hi)return false
  }
  return true
}
/** Conservative floor path: square footprint, head clearance, swept edges, no climbing. */
function walkable(container:Container,door:Door,h:HandlingAccess) {
  const key=JSON.stringify([door,h,container.dimensions,container.items.map(p=>[p.item.id,p.position,p.actualDimensions])])
  const byKey=cache.get(container.items) ?? new Map();cache.set(container.items,byKey)
  const existing=byKey.get(key);if(existing)return existing
  const obstacles=container.items.filter(p=>p.position.z<h.aisleHeightMm-EPS).map(p=>({x:p.position.x,y:p.position.y,l:p.actualDimensions.length,w:p.actualDimensions.width}))
  const half=h.aisleWidthMm/2,L=container.dimensions.length,W=container.dimensions.width
  const points:{x:number;y:number}[]=[]
  if(L>=h.aisleWidthMm && W>=h.aisleWidthMm && container.dimensions.height>=h.aisleHeightMm) {
    const step=Math.max(100,Math.sqrt(L*W/12000)),nx=Math.max(1,Math.ceil((L-2*half)/step)),ny=Math.max(1,Math.ceil((W-2*half)/step))
    const xs=Array.from({length:nx+1},(_,i)=>half+(L-2*half)*i/nx),ys=Array.from({length:ny+1},(_,i)=>half+(W-2*half)*i/ny)
    const expanded=obstacles.map(o=>({x:o.x-half,y:o.y-half,l:o.l+2*half,w:o.w+2*half}))
    const free=new Uint8Array(xs.length*ys.length),seen=new Set<number>(),queue:number[]=[]
    for(let x=0;x<xs.length;x++)for(let y=0;y<ys.length;y++) {
      const id=x*ys.length+y
      if(!expanded.some(r=>intersects(xs[x],ys[y],xs[x],ys[y],r)))free[id]=1
    }
    const entry=door==='x-max'?xs.length-1:0
    for(let y=0;y<ys.length;y++){const id=entry*ys.length+y;if(free[id]){seen.add(id);queue.push(id)}}
    for(let q=0;q<queue.length;q++) {
      const id=queue[q],x=Math.floor(id/ys.length),y=id%ys.length
      points.push({x:xs[x],y:ys[y]})
      for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if(xx<0 || yy<0 || xx>=xs.length || yy>=ys.length)continue
        const next=xx*ys.length+yy
        if(seen.has(next) || !free[next] || expanded.some(r=>intersects(xs[x],ys[y],xs[xx],ys[yy],r)))continue
        seen.add(next);queue.push(next)
      }
    }
  }
  const result={points,obstacles};byKey.set(key,result);return result
}
export function accessIssue(container:Container,target:PlacedItem,door:Door):string | undefined {
  const h=container.handlingAccess
  if(door==='z-max')return h?.mode==='mechanical'?undefined:'顶部装卸需选择设备抽取 / 吊装模式'
  if(!h || h.mode==='mechanical')return
  if(door.startsWith('y')){const view=swapSideView(container,target);return accessIssue(view.container,view.target,door==='y-max'?'x-max':'x-min')}
  if(target.position.z>h.maxReachHeightMm+EPS)return `取货起点高 ${target.position.z} mm，超过设定可触及高度 ${h.maxReachHeightMm} mm`
  const face=door==='x-max'?target.position.x+target.actualDimensions.length:target.position.x
  const depth=door==='x-max'?container.dimensions.length-face:face
  if(depth<=h.reachMm+EPS)return
  if(h.mode==='door-only')return `距门 ${Math.round(depth)} mm，超过门外取货距离 ${h.reachMm} mm`
  const {points}=walkable(container,door,h)
  const handHeight=Math.min(h.maxReachHeightMm,target.position.z+target.actualDimensions.height/2)
  const others=container.items.filter(p=>p.item.id!==target.item.id && p.position.z<handHeight && p.position.z+p.actualDimensions.height>handHeight+EPS).map(p=>({x:p.position.x,y:p.position.y,l:p.actualDimensions.length,w:p.actualDimensions.width}))
  for(const p of points) {
    if(door==='x-max'?p.x<face-EPS:p.x>face+EPS)continue
    const y=Math.max(target.position.y,Math.min(p.y,target.position.y+target.actualDimensions.width))
    if(Math.hypot(p.x-face,p.y-y)>h.reachMm+EPS)continue
    if(!others.some(r=>intersects(p.x,p.y,face,y,r)))return
  }
  return `工人不可达：无 ${h.aisleWidthMm} mm 宽 / ${h.aisleHeightMm} mm 高的连通站立通道能进入 ${h.reachMm} mm 取货范围（距门 ${Math.round(depth)} mm）`
}
