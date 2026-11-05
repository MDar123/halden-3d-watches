import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pose, prefersReducedMotion } from '../scene/pose.js'
import { DIAL_R, SUB_CENTRE, SUB_R } from './dimensions.js'
import {
  LUG_CENTRE_X,
  arc,
  baton,
  crown,
  dauphineHand,
  dialPlate,
  lathe,
  lug,
  stitchMatrices,
  strapGeometry,
  strapPath,
} from './geometry.js'
import { createLeatherBump, getDialTextures } from './dialTexture.js'
import { MODELS } from './models.js'
import Movement from './Movement.jsx'

/*
  How far each layer travels along the watch's axis when fully apart, and how
  far each half of the strap slides away from the case.
*/
const LIFT = { crystal: 4, bezel: 3.1, hands: 2.35, dial: 1.6, movement: 0.8, back: -1.4 }
const STRAP_SLIDE = 1.4

// Sits to the right of the stack when the watch is turned for the exploded view.
const LABEL_X = 1.68
const LABEL_Y = -1.15

// Dresses the shared materials as one watch from the collection.
function applyModel(m, model) {
  const textures = getDialTextures(model)
  m.polished.color.set(model.polished.color)
  m.polished.roughness = model.polished.roughness
  m.satin.color.set(model.satin.color)
  m.satin.roughness = model.satin.roughness
  m.marker.color.set(model.marker)
  m.hands.color.set(model.hands.color)
  m.hands.emissive.set(model.hands.emissive)
  m.leather.color.set(model.leather)
  m.thread.color.set(model.thread)
  m.dial.map = textures.map
  m.dial.metalness = model.dial.metalness
  m.subDial.map = textures.subMap
}

function useMaterials() {
  return useMemo(() => {
    const { map, subMap, roughnessMap } = getDialTextures(MODELS[0])
    return {
      polished: new THREE.MeshStandardMaterial({ color: '#dfe1e4', metalness: 1, roughness: 0.07 }),
      satin: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 1, roughness: 0.3 }),
      marker: new THREE.MeshStandardMaterial({ color: '#e6e8ea', metalness: 1, roughness: 0.07 }),
      hands: new THREE.MeshStandardMaterial({
        color: '#16307c',
        emissive: '#0c2272',
        emissiveIntensity: 0.55,
        metalness: 1,
        roughness: 0.18,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide,
      }),
      dial: new THREE.MeshStandardMaterial({ map, roughnessMap, metalness: 0.3, roughness: 1 }),
      dialBack: new THREE.MeshStandardMaterial({ color: '#a97f6c', metalness: 0.9, roughness: 0.42 }),
      subDial: new THREE.MeshStandardMaterial({
        map: subMap,
        metalness: 0.2,
        roughness: 0.55,
      }),
      leather: new THREE.MeshPhysicalMaterial({
        color: '#241209',
        vertexColors: true,
        roughness: 0.58,
        bumpMap: createLeatherBump(),
        bumpScale: 0.6,
        clearcoat: 0.12,
        clearcoatRoughness: 0.5,
        side: THREE.DoubleSide,
      }),
      thread: new THREE.MeshStandardMaterial({ color: '#d8c4a6', roughness: 0.8 }),
      // A black surface added on top of the dial, so only the glass's reflections
      // show. Keeps the printing under it perfectly sharp.
      crystal: new THREE.MeshPhysicalMaterial({
        color: '#000000',
        metalness: 0,
        roughness: 0.02,
        ior: 1.76,
        specularIntensity: 1,
        envMapIntensity: 1.1,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }
  }, [])
}

function useCaseGeometry() {
  return useMemo(
    () => ({
      // Case back, with a closed inner face for when the case is lifted off it
      back: lathe([[0, -0.6], [1.5, -0.6], ...arc([1.5, -0.6], [1.84, -0.4], -0.25)]),
      backInside: lathe([[1.84, -0.4], [0, -0.4]]),
      // Middle of the case, closed top and bottom so it reads as a solid ring
      flank: lathe(arc([1.84, -0.4], [1.88, 0.12], -0.11, 24)),
      caseTop: lathe([[1.88, 0.12], [1.56, 0.12]]),
      caseInside: lathe([[1.56, 0.12], [1.56, -0.4]]),
      caseUnder: lathe([[1.56, -0.4], [1.84, -0.4]]),
      // Bezel
      bezel: lathe([
        ...arc([1.88, 0.12], [1.72, 0.235], -0.35, 16),
        ...arc([1.72, 0.235], [1.61, 0.25], -0.2, 8),
      ]),
      rehaut: lathe([[1.61, 0.25], [1.565, 0.22], [DIAL_R, 0.01]]),
      bezelUnder: lathe([[DIAL_R, 0.01], [1.88, 0.12]]),
      // A true spherical dome: a cone-shaped one turns reflections into wedges.
      crystal: lathe(
        [
          [1.61, 0.235],
          ...[...Array(41).keys()].map((i) => {
            const r = 1.585 * (1 - i / 40)
            return [r, 0.29 + (1.585 ** 2 - r ** 2) / (2 * 18)]
          }),
        ],
        192,
      ),
      subDial: new THREE.CircleGeometry(SUB_R, 128),
      subGuard: lathe([[SUB_R + 0.008, 0.002], [SUB_R, 0.006], [SUB_R - 0.003, -0.018]], 128),
      dial: dialPlate(),
      dialBack: lathe([[0, -0.04], [DIAL_R, -0.04], [DIAL_R, 0]], 128),
      lug: lug(),
      crownHead: crown(),
      crownStem: new THREE.CylinderGeometry(0.11, 0.11, 0.18, 48).rotateZ(Math.PI / 2),
      springBar: new THREE.CylinderGeometry(0.024, 0.024, 2.2, 16).rotateZ(Math.PI / 2),
    }),
    [],
  )
}

