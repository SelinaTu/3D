// #created 11/08/2026
import { Component, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { AccessFace, Container, PlacedItem } from '../types/packing'
import './hi3d-cargo-viewer.css'

export function cargoColor(category: string, glass = false): string {
  if (glass) return '#d49b47'
  const colors = ['#398d9e', '#5b82aa', '#95ada6', '#8c87ac', '#6ca8b2', '#b38d70', '#7c9a73']
  let hash = 0
  for (const char of category) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return colors[Math.abs(hash) % colors.length]
}
class ViewerBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError?.() }
  render() { return this.state.failed ? <div className="viewer-fallback">3D 视图暂不可用，请使用俯视图或货物明细。</div> : this.props.children }
}
function ContextLossMonitor({ onError }: { onError?: () => void }) {
  const gl = useThree(state => state.gl)
  useLayoutEffect(() => {
    const handleLoss = (event: Event) => { event.preventDefault(); onError?.() }
    const canvas = gl.domElement
    canvas.addEventListener('webglcontextlost', handleLoss)
    return () => canvas.removeEventListener('webglcontextlost', handleLoss)
  }, [gl, onError])
  return null
}
const positionOf = (p: PlacedItem): [number, number, number] => [(p.position.x + p.actualDimensions.length / 2) / 1000, (p.position.z + p.actualDimensions.height / 2) / 1000, (p.position.y + p.actualDimensions.width / 2) / 1000]
const sizeOf = (p: PlacedItem): [number, number, number] => [p.actualDimensions.length / 1000, p.actualDimensions.height / 1000, p.actualDimensions.width / 1000]
const emptyIds: ReadonlySet<string> = new Set()

