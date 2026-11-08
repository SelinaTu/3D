// #created 11/08/2026
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { PackingSolution, PlacedItem } from '../types/packing'
import { solidBounds, solidVolume } from '../core/solid-geometry'

type ReportData = { solution: PackingSolution; generatedAt: string; sourceFile: string; modelLabel: string; fallbackViews: string[] }
const data = JSON.parse(document.getElementById('report-data')!.textContent!) as ReportData
const solution = data.solution
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const fmt = (n: number, digits = 0) => n.toLocaleString('zh-CN', { maximumFractionDigits: digits })
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const colors = ['#487b86', '#b28d4e', '#9a80aa', '#73936b', '#bc7667', '#638cbd', '#808c51', '#6f9d92', '#9f7e6d', '#78829f']
const categories = [...new Set(solution.containers.flatMap(c => c.items.map(p => p.item.category)))].sort()
const cargoColor = (p: PlacedItem) => colors[categories.indexOf(p.item.category) % colors.length]
let index = 0, selectedId: string | null = null, visibleCount = solution.containers[0].items.length
let mode: '3d' | 'top' | 'side' = '3d', scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, controls: OrbitControls, cargoMesh: THREE.InstancedMesh, highlight: THREE.Box3Helper | undefined
let instanceOwners: number[] = []
let allRows = false
const viewer = $('viewer'), fallback = $('fallback'), range = $<HTMLInputElement>('visibility'), query = $<HTMLInputElement>('query')
const canvasHost = $('canvas-host')