function Lugs({ geometry, material }) {
  return [1, -1].map((side) => (
    <mesh
      key={side}
      geometry={geometry}
      material={material}
      position-x={side * LUG_CENTRE_X}
      castShadow
      receiveShadow
    />
  ))
}

function Strap({ materials, springBar }) {
  const stitches = useRef()
  const group = useRef()
  const { geometry, stitch, matrices } = useMemo(() => {
    const path = strapPath()
    return {
      geometry: strapGeometry(path),
      stitch: new THREE.CapsuleGeometry(0.0115, 0.066, 3, 8),
      matrices: stitchMatrices(path),
    }
  }, [])

  useLayoutEffect(() => {
    const color = new THREE.Color()
    matrices.forEach(({ matrix, light }, i) => {
      stitches.current.setMatrixAt(i, matrix)
      stitches.current.setColorAt(i, color.setScalar(light))
    })
    stitches.current.instanceMatrix.needsUpdate = true
    stitches.current.instanceColor.needsUpdate = true
  }, [matrices])

  useFrame(() => {
    group.current.position.y = pose.explode * STRAP_SLIDE
  })

  return (
    <group ref={group}>
      <mesh geometry={geometry} material={materials.leather} castShadow receiveShadow />
      <instancedMesh ref={stitches} args={[stitch, materials.thread, matrices.length]} />
      <mesh geometry={springBar} material={materials.polished} position={[0, 2.14, -0.31]} castShadow />
    </group>
  )
}

function Markers({ material }) {
  const geometry = useMemo(() => baton(0.062, 0.31, 0.034), [])
  const hours = [...Array(12).keys()].filter((h) => h !== 6 && h !== 0)
  const placed = (angle, x = 0) => {
    const r = 1.05
    return (
      <mesh
        key={`${angle}-${x}`}
        geometry={geometry}
        material={material}
        rotation-z={-angle}
        position={[Math.sin(angle) * r + Math.cos(angle) * x, Math.cos(angle) * r - Math.sin(angle) * x, 0]}
        castShadow
        receiveShadow
      />
    )
  }
  return (
    <>
      {hours.map((h) => placed((h / 12) * Math.PI * 2))}
      {/* A doubled marker at 12 gives the eye an orientation point. */}
      {placed(0, -0.052)}
      {placed(0, 0.052)}
    </>
  )
}

function Hands({ material }) {
  const hourRef = useRef()
  const minuteRef = useRef()
  const secondRef = useRef()
  const geometry = useMemo(
    () => ({
      hour: dauphineHand(0.76, 0.07, 0.15, 0.012),
      minute: dauphineHand(1.3, 0.052, 0.2, 0.01),
      second: dauphineHand(0.355, 0.012, 0.1, 0.004),
      hub: new THREE.CylinderGeometry(0.058, 0.066, 0.05, 48).rotateX(Math.PI / 2),
      subHub: new THREE.CylinderGeometry(0.018, 0.018, 0.02, 24).rotateX(Math.PI / 2),
    }),
    [],
  )
  const reduced = useMemo(() => prefersReducedMotion(), [])

  // Reads the visitor's clock. Mechanical seconds move in six small beats a second.
  useFrame(() => {
    const now = new Date()
    const beats = reduced ? 1 : 6
    const ms = now.getMilliseconds() / 1000
    const seconds = now.getSeconds() + Math.floor(ms * beats) / beats
    const minutes = now.getMinutes() + seconds / 60
    const hours = (now.getHours() % 12) + minutes / 60
    secondRef.current.rotation.z = -(seconds / 60) * Math.PI * 2
    minuteRef.current.rotation.z = -(minutes / 60) * Math.PI * 2
    hourRef.current.rotation.z = -(hours / 12) * Math.PI * 2
  })

  return (
    <>
      <mesh ref={hourRef} geometry={geometry.hour} material={material} position-z={0.06} castShadow />
      <mesh ref={minuteRef} geometry={geometry.minute} material={material} position-z={0.09} castShadow />
      <mesh geometry={geometry.hub} material={material} position-z={0.085} castShadow />
      <group position={[SUB_CENTRE[0], SUB_CENTRE[1], -0.004]}>
        <mesh ref={secondRef} geometry={geometry.second} material={material} castShadow />
        <mesh geometry={geometry.subHub} material={material} castShadow />
      </group>
    </>
  )
}

