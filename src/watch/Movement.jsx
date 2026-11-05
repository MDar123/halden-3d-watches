import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pose } from '../scene/pose.js'
import { lathe } from './geometry.js'

/*
  A decorative movement for the exploded view. It is laid out to look like watch
  engineering, but it is an illustration and not a working calibre. Swap in the
  real movement here when a client model is available.
*/
const makeCanvas = (size) => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  return canvas
}

const tiled = (canvas, repeat) => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.anisotropy = 16
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Overlapping circular graining, the classic finish on a base plate.
function perlage() {
  const size = 512
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#b4b7bc'
  ctx.fillRect(0, 0, size, size)
  const step = 42
  for (let row = -1; row <= size / step + 1; row++) {
    for (let col = -1; col <= size / step + 1; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0)
      const y = row * step
      const glow = ctx.createRadialGradient(x, y, 0, x, y, step * 0.8)
      glow.addColorStop(0, '#e2e4e8')
      glow.addColorStop(0.65, '#a8abb1')
      glow.addColorStop(1, '#8e9197')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, step * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return tiled(canvas, 2.4)
}

// Parallel bands across the bridge, known as Geneva stripes.
function genevaStripes() {
  const size = 512
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')
  const bands = 4
  const height = size / bands
  for (let i = 0; i < bands; i++) {
    const band = ctx.createLinearGradient(0, i * height, 0, (i + 1) * height)
    band.addColorStop(0, '#a9acb2')
    band.addColorStop(0.5, '#e8eaee')
    band.addColorStop(1, '#a9acb2')
    ctx.fillStyle = band
    ctx.fillRect(0, i * height, size, height)
  }
  const texture = tiled(canvas, 1)
  texture.rotation = 0.5
  return texture
}

function bridgeGeometry() {
  const shape = new THREE.Shape()
  const a = Math.PI / 6
  shape.absarc(0, 0, 1.46, a, a + Math.PI, false)
  shape.lineTo(-0.55, -0.32)
  shape.lineTo(0.55, 0.32)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 96,
  })
}

function gearGeometry(teeth, radius, windows = 5) {
  const shape = new THREE.Shape()
  const toothDepth = radius * 0.09
  const steps = teeth * 4
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const r = i % 4 < 2 ? radius : radius - toothDepth
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  for (let i = 0; i < windows; i++) {
    const a = (i / windows) * Math.PI * 2
    const hole = new THREE.Path()
    hole.absarc(Math.cos(a) * radius * 0.52, Math.sin(a) * radius * 0.52, radius * 0.24, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: false, curveSegments: 16 })
}

function hairspringGeometry() {
  const points = []
  const turns = 9
  for (let i = 0; i <= 360; i++) {
    const t = i / 360
    const a = t * turns * Math.PI * 2
    const r = 0.05 + t * 0.2
    points.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 720, 0.0028, 5)
}

const GEARS = [
  { position: [0.86, 0.1], teeth: 40, radius: 0.31, speed: 0.5 },
  { position: [0.02, -0.72], teeth: 48, radius: 0.36, speed: -0.34 },
  { position: [-0.62, -0.72], teeth: 30, radius: 0.25, speed: 0.72 },
]

const SCREWS = [
  [-1.15, 0.72],
  [-0.2, 1.28],
  [0.72, 1.05],
  [-1.3, -0.15],
  [-0.1, 0.45],
]

const JEWELS = [
  [-0.55, 0.45],
  [0.2, 0.75],
  [-0.85, 0.05],
]

