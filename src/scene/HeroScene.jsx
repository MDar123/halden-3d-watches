import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import gsap from 'gsap'
import * as THREE from 'three'
import Watch from '../watch/Watch.jsx'
import { pose, prefersReducedMotion } from './pose.js'
import { releaseOnScroll, useDragTurn } from './useDragTurn.js'

const SPOT_INTENSITY = 150

/*
  Lit like a product photo: a dark room with long softboxes. Polished metal only
  looks like metal when it has something bright to reflect, so the softboxes do
  most of the work. The one spotlight exists to throw real shadows from the
  hands and markers onto the dial.
*/
function StudioLights() {
  return (
    <Environment resolution={1024} frames={1}>
      <color attach="background" args={['#000000']} />
      {/* Overhead softbox */}
      <Lightformer form="rect" intensity={3.2} position={[0, 7, -1.5]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 4, 1]} />
      {/* Long strip to camera left, the main highlight on the case flank */}
      <Lightformer form="rect" intensity={7} position={[-7, 1, 3]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 14, 1]} />
      {/* Thin hard strip to camera right, for a crisp line on the bezel */}
      <Lightformer form="rect" intensity={11} position={[7, -1, -1.5]} rotation={[0, -Math.PI / 2, 0]} scale={[0.5, 14, 1]} />
      {/* Broad dim wall behind the camera, so polished markers read as steel, not black paint */}
      <Lightformer form="rect" intensity={0.55} position={[0, 0, 14]} rotation={[0, Math.PI, 0]} scale={[24, 24, 1]} />
      {/* Low card in front, keeps the blued hands from going black */}
      <Lightformer form="rect" intensity={1.6} position={[1, 3, 9]} rotation={[-0.3, 0, 0]} scale={[7, 2, 1]} />
      {/* Cool kicker from behind */}
      <Lightformer form="rect" intensity={2.2} color="#bcd0ff" position={[2, -6, -5]} rotation={[-2.2, 0, 0]} scale={[10, 2, 1]} />
    </Environment>
  )
}

// Applies the scroll pose to the watch, and a small tilt towards a mouse pointer.
function WatchRig() {
  const outer = useRef()
  const inner = useRef()
  const hand = useRef()
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const euler = useRef(new THREE.Euler())
  const handEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const focus = useRef(new THREE.Vector3())
  const turn = useDragTurn()

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    const onMove = (event) => {
      if (event.pointerType !== 'mouse') return
      pointer.current.tx = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.ty = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(({ camera, size }, delta) => {
    const aspect = size.width / size.height
    const wide = aspect > 1.15
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
    const halfWidth = halfHeight * aspect
    const fit = wide ? Math.min(0.92, aspect * 0.55) : Math.min(0.8, aspect * 1.25)
    const scale = pose.scale * fit

    const p = pointer.current
    p.x = THREE.MathUtils.damp(p.x, p.tx, 3, delta)
    p.y = THREE.MathUtils.damp(p.y, p.ty, 3, delta)

    const t = turn.current
    releaseOnScroll(t)
    t.yaw = THREE.MathUtils.damp(t.yaw, t.targetYaw, 9, delta)
    t.pitch = THREE.MathUtils.damp(t.pitch, t.targetPitch, 9, delta)
    const h = handEuler.current.set(t.pitch, t.yaw, 0)
    hand.current.rotation.copy(h)

    const tilt = t.dragging ? 0 : 1
    const e = euler.current.set(pose.rx + p.y * 0.05 * tilt, pose.ry + p.x * 0.08 * tilt, pose.rz)
    inner.current.rotation.copy(e)

    // Keep the chosen point of the watch on its chosen spot on screen.
    const v = focus.current
      .set(pose.fx, pose.fy, pose.fz)
      .applyEuler(e)
      .applyEuler(h)
      .multiplyScalar(scale)
    // On a phone the separated watch slides left to leave room for the part names.
    const screenX = wide ? pose.sx * halfWidth : -0.33 * pose.explode * halfWidth
    const screenY = wide ? pose.sy * halfHeight : 0.36 * halfHeight
    outer.current.position.set(screenX - v.x, screenY - v.y, -v.z)
    outer.current.scale.setScalar(scale)
  })

  return (
    <group ref={outer}>
      <group ref={hand}>
        <group ref={inner}>
          <Watch />
        </group>
      </group>
    </group>
  )
}

export default function HeroScene() {
  const spot = useRef()
  const intro = useRef({ v: prefersReducedMotion() ? 1 : 0 })

  // The one load moment: the studio lights come up on the watch.
  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    intro.current.v = 0
    const tween = gsap.to(intro.current, { v: 1, duration: 2.4, ease: 'power2.inOut' })
    return () => tween.kill()
  }, [])

  // Combines the load moment with the dimming between watches.
  useFrame(({ scene }) => {
    const level = intro.current.v * pose.light
    scene.environmentIntensity = level
    if (spot.current) spot.current.intensity = level * SPOT_INTENSITY
  })

  return (
    <>
      <StudioLights />

      <spotLight
        ref={spot}
        castShadow
        position={[-2.6, 4.6, 8]}
        angle={0.5}
        penumbra={0.9}
        intensity={0}
        decay={2}
        color="#fff4e8"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.006}
        shadow-camera-near={3}
        shadow-camera-far={18}
      />

      <WatchRig />
    </>
  )
}
