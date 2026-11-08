// #created 11/08/2026
import { Component,useEffect,useMemo,useRef,type ReactNode } from 'react'
import { Canvas,useFrame,useThree,type ThreeEvent } from '@react-three/fiber'
import { Html,OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as Controls } from 'three-stdlib'
import { geoVector,type GlobeData,type Port } from './model'
import { stepCamera } from './camera'

class GlobeBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<div className="atlas-globe-fallback">3D 暂不可用。左侧仍可搜索港口并查看知识资料。</div>:this.props.children}
}
function Earth({data,ports,selected,spin,onSelect,onHover}:{data:GlobeData;ports:Port[];selected?:Port;spin:boolean;onSelect:(p:Port)=>void;onHover:(p:Port|null)=>void}) {
  const {camera}=useThree(),orbit=useRef<Controls>(null),target=useRef<THREE.Vector3|null>(null),lastHover=useRef('')
  const earth=useRef<THREE.Mesh>(null)
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#0a2335';ctx.fillRect(0,0,2048,1024)
    ctx.fillStyle='#235965';ctx.strokeStyle='#3c8490';ctx.lineWidth=.65
    for(const ring of data.land.rings){ctx.beginPath();ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*2048,y=(90-lat)/180*1024;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.closePath();ctx.fill();ctx.stroke()}
    ctx.strokeStyle='#548d9a25';ctx.lineWidth=.7
    for(let lon=-180;lon<=180;lon+=15){const x=(lon+180)/360*2048;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1024);ctx.stroke()}
    for(let lat=-75;lat<=75;lat+=15){const y=(90-lat)/180*1024;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(2048,y);ctx.stroke()}
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t
  },[data.land])
  useEffect(()=>()=>texture.dispose(),[texture])
  useEffect(()=>{if(selected)target.current=new THREE.Vector3(...geoVector(selected.lat,selected.lon)).multiplyScalar(Math.max(2.3,Math.min(3.4,camera.position.length())))},[selected,camera])
  useFrame((_,delta)=>{
    if(!target.current)return
    camera.position.copy(stepCamera(camera.position,target.current,delta));orbit.current?.update()
    if(camera.position.distanceTo(target.current)<.001)target.current=null
  })
  const buffers=useMemo(()=>{
    const positions=new Float32Array(ports.length*3),colors=new Float32Array(ports.length*3)
    ports.forEach((p,i)=>{positions.set(geoVector(p.lat,p.lon,1.006),i*3);new THREE.Color(data.packs[p.locode]?'#c1fa83':data.countries[p.country]?'#62bac7':'#488ba4').toArray(colors,i*3)})
    return {positions,colors}
  },[ports,data])
  const hover=(p:Port|null)=>{if(lastHover.current!==(p?.locode ?? '')){lastHover.current=p?.locode ?? '';onHover(p)}}
  const point=(e:ThreeEvent<PointerEvent|MouseEvent>)=>e.index===undefined?undefined:ports[e.index]
  const selectedVector=selected?new THREE.Vector3(...geoVector(selected.lat,selected.lon,1.013)):undefined
  const rotation=selectedVector?new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),selectedVector.clone().normalize()):undefined
  const stars=useMemo(()=>{
    const coordinates=new Float32Array(900*3)
    let seed=42
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
    for(let i=0;i<900;i++){const z=rand()*2-1,a=rand()*Math.PI*2,r=6+rand()*8,s=Math.sqrt(1-z*z);coordinates.set([r*s*Math.cos(a),r*z,r*s*Math.sin(a)],i*3)}
    return coordinates
  },[])
  return <>
    <color attach="background" args={['#06131f']} /><ambientLight intensity={2.1} /><directionalLight position={[3,4,-3]} intensity={2.6} color="#b4efed" />
    <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[stars,3]} /></bufferGeometry><pointsMaterial size={.018} color="#85a6bb" transparent opacity={.65} sizeAttenuation depthWrite={false} /></points>
    <mesh ref={earth} onClick={e=>e.stopPropagation()} onPointerMove={e=>{e.stopPropagation();hover(null)}}><sphereGeometry args={[1,96,64]} /><meshPhongMaterial map={texture} shininess={12} specular="#2d5764" /></mesh>
    <mesh scale={1.018}><sphereGeometry args={[1,64,48]} /><meshBasicMaterial color="#38a8c1" side={THREE.BackSide} transparent opacity={.13} depthWrite={false} /></mesh>
    <points onClick={e=>{const p=point(e);if(p){e.stopPropagation();onSelect(p)}}} onPointerMove={e=>{const p=point(e);if(p){e.stopPropagation();hover(p)}}} onPointerOut={()=>hover(null)}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[buffers.positions,3]} /><bufferAttribute attach="attributes-color" args={[buffers.colors,3]} /></bufferGeometry><pointsMaterial vertexColors size={.012} sizeAttenuation depthWrite={false} />
    </points>
    {ports.filter(p=>data.packs[p.locode]).map(p=><mesh key={p.locode} position={geoVector(p.lat,p.lon,1.012)} onClick={e=>{e.stopPropagation();onSelect(p)}} onPointerMove={e=>{e.stopPropagation();hover(p)}} onPointerOut={()=>hover(null)}><sphereGeometry args={[.0095,10,8]} /><meshBasicMaterial color={p.locode===selected?.locode?'#ffd695':'#c5fa8b'} /></mesh>)}
    {selected && selectedVector && <group position={selectedVector} quaternion={rotation}><mesh><ringGeometry args={[.021,.028,48]} /><meshBasicMaterial color="#ffd695" side={THREE.DoubleSide} /></mesh><Html center position={[0,.06,.008]} zIndexRange={[20,0]} occlude={[earth]}><span className="atlas-selected-marker">{selected.name_zh ?? selected.name} <b>{selected.locode}</b></span></Html></group>}
    <OrbitControls ref={orbit} enablePan={false} enableDamping dampingFactor={.08} minDistance={1.45} maxDistance={5} autoRotate={spin} autoRotateSpeed={.35} onStart={()=>{target.current=null}} />
  </>
}
export function GlobeScene(props:{data:GlobeData;ports:Port[];selected?:Port;spin:boolean;onSelect:(p:Port)=>void;onHover:(p:Port|null)=>void}) {
  return <GlobeBoundary><Canvas camera={{position:geoVector(23,110,3.25),fov:38,near:.05,far:50}} dpr={[1,1.8]} gl={{antialias:true,alpha:false}} onCreated={({raycaster})=>{raycaster.params.Points.threshold=.012}}><Earth {...props} /></Canvas></GlobeBoundary>
}