function Jewel({ position, materials, z }) {
  return (
    <group position={[position[0], position[1], z]}>
      <mesh rotation-x={Math.PI / 2} material={materials.brass}>
        <cylinderGeometry args={[0.055, 0.055, 0.012, 32]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-z={0.008} material={materials.ruby}>
        <cylinderGeometry args={[0.028, 0.03, 0.012, 24]} />
      </mesh>
    </group>
  )
}

export default function Movement({ blued }) {
  const balance = useRef()
  const gears = useRef([])

  const materials = useMemo(
    () => ({
      plate: new THREE.MeshStandardMaterial({ map: perlage(), metalness: 0.85, roughness: 0.42 }),
      bridge: new THREE.MeshStandardMaterial({ map: genevaStripes(), metalness: 0.95, roughness: 0.3 }),
      edge: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 1, roughness: 0.3 }),
      brass: new THREE.MeshStandardMaterial({ color: '#d4a753', metalness: 1, roughness: 0.26 }),
      ruby: new THREE.MeshPhysicalMaterial({ color: '#b5103c', roughness: 0.06, clearcoat: 1 }),
      dark: new THREE.MeshStandardMaterial({ color: '#05060a', roughness: 0.5 }),
    }),
    [],
  )

  const geometry = useMemo(() => {
    const circle = new THREE.ShapeGeometry(
      new THREE.Shape().absarc(0, 0, 1.5, 0, Math.PI * 2, false),
      128,
    )
    return {
      plate: circle,
      edge: lathe([[1.5, -0.36], [1.5, -0.2]], 128),
      bridge: bridgeGeometry(),
      gears: GEARS.map((g) => gearGeometry(g.teeth, g.radius)),
      spring: hairspringGeometry(),
    }
  }, [])

  useFrame(({ clock }) => {
    // Nothing here can be seen until the watch has started to come apart.
    if (pose.explode < 0.002) return
    const t = clock.getElapsedTime()
    balance.current.rotation.z = Math.sin(t * Math.PI * 2 * 2.5) * 1.5
    gears.current.forEach((gear, i) => {
      if (gear) gear.rotation.z = t * GEARS[i].speed
    })
  })

  return (
    <group>
      <mesh geometry={geometry.edge} material={materials.edge} />
      <mesh geometry={geometry.plate} material={materials.plate} position-z={-0.2} receiveShadow />

      <mesh geometry={geometry.bridge} material={materials.bridge} position-z={-0.2} castShadow receiveShadow />

      {SCREWS.map(([x, y]) => (
        <group key={`${x}${y}`} position={[x, y, -0.118]}>
          <mesh rotation-x={Math.PI / 2} material={blued}>
            <cylinderGeometry args={[0.05, 0.05, 0.016, 32]} />
          </mesh>
          <mesh position-z={0.008} rotation-z={x * 3} material={materials.dark}>
            <boxGeometry args={[0.095, 0.012, 0.004]} />
          </mesh>
        </group>
      ))}

      {JEWELS.map((position) => (
        <Jewel key={position.join()} position={position} materials={materials} z={-0.118} />
      ))}

      {GEARS.map((gear, i) => (
        <group key={gear.teeth} position={[gear.position[0], gear.position[1], -0.17]}>
          <mesh
            ref={(el) => {
              gears.current[i] = el
            }}
            geometry={geometry.gears[i]}
            material={materials.brass}
            castShadow
            receiveShadow
          />
          <Jewel position={[0, 0]} materials={materials} z={0.03} />
        </group>
      ))}

      {/* Balance wheel and the bridge that holds it */}
      <group position={[0.68, -0.68, -0.13]}>
        <group ref={balance}>
          <mesh material={materials.brass} castShadow>
            <torusGeometry args={[0.36, 0.026, 12, 96]} />
          </mesh>
          {[0, Math.PI / 2].map((a) => (
            <mesh key={a} rotation-z={a} material={materials.brass}>
              <boxGeometry args={[0.72, 0.026, 0.016]} />
            </mesh>
          ))}
          {[...Array(10).keys()].map((i) => {
            const a = (i / 10) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.385, Math.sin(a) * 0.385, 0]} rotation-z={a + Math.PI / 2} material={blued}>
                <boxGeometry args={[0.03, 0.022, 0.03]} />
              </mesh>
            )
          })}
        </group>
        <mesh geometry={geometry.spring} material={materials.edge} position-z={0.03} />
        <mesh position={[0.2, -0.12, 0.05]} rotation-z={-0.54} material={materials.bridge} castShadow>
          <boxGeometry args={[0.56, 0.11, 0.02]} />
        </mesh>
        <Jewel position={[0, 0]} materials={materials} z={0.062} />
      </group>
    </group>
  )
}
