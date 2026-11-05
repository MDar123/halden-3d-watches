import * as THREE from 'three'
import { DIAL_R, LUG_INNER_X, LUG_WIDTH, SUB_CENTRE, SUB_R } from './dimensions.js'

// Turns a [radius, height] profile into a part of the round case, axis on +z.
export function lathe(profile, segments = 256) {
  const points = profile.map(([r, z]) => new THREE.Vector2(r, z))
  const geometry = new THREE.LatheGeometry(points, segments)
  geometry.rotateX(Math.PI / 2)
  return geometry
}

// Eases between two profile points so edges have a small, believable radius.
export function arc(from, to, bulge, steps = 10) {
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const control = [mid[0] + dy * bulge, mid[1] - dx * bulge]
  const out = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    out.push([
      u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
    ])
  }
  return out
}

// Flat dial plate with the sub-dial hole cut out, UVs matching the dial canvas.
export function dialPlate() {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, DIAL_R, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(SUB_CENTRE[0], SUB_CENTRE[1], SUB_R, 0, Math.PI * 2, true)
  shape.holes.push(hole)

  const geometry = new THREE.ShapeGeometry(shape, 192)
  const position = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) / DIAL_R + 1) / 2, (position.getY(i) / DIAL_R + 1) / 2)
  }
  return geometry
}

// Dauphine hand: a ridge down the middle and flat facets either side. The facets
// are what catch the light and turn blued steel from black to blue as it moves.
export function dauphineHand(length, halfWidth, tail, ridge) {
  const left = [-halfWidth, 0, 0]
  const right = [halfWidth, 0, 0]
  const tip = [0, length, 0]
  const back = [0, -tail, 0]
  const crown = [0, 0, ridge]
  const triangles = [left, crown, tip, crown, right, tip, left, back, crown, crown, back, right]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles.flat(), 3))
  geometry.computeVertexNormals()
  return geometry
}

// Hour marker with a bevelled top, centred on the origin, long side on y.
export function baton(width, length, height) {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, -length / 2)
  shape.lineTo(width / 2, -length / 2)
  shape.lineTo(width / 2, length / 2)
  shape.lineTo(-width / 2, length / 2)
  shape.closePath()
  const bevel = width * 0.26
  return new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 1,
  })
}

// Curved lug drawn side-on, then extruded across its width.
export function lug() {
  const shape = new THREE.Shape()
  shape.moveTo(1.3, 0.09)
  shape.bezierCurveTo(1.8, 0.07, 2.2, -0.06, 2.45, -0.3)
  shape.quadraticCurveTo(2.52, -0.39, 2.43, -0.44)
  shape.bezierCurveTo(2.2, -0.42, 2.0, -0.36, 1.3, -0.38)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: LUG_WIDTH - 0.04,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelOffset: -0.02,
    bevelSegments: 4,
    curveSegments: 32,
  })
  geometry.translate(0, 0, -(LUG_WIDTH - 0.04) / 2)
  // Shape x becomes watch y, shape y becomes watch z, depth becomes watch x.
  geometry.applyMatrix4(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0),
    ),
  )
  return geometry
}

export const LUG_CENTRE_X = LUG_INNER_X + LUG_WIDTH / 2

// Fluted winding crown with its axis along +x.
export function crown(flutes = 38, outer = 0.27, inner = 0.252, depth = 0.2) {
  const shape = new THREE.Shape()
  const steps = flutes * 4
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const r = inner + (outer - inner) * (0.5 + 0.5 * Math.cos(a * flutes))
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.028,
    bevelOffset: -0.028,
    bevelSegments: 4,
  })
  geometry.rotateY(Math.PI / 2)
  return geometry
}

/*
  The strap path as a function: position, surface normal, width and thickness at
  any distance along it. The strap mesh and the stitching both read from this, so
  the stitches always sit on the leather.
*/
// Fake light falloff: the strap sinks into the dark as it leaves the case.
export const strapLight = (t) => 1 - THREE.MathUtils.smoothstep(t, 0.1, 0.42)

export function strapPath() {
  const curve = new THREE.CatmullRomCurve3(
    [
      [0, 1.84, -0.2],
      [0, 2.5, -0.36],
      [0, 3.6, -0.82],
      [0, 4.6, -1.5],
      [0, 5.5, -2.5],
      [0, 6.2, -3.9],
      [0, 6.6, -5.6],
      [0, 6.7, -8],
    ].map((p) => new THREE.Vector3(...p)),
  )
  const tangent = new THREE.Vector3()
  return {
    length: curve.getLength(),
    at(t) {
      const position = curve.getPointAt(t)
      curve.getTangentAt(t, tangent)
      const normal = new THREE.Vector3(0, -tangent.z, tangent.y).normalize()
      const ease = Math.min(t / 0.5, 1)
      return {
        position,
        normal,
        tangent: tangent.clone(),
        width: THREE.MathUtils.lerp(1.97, 1.62, ease),
        thickness: THREE.MathUtils.lerp(0.19, 0.11, ease),
      }
    },
  }
}

// Sweeps a rounded-rectangle cross-section along the strap path.
export function strapGeometry(path, rows = 160) {
  const corner = 5
  const section = (w, h) => {
    const pts = []
    const r = h * 0.42
    const corners = [
      [w / 2 - r, h / 2 - r, 0],
      [-w / 2 + r, h / 2 - r, Math.PI / 2],
      [-w / 2 + r, -h / 2 + r, Math.PI],
      [w / 2 - r, -h / 2 + r, (3 * Math.PI) / 2],
    ]
    corners.forEach(([cx, cy, start]) => {
      for (let i = 0; i <= corner; i++) {
        const a = start + (i / corner) * (Math.PI / 2)
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
      }
    })
    return pts
  }

  const ringSize = (corner + 1) * 4
  const positions = []
  const uvs = []
  const colors = []
  const indices = []

  for (let row = 0; row <= rows; row++) {
    const t = row / rows
    const f = path.at(t)
    section(f.width, f.thickness).forEach(([x, n], i) => {
      positions.push(x, f.position.y + f.normal.y * n, f.position.z + f.normal.z * n)
      uvs.push(x / 2 + 0.5, t)
      const light = strapLight(t)
      colors.push(light, light, light)
      if (row < rows) {
        const a = row * ringSize + i
        const b = row * ringSize + ((i + 1) % ringSize)
        const c = a + ringSize
        const d = b + ringSize
        indices.push(a, c, b, b, c, d)
      }
    })
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// Placement of each stitch along both edges of the strap's top face.
export function stitchMatrices(path, spacing = 0.125, inset = 0.1) {
  const matrices = []
  const up = new THREE.Vector3(0, 1, 0)
  const q = new THREE.Quaternion()
  const count = Math.floor(path.length / spacing)
  // Leave a gap at the lug end, where the keeper seam on a real strap sits.
  for (let i = 3; i < count; i++) {
    const t = i / count
    const f = path.at(t)
    q.setFromUnitVectors(up, f.tangent)
    ;[-1, 1].forEach((side) => {
      const position = new THREE.Vector3(
        side * (f.width / 2 - inset),
        f.position.y + (f.normal.y * f.thickness) / 2,
        f.position.z + (f.normal.z * f.thickness) / 2,
      )
      matrices.push({
        matrix: new THREE.Matrix4().compose(position, q, new THREE.Vector3(1, 1, 1)),
        light: strapLight(t),
      })
    })
  }
  return matrices
}