function appendText(parent: HTMLElement, tag: string, value: unknown, className?: string) {
  const node = document.createElement(tag)
  node.textContent = String(value ?? '')
  if (className) node.className = className
  parent.append(node)
  return node
}
function updateTable() {
  const tbody = $('manifest-body'); tbody.replaceChildren()
  const needle = query.value.trim().toLowerCase()
  const entries = (allRows ? solution.containers : [solution.containers[index]]).flatMap(c => c.items.map((p, i) => ({ c, p, i })))
    .filter(({ p }) => `${p.item.id} ${p.item.name} ${p.item.category}`.toLowerCase().includes(needle))
  $('row-count').textContent = `${fmt(entries.length)} 件${allRows ? ' · 全部集装箱' : ` · 柜 ${index + 1}`}`
  for (const { c, p, i } of entries) {
    const tr = document.createElement('tr')
    tr.tabIndex = 0
    tr.classList.toggle('selected-row', p.item.id === selectedId)
    const { item, position: pos, actualDimensions: d } = p
    const name = appendText(tr, 'td', '')
    const dot = appendText(name, 'span', '', 'color-dot'); dot.style.background = cargoColor(p)
    appendText(name, 'strong', item.name)
    appendText(name, 'small', item.id)
    for (const value of [c.id.replace('container-', ''), i + 1, `${fmt(d.length, 2)} × ${fmt(d.width, 2)} × ${fmt(d.height, 2)}`, `${fmt(pos.x, 2)} / ${fmt(pos.y, 2)} / ${fmt(pos.z, 2)}`, `${({ standing: '立放', lying: '侧放', flat: '平放' })[p.orientation]} / ${p.rotation}°`, fmt(item.weight, 2)]) appendText(tr, 'td', value)
    const select = () => {
      if (c.id !== solution.containers[index].id) selectContainer(solution.containers.indexOf(c))
      selectCargo(item.id)
      viewer.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    tr.addEventListener('click', select)
    tr.addEventListener('keydown', event => { if (event.key === 'Enter') select() })
    tbody.append(tr)
  }
}
function selectCargo(id: string | null) {
  selectedId = id
  const p = solution.containers[index].items.find(p => p.item.id === id)
  const detail = $('selected-item'); detail.replaceChildren()
  if (highlight) { scene?.remove(highlight); highlight.geometry.dispose(); (highlight.material as THREE.Material).dispose(); highlight = undefined }
  if (!p) { detail.textContent = '点击三维货物或清单行，定位并查看单件信息。'; updateTable(); return }
  const { position: pos, actualDimensions: d, item } = p
  appendText(detail, 'strong', item.name)
  appendText(detail, 'span', `${item.id} · ${item.category} · ${fmt(item.weight, 2)} kg`)
  appendText(detail, 'span', `占用 ${fmt(d.length, 2)} × ${fmt(d.width, 2)} × ${fmt(d.height, 2)} mm`)
  appendText(detail, 'span', `位置 (${fmt(pos.x, 2)}, ${fmt(pos.y, 2)}, ${fmt(pos.z, 2)}) · ${p.orientation} / ${p.rotation}°`)
  appendText(detail, 'span', `实体 ${(solidVolume(item) / 1e9).toFixed(6)} m³${item.cavity ? ` · 空腔 ${item.cavity.dimensions.length} × ${item.cavity.dimensions.width} × ${item.cavity.dimensions.height} mm（图中留空）` : ''}`)
  if (item.rawData?._sourceSheet) appendText(detail, 'small', `来源 ${item.rawData._sourceSheet} / 第 ${item.rawData._sourceRow} 行`)
  if (scene) {
    highlight = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(pos.x / 1000, pos.z / 1000, pos.y / 1000), new THREE.Vector3((pos.x + d.length) / 1000, (pos.z + d.height) / 1000, (pos.y + d.width) / 1000)), new THREE.Color('#ee6622'))
    scene.add(highlight)
  }
  updateTable()
}
function resetCamera() {
  if (!camera) return
  const c = solution.containers[index], L = c.dimensions.length / 1000, W = c.dimensions.width / 1000, H = c.dimensions.height / 1000
  const center = new THREE.Vector3(L / 2, H / 2, W / 2)
  if (mode === 'top') camera.position.set(L / 2, L * .93, W / 2 + .001)
  else if (mode === 'side') camera.position.set(L / 2, H / 2, W / 2 + L * .94)
  else camera.position.set(L * 1.05, L * .62, L * .83)
  controls.target.copy(center); controls.update()
}
function rebuildScene() {
  if (!renderer) return
  if (scene) {
    scene.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose()
        const material = Array.isArray(o.material) ? o.material : [o.material]
        material.forEach(m => m.dispose())
      }
    })
  }
  scene = new THREE.Scene(); scene.background = new THREE.Color('#edf3f2'); highlight = undefined
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc4d5d2, 2.4))
  const light = new THREE.DirectionalLight(0xffffff, 2.2); light.position.set(5, 14, 8); scene.add(light)
  const c = solution.containers[index], L = c.dimensions.length / 1000, W = c.dimensions.width / 1000, H = c.dimensions.height / 1000
  const parts = c.items.flatMap((p, itemIndex) => solidBounds(p).map(bounds => ({ p, itemIndex, bounds })))
  instanceOwners = parts.map(part => part.itemIndex)
  cargoMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .65, metalness: .02 }), parts.length)
  const matrix = new THREE.Matrix4(), color = new THREE.Color()
  const linePositions: number[] = []
  const edges = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]]
  for (const [i, part] of parts.entries()) {
    const { p, bounds, itemIndex } = part
    const pos = bounds.min, d = { length: bounds.max.x - pos.x, width: bounds.max.y - pos.y, height: bounds.max.z - pos.z }
    matrix.compose(new THREE.Vector3((pos.x + d.length / 2) / 1000, (pos.z + d.height / 2) / 1000, (pos.y + d.width / 2) / 1000), new THREE.Quaternion(), new THREE.Vector3(d.length / 1000, d.height / 1000, d.width / 1000))
    cargoMesh.setMatrixAt(i, matrix); cargoMesh.setColorAt(i, color.set(cargoColor(p)))
    if (itemIndex < visibleCount) {
      const vertices = Array.from({ length: 8 }, (_, k) => [(pos.x + ((k & 1) ? d.length : 0)) / 1000, (pos.z + ((k & 2) ? d.height : 0)) / 1000, (pos.y + ((k & 4) ? d.width : 0)) / 1000])
      for (const [a,b] of edges) linePositions.push(...vertices[a], ...vertices[b])
    }
  }
  cargoMesh.count = parts.filter(part => part.itemIndex < visibleCount).length; scene.add(cargoMesh)
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
  scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#2e4a50', transparent: true, opacity: .45 })))
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)), new THREE.LineBasicMaterial({ color: '#476d74' }))
  frame.position.set(L/2,H/2,W/2); scene.add(frame)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshStandardMaterial({ color: '#cddbd8', side: THREE.DoubleSide, transparent: true, opacity: .55 }))
  floor.rotation.x = -Math.PI/2; floor.position.set(L/2, -.008, W/2); scene.add(floor)
  const grid = new THREE.GridHelper(24, 48, '#bfd0cc', '#d9e3e0'); grid.position.set(L/2,-.025,W/2); scene.add(grid)
  if (c.centerOfGravity) {
    const g=c.centerOfGravity, sphere=new THREE.Mesh(new THREE.SphereGeometry(.065, 16, 12), new THREE.MeshBasicMaterial({color:'#e86822'}))
    sphere.position.set(g.x/1000,g.z/1000,g.y/1000); scene.add(sphere)
  }
  if (selectedId) selectCargo(selectedId)
}
function selectContainer(next: number) {
  index = next; selectedId = null
  const c = solution.containers[index]; visibleCount = c.items.length
  range.max=String(c.items.length); range.value=String(visibleCount)
  $('visible-count').textContent=`${visibleCount} / ${c.items.length} 件`
  $('container-title').textContent=`集装箱 ${String(index+1).padStart(2,'0')} / ${solution.totalContainers}`
  const capacity = c.dimensions.length * c.dimensions.width * c.dimensions.height
  const material = c.items.reduce((n,p) => n + solidVolume(p.item), 0), outer = c.items.reduce((n,p) => n + p.actualDimensions.length * p.actualDimensions.width * p.actualDimensions.height, 0)
  $('container-metrics').textContent=`${c.items.length} 件 · ${fmt(c.totalWeight,2)} kg · 实体 ${pct(material/capacity)} / 包络 ${pct(outer/capacity)} · 载重 ${pct(c.weightUtilization)}`
  const cg=c.centerOfGravity
  $('gravity').textContent=cg ? `重量重心 X ${fmt(cg.x,1)} / Y ${fmt(cg.y,1)} / Z ${fmt(cg.z,1)} mm（橙色点）` : '未记录重心'
  $('dimensions').textContent=`${fmt(c.dimensions.length)} × ${fmt(c.dimensions.width)} × ${fmt(c.dimensions.height)} mm`
  fallback.innerHTML=data.fallbackViews[index]
  document.querySelectorAll<HTMLButtonElement>('.container-button').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',String(i===index))})
  $('selected-item').textContent='点击三维货物或清单行，定位并查看单件信息。'
  rebuildScene(); resetCamera(); updateTable()
}
for (const [i,c] of solution.containers.entries()) {
  const button=document.createElement('button'); button.className='container-button'; button.type='button'
  appendText(button,'strong',`柜 ${String(i+1).padStart(2,'0')}`)
  appendText(button,'span',`${c.items.length} 件 · ${pct(c.volumeUtilization)}`)
  button.addEventListener('click',()=>selectContainer(i)); $('container-nav').append(button)
}
for (const category of categories) {
  const entry=appendText($('legend'),'span',''); const dot=appendText(entry,'i','');dot.style.background=colors[categories.indexOf(category)%colors.length];appendText(entry,'span',category)
}
try {
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(canvasHost.clientWidth,canvasHost.clientHeight)
  renderer.setClearColor('#edf3f2'); renderer.outputColorSpace=THREE.SRGBColorSpace
  canvasHost.append(renderer.domElement); fallback.hidden=true
  camera=new THREE.PerspectiveCamera(40,canvasHost.clientWidth/canvasHost.clientHeight,.01,250)
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxDistance=45;controls.minDistance=2
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerStart={x:0,y:0}
  renderer.domElement.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY}})
  renderer.domElement.addEventListener('pointerup',e=>{
    if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera)
    const hit=raycaster.intersectObject(cargoMesh)[0];if(hit?.instanceId!==undefined)selectCargo(solution.containers[index].items[instanceOwners[hit.instanceId]].item.id)
  })
  renderer.domElement.addEventListener('webglcontextlost',()=>{fallback.hidden=false;canvasHost.hidden=true;range.disabled=true;range.value=range.max;$('visible-count').textContent=`${range.max} / ${range.max} 件`;$('view-note').textContent='3D 加速不可用，已显示全部货物的离线实体示意图；明细与导出仍可使用。'})
  new ResizeObserver(()=>{const w=canvasHost.clientWidth,h=canvasHost.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}}).observe(canvasHost)
  const tick=()=>{requestAnimationFrame(tick);if(scene){controls.update();renderer.render(scene,camera)}};tick()
}catch{
  canvasHost.hidden=true;fallback.hidden=false;range.disabled=true;$('view-note').textContent='当前浏览器未启用 WebGL；显示全部货物的离线实体示意图，仍可查看逐件明细及全部导出。'
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))button.addEventListener('click',()=>{mode=button.dataset.view as typeof mode;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));resetCamera()})
$('reset-camera').addEventListener('click',resetCamera)
range.addEventListener('input',()=>{visibleCount=Number(range.value);$('visible-count').textContent=`${visibleCount} / ${solution.containers[index].items.length} 件`;rebuildScene()})
query.addEventListener('input',updateTable)
$<HTMLSelectElement>('table-scope').addEventListener('change',e=>{allRows=(e.target as HTMLSelectElement).value==='all';updateTable()})
function download(content:string,name:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
$('download-json').addEventListener('click',()=>download(JSON.stringify(solution,null,2),'packing-complete-solution.json','application/json;charset=utf-8'))
$('download-csv').addEventListener('click',()=>{
  const rows:unknown[][]=[['柜号','柜内序号','货物ID','名称','分类','实际长mm','实际宽mm','实际高mm','Xmm','Ymm','Zmm','方向','旋转度','重量kg']]
  for(const [ci,c] of solution.containers.entries())for(const [i,p] of c.items.entries())rows.push([ci+1,i+1,p.item.id,p.item.name,p.item.category,p.actualDimensions.length,p.actualDimensions.width,p.actualDimensions.height,p.position.x,p.position.y,p.position.z,p.orientation,p.rotation,p.item.weight])
  const cell=(v:unknown)=>{let s=String(v??'');if(/^[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
  download('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),`全部${solution.totalItems}件装柜清单.csv`,'text/csv;charset=utf-8')
})
$('print-report').addEventListener('click',()=>window.print())
selectContainer(0)