function CargoInstances({ container, onSelect }: { container: Container; onSelect: (id: string) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const object = new THREE.Object3D()
    container.items.forEach((p, i) => {
      object.position.set(...positionOf(p)); object.scale.set(...sizeOf(p)); object.updateMatrix()
      mesh.current!.setMatrixAt(i, object.matrix)
      const tagged = /^#[0-9a-f]{6}$/i.test(p.item.colorTag) ? p.item.colorTag : cargoColor(p.item.category, p.item.hasGlass)
      mesh.current!.setColorAt(i, new THREE.Color(tagged))
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [container])
  function select(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if (event.instanceId !== undefined) onSelect(container.items[event.instanceId].item.id)
  }
  return <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(1, container.items.length)]} count={container.items.length} onClick={select} castShadow receiveShadow>
    <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.68} metalness={0.08} />
  </instancedMesh>
}
// A single edge buffer keeps large shipments responsive.
function CargoEdges({ items }: { items: PlacedItem[] }) {
  const points = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1), edges = new THREE.EdgesGeometry(box)
    const unit = edges.getAttribute('position'), vertices = new Float32Array(items.length * unit.count * 3)
    items.forEach((p, i) => {
      const center = positionOf(p), size = sizeOf(p)
      for (let j = 0; j < unit.count; j++) for (let axis = 0; axis < 3; axis++) vertices[(i * unit.count + j) * 3 + axis] = center[axis] + unit.array[j * 3 + axis] * size[axis]
    })
    box.dispose(); edges.dispose()
    return vertices
  }, [items])
  return <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry><lineBasicMaterial color="#234453" transparent opacity={0.38} /></lineSegments>
}
function Highlight({ piece, color }: { piece: PlacedItem; color: string }) {
  const size = sizeOf(piece)
  const geometry = useMemo(() => new THREE.BoxGeometry(size[0] + .008, size[1] + .008, size[2] + .008), [size[0], size[1], size[2]])
  useLayoutEffect(() => () => geometry.dispose(), [geometry])
  return <group position={positionOf(piece)}>
    <lineSegments renderOrder={5}><edgesGeometry args={[geometry]} /><lineBasicMaterial color={color} depthTest={false} transparent opacity={0.95} /></lineSegments>
    <mesh renderOrder={4}><primitive object={geometry} attach="geometry" /><meshBasicMaterial color={color} transparent opacity={0.09} depthTest={false} depthWrite={false} /></mesh>
  </group>
}
function Solid({ position, size, color, opacity = 1 }: { position: [number, number, number]; size: [number, number, number]; color: string; opacity?: number }) {
  return <mesh position={position} receiveShadow castShadow={opacity === 1}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.62} metalness={0.28} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} /></mesh>
}
export const accessLabel: Record<AccessFace, string> = { 'x-min': 'X 最小端', 'x-max': 'X 最大端', 'y-min': 'Y 最小侧', 'y-max': 'Y 最大侧', 'z-max': '顶部开口' }
function ContainerShell({ l, w, h, face, dark }: { l: number; w: number; h: number; face: AccessFace; dark: boolean }) {
  const steel = dark ? '#6f8b9c' : '#94abb7', xDoor = face.startsWith('x'), top = face === 'z-max'
  const doorW = xDoor || top ? w : l
  const origin: [number, number, number] = face === 'x-max' ? [l, 0, w / 2] : face === 'x-min' ? [0, 0, w / 2] : face === 'y-min' ? [l / 2, 0, 0] : face === 'y-max' ? [l / 2, 0, w] : [l / 2, h, w / 2]
  const rotation: [number, number, number] = top ? [-Math.PI / 2, 0, 0] : [0, face === 'x-max' ? Math.PI / 2 : face === 'x-min' ? -Math.PI / 2 : face === 'y-min' ? Math.PI : 0, 0]
  const closedX = face === 'x-min' ? l : 0
  return <group>
    <Solid position={[l / 2, -.08, w / 2]} size={[l + .12, .16, w + .12]} color={dark ? '#344b5c' : '#b4c5cd'} />
    <Solid position={[closedX, h / 2, w / 2]} size={[.04, h, w]} color={steel} opacity={0.36} />
    {Array.from({ length: Math.ceil(w / .28) }, (_, i) => <Solid key={i} position={[closedX, h / 2, i * .28 + .1]} size={[.07, h, .035]} color={steel} opacity={0.7} />)}
    {[0, l].flatMap(x => [0, w].map(z => <Solid key={`${x}-${z}`} position={[x, h / 2, z]} size={[.07, h + .08, .07]} color={steel} />))}
    {[0, w].map(z => <Solid key={z} position={[l / 2, h, z]} size={[l, .07, .055]} color={steel} opacity={0.55} />)}
    {[0, l].map(x => <Solid key={x} position={[x, h, w / 2]} size={[.07, .07, w]} color={steel} />)}
    {Array.from({ length: Math.floor(l / .6) }, (_, i) => <Solid key={`floor-${i}`} position={[(i + 1) * .6, .002, w / 2]} size={[.008, .003, w]} color={dark ? '#4a6373' : '#d7e1e5'} />)}
    <group position={origin} rotation={rotation}>
      {!top && <>
        <group position={[-doorW / 2, 0, 0]} rotation={[0, -Math.PI * .62, 0]}><Solid position={[doorW / 4, h / 2, 0]} size={[doorW / 2, h, .045]} color={steel} opacity={0.6} /><Solid position={[doorW * .36, h / 2, .04]} size={[.035, h * .8, .035]} color="#506c7d" /></group>
        <group position={[doorW / 2, 0, 0]} rotation={[0, Math.PI * .62, 0]}><Solid position={[-doorW / 4, h / 2, 0]} size={[doorW / 2, h, .045]} color={steel} opacity={0.6} /><Solid position={[-doorW * .36, h / 2, .04]} size={[.035, h * .8, .035]} color="#506c7d" /></group>
      </>}
      <Solid position={[0, .025, .02]} size={[doorW, .04, .09]} color="#158d80" />
      <group position={[0, .045, .7]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.025, .025, .9, 12]} /><meshBasicMaterial color="#087f79" /></mesh>
        <mesh position={[0, 0, .58]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.14, .32, 3]} /><meshBasicMaterial color="#087f79" /></mesh>
      </group>
      <Html center position={[0, .28, 1.25]} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}><span className="cargo-door-label">{top ? '顶部作业口' : '卸货口'} <b>→ 向外卸货</b></span></Html>
    </group>
  </group>
}
export type CargoFocus = { key: number; ids: string[] }
function CameraRig({ container, face, extension, focus, view }: { container: Container; face: AccessFace; extension: number; focus?: CargoFocus; view: { key: number; door: boolean } }) {
  const controls = useRef<OrbitControlsImpl>(null), camera = useThree(state => state.camera), viewport = useThree(state => state.size)
  const l = container.dimensions.length / 1000, w = container.dimensions.width / 1000, h = container.dimensions.height / 1000
  useLayoutEffect(() => {
    if (!controls.current) return
    const target = new THREE.Vector3(l / 2, h * .35, w / 2)
    const items = (focus && focus.key > view.key && focus.ids.length) ? container.items.filter(p => focus.ids.includes(p.item.id)) : []
    if (items.length || view.door) {
      // Fit all corners, including the open doors and outside arrow. Near-door
      // perspective must not crop the opening while focusing cargo at the back.
      const min = new THREE.Vector3(0, -.18, 0), max = new THREE.Vector3(l, h, w)
      const outside = Math.max(extension, face.startsWith('y') ? l * .5 : w * .5, 1.6)
      if (face === 'x-min') min.x -= outside
      if (face === 'x-max') max.x += outside
      if (face === 'y-min') min.z -= outside
      if (face === 'y-max') max.z += outside
      if (face === 'z-max') max.y += outside
      target.addVectors(min, max).multiplyScalar(.5)
      if (items.length) {
        const selectedCenter = new THREE.Vector3()
        for (const p of items) selectedCenter.add(new THREE.Vector3(...positionOf(p)))
        target.lerp(selectedCenter.divideScalar(items.length), .15)
      }
      const direction: [number, number, number] = face === 'x-min' ? [-1, .45, .28] : face === 'x-max' ? [1, .45, .28] : face === 'y-min' ? [.25, .45, -1] : face === 'y-max' ? [.25, .45, 1] : [.2, 1, .2]
      const backward = new THREE.Vector3(...direction).normalize()
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), backward).normalize()
      const up = new THREE.Vector3().crossVectors(backward, right)
      const tangent = Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2))
      const vertical = tangent * .68, horizontal = tangent * viewport.width / viewport.height * .82
      let distance = 4
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        const point = new THREE.Vector3(x, y, z).sub(target), depth = point.dot(backward)
        distance = Math.max(distance, depth + Math.abs(point.dot(up)) / vertical, depth + Math.abs(point.dot(right)) / horizontal)
      }
      camera.position.copy(target).addScaledVector(backward, distance)
    } else camera.position.set(l * 1.08 + 1 + extension, h * 2.1 + l * .2 + extension, w * 2.7 + l * .45 + extension)
    controls.current.target.copy(target); controls.current.update()
    // Preserve the user's camera while scrubbing; move only on explicit focus/reset.
  }, [camera, l, w, h, face, extension, focus?.key, view.key, viewport.width, viewport.height])
  return <OrbitControls ref={controls} enableDamping minDistance={.7} maxDistance={Math.max(20, (l + extension) * 5)} maxPolarAngle={Math.PI * .49} />
}
export type CargoAnnotation = { id: string; label: string; title?: string; color?: string }
type Props = {
  container: Container; selectedId: string | null; selectedIds?: ReadonlySet<string>; onSelect: (id: string) => void; onError?: () => void
  annotations?: CargoAnnotation[]; tone?: 'light' | 'dark'; viewExtension?: { door: AccessFace; distanceMm: number }
  blockerIds?: ReadonlySet<string>; blockedIds?: ReadonlySet<string>; focus?: CargoFocus; cargoDestinations?: ReadonlyMap<string, string>
}
export function ContainerViewer({ container, selectedId, selectedIds, onSelect, onError, annotations = [], viewExtension, tone = 'light', blockerIds = emptyIds, blockedIds = emptyIds, focus, cargoDestinations }: Props) {
  const [view, setView] = useState({ key: 0, door: false }), [localFocus, setLocalFocus] = useState<CargoFocus>()
  const l = container.dimensions.length / 1000, w = container.dimensions.width / 1000, h = container.dimensions.height / 1000
  const face = viewExtension?.door ?? container.unloadingDoor ?? container.routeDoors?.[0] ?? 'x-max'
  const selected = container.items.find(p => p.item.id === selectedId)
  const annotated = new Map(annotations.map(a => [a.id, a])), taggedItems = container.items.filter(p => annotated.has(p.item.id))
  const activeFocus = localFocus && (!focus || localFocus.key > focus.key) ? localFocus : focus
  return <ViewerBoundary onError={onError}><div className={`cargo-scene ${tone}`} data-door={face} data-cargo-count={container.items.length} data-blocker-count={blockerIds.size} data-blocked-count={blockedIds.size}>
    <div className="cargo-scene-toolbar"><span className="cargo-scene-badge">剖视 · {face === 'z-max' ? '顶部作业' : '双门开启'}<small>{accessLabel[face]}{!container.unloadingDoor && !viewExtension && !container.routeDoors?.length ? ' · 默认示意' : ''}</small></span><div><button onClick={() => { setLocalFocus(undefined); setView({ key: Date.now(), door: true }) }}>从卸货口看</button><button onClick={() => { setLocalFocus(undefined); setView({ key: Date.now(), door: false }) }}>整体视图</button></div></div>
    <div className="cargo-scene-legend"><span><i style={{ background: '#2d7b91' }} />货物原分组色</span><span><i style={{ background: '#dc303e' }} />挡路货物</span><span><i style={{ background: '#e69b26' }} />被挡货物</span></div>
    <Canvas key={`${container.id}-${l}-${w}-${h}`} shadows camera={{ position: [l * 1.08 + 1, h * 2.1 + l * .2, w * 2.7 + l * .45], fov: 42, near: .01, far: 1000 }} dpr={[1, 1.6]} gl={{ antialias: true }}>
      <ContextLossMonitor onError={onError} />
      <color attach="background" args={[tone === 'dark' ? '#12202d' : '#edf3f5']} />
      <hemisphereLight args={['#ffffff', '#839eac', 2]} /><directionalLight position={[l / 2, 13, w + 5]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-l} shadow-camera-right={l * 1.5} shadow-camera-top={l} shadow-camera-bottom={-l} shadow-normalBias={.03} />
      <directionalLight position={[-5, 6, -6]} intensity={1} />
      <mesh position={[l / 2, -.19, w / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[100, 100]} /><meshStandardMaterial color={tone === 'dark' ? '#162735' : '#e5edef'} roughness={1} /></mesh>
      <gridHelper args={[Math.max(18, l * 2), 36, tone === 'dark' ? '#304c5e' : '#bacdd4', tone === 'dark' ? '#203849' : '#d3e0e5']} position={[l / 2, -.185, w / 2]} />
      <ContainerShell l={l} w={w} h={h} face={face} dark={tone === 'dark'} />
      <CargoInstances container={container} onSelect={onSelect} /><CargoEdges items={container.items} />
      {container.items.filter(p => p.item.id === selectedId || selectedIds?.has(p.item.id) || blockerIds.has(p.item.id) || blockedIds.has(p.item.id)).map(p => <Highlight key={p.item.id} piece={p} color={blockerIds.has(p.item.id) ? '#ee253c' : blockedIds.has(p.item.id) ? '#e69b26' : '#258bc0'} />)}
      {taggedItems.map(p => {
        const tag = annotated.get(p.item.id)!
        const close = taggedItems.filter(o => Math.abs(o.position.x + o.actualDimensions.length / 2 - p.position.x - p.actualDimensions.length / 2) < 450 && Math.abs(o.position.y + o.actualDimensions.width / 2 - p.position.y - p.actualDimensions.width / 2) < 450 && Math.abs(o.position.z + o.actualDimensions.height - p.position.z - p.actualDimensions.height) < 300)
        const index = close.indexOf(p), columns = Math.min(3, close.length), offsetX = (index % 3 - (columns - 1) / 2) * 46, offsetY = -Math.floor(index / 3) * 32
        return <Html key={p.item.id} center position={[(p.position.x + p.actualDimensions.length / 2) / 1000, (p.position.z + p.actualDimensions.height) / 1000 + .12, (p.position.y + p.actualDimensions.width / 2) / 1000]} zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}><button className="route-3d-label" style={{ background: tag.color ?? '#b75a2c', transform: `translate(${offsetX}px,${offsetY}px)`, pointerEvents: 'auto' }} title={tag.title ?? p.item.name} aria-label={`作业标记 ${tag.label} ${p.item.name}`} onClick={e => { e.stopPropagation(); onSelect(p.item.id) }}>{tag.label}</button></Html>
      })}
      {container.centerOfGravity && <mesh position={[container.centerOfGravity.x / 1000, container.centerOfGravity.z / 1000, container.centerOfGravity.y / 1000]}><sphereGeometry args={[.055, 12, 12]} /><meshBasicMaterial color="#ef9a32" /></mesh>}
      <CameraRig container={container} face={face} extension={(viewExtension?.distanceMm ?? 0) / 1000} focus={activeFocus} view={view} />
    </Canvas>
    {selected && <div className="cargo-selection" data-selected-id={selected.item.id}><strong>{selected.item.name}</strong><small>{selected.item.id}</small><span>尺寸 {selected.actualDimensions.length} × {selected.actualDimensions.width} × {selected.actualDimensions.height} mm</span><span>坐标 X {Math.round(selected.position.x)} / Y {Math.round(selected.position.y)} / Z {Math.round(selected.position.z)} mm</span>{(cargoDestinations?.get(selected.item.id) || selected.item.unloadStop) && <span>去向：{cargoDestinations?.get(selected.item.id) ?? `第 ${selected.item.unloadStop} 站`}</span>}<button onClick={() => setLocalFocus({ key: Date.now(), ids: [selected.item.id] })}>从卸货口定位此件</button></div>}
    <div className="cargo-scene-note">{face === 'z-max' ? '顶部开口作业示意' : '侧壁、顶棚仅作剖视隐藏，实际经开启的柜门卸货'}<span>{container.dimensions.length} × {container.dimensions.width} × {container.dimensions.height} mm</span></div>
  </div></ViewerBoundary>
}