// A part name that appears once the watch is apart. Fades in with the last of the travel.
// The text lives in the page (see PARTS in App.jsx), and this keeps it beside its part.
function PartLabel({ part, z = 0 }) {
  const anchor = useRef()
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const label = document.getElementById(`part-${part}`)
    if (!label) return
    const opacity = THREE.MathUtils.smoothstep(pose.explode, 0.72, 1)
    label.style.opacity = opacity
    if (opacity === 0) return
    anchor.current.getWorldPosition(point).project(camera)
    const x = ((point.x + 1) / 2) * size.width
    const y = ((1 - point.y) / 2) * size.height
    label.style.transform = `translate(${x}px, ${y}px) translateY(-50%)`
  })
  return <object3D ref={anchor} position={[LABEL_X, LABEL_Y, z]} />
}

export default function Watch() {
  const m = useMaterials()
  const g = useCaseGeometry()
  const subOffset = [SUB_CENTRE[0], SUB_CENTRE[1]]

  const crystal = useRef()
  const bezel = useRef()
  const hands = useRef()
  const dial = useRef()
  const movement = useRef()
  const back = useRef()

  const showing = useRef(0)
  const markers = useRef()

  // Draws the other dials soon after load, one at a time, so changing watch never stalls.
  useEffect(() => {
    const timers = MODELS.slice(1).map((model, i) =>
      setTimeout(() => getDialTextures(model), 1200 + i * 500),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  useFrame(() => {
    const index = Math.round(pose.model)
    if (index !== showing.current) {
      showing.current = index
      applyModel(m, MODELS[index])
      markers.current.visible = MODELS[index].appliedMarkers
    }
    // Keeps the hands from glowing in the dark while the room is dimmed.
    m.hands.emissiveIntensity = 0.55 * pose.light

    const e = pose.explode
    crystal.current.position.z = LIFT.crystal * e
    bezel.current.position.z = LIFT.bezel * e
    hands.current.position.z = LIFT.hands * e
    dial.current.position.z = LIFT.dial * e
    movement.current.position.z = LIFT.movement * e
    back.current.position.z = LIFT.back * e
    // No need to draw the movement while it is sealed inside the case.
    movement.current.visible = e > 0.002
  })

  return (
    <group>
      {/* Middle of the case, which stays still while everything else moves */}
      <mesh geometry={g.flank} material={m.satin} castShadow receiveShadow />
      <mesh geometry={g.caseTop} material={m.satin} receiveShadow />
      <mesh geometry={g.caseInside} material={m.satin} receiveShadow />
      <mesh geometry={g.caseUnder} material={m.satin} />
      <Lugs geometry={g.lug} material={m.polished} />
      <group rotation-z={Math.PI}>
        <Lugs geometry={g.lug} material={m.polished} />
      </group>
      <group position={[1.8, 0, -0.14]}>
        <mesh geometry={g.crownStem} material={m.satin} position-x={0.08} />
        <mesh geometry={g.crownHead} material={m.polished} position-x={0.15} castShadow />
      </group>
      <PartLabel part="case" z={-0.14} />

      <group ref={back}>
        <mesh geometry={g.back} material={m.satin} castShadow />
        <mesh geometry={g.backInside} receiveShadow>
          <meshStandardMaterial color="#7d8086" metalness={1} roughness={0.5} />
        </mesh>
        <PartLabel part="back" z={-0.5} />
      </group>

      <group ref={movement} visible={false}>
        <Movement blued={m.hands} />
        <PartLabel part="movement" z={-0.28} />
      </group>

      <group ref={dial}>
        <mesh geometry={g.dial} material={m.dial} receiveShadow />
        <mesh geometry={g.dialBack} material={m.dialBack} />
        <mesh geometry={g.subDial} material={m.subDial} position={[...subOffset, -0.02]} receiveShadow />
        <mesh geometry={g.subGuard} material={m.polished} position={[...subOffset, 0]} receiveShadow />
        <group ref={markers}>
          <Markers material={m.marker} />
        </group>
        <PartLabel part="dial" />
      </group>

      <group ref={hands}>
        <Hands material={m.hands} />
        <PartLabel part="hands" z={0.08} />
      </group>

      <group ref={bezel}>
        <mesh geometry={g.bezel} material={m.polished} castShadow receiveShadow />
        <mesh geometry={g.rehaut} material={m.satin} receiveShadow />
        <mesh geometry={g.bezelUnder} material={m.satin} />
        <PartLabel part="bezel" z={0.18} />
      </group>

      <group ref={crystal}>
        <mesh geometry={g.crystal} material={m.crystal} />
        <PartLabel part="crystal" z={0.3} />
      </group>

      {/* The second half of the strap is the first turned 180 degrees */}
      <Strap materials={m} springBar={g.springBar} />
      <group rotation-z={Math.PI}>
        <Strap materials={m} springBar={g.springBar} />
      </group>
    </group>
  )
}
