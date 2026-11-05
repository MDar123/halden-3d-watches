import * as THREE from 'three'
import { DIAL_R, SUB_R } from './dimensions.js'

// Bodoni's hairlines vanish at tiny sizes, so it is kept for the larger dial text.
const DISPLAY_FONT = '"Bodoni Moda Variable", Georgia, serif'
const PRINT_FONT = '"Hanken Grotesk Variable", Arial, sans-serif'
const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']

function makeCanvas(size) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  return canvas
}

function toTexture(canvas, { srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 16
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Draws with dial units: origin at the centre, y pointing down.
function dialContext(canvas, radius) {
  const ctx = canvas.getContext('2d')
  const scale = canvas.width / 2 / radius
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.scale(scale, scale)
  return ctx
}

function disc(ctx, r, fill) {
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

function ring(ctx, r, width, stroke) {
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.lineWidth = width
  ctx.strokeStyle = stroke
  ctx.stroke()
}

function radialTicks(ctx, ink, count, inner, outer, width) {
  ctx.strokeStyle = ink
  ctx.lineWidth = width
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const s = Math.sin(a)
    const c = -Math.cos(a)
    ctx.beginPath()
    ctx.moveTo(s * inner, c * inner)
    ctx.lineTo(s * outer, c * outer)
    ctx.stroke()
  }
}

function radialNumber(ctx, ink, text, angle, radius, size, weight = 500, family = PRINT_FONT) {
  ctx.save()
  ctx.rotate(angle)
  ctx.translate(0, -radius)
  // Canvas text can't be set at a fraction of a pixel, so size it up and scale down.
  const k = 100 / size
  ctx.scale(1 / k, 1 / k)
  ctx.font = `${weight} 100px ${family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

function dialText(ctx, ink, text, y, size, weight, spacing, family) {
  ctx.save()
  ctx.translate(0, y)
  const k = 100 / size
  ctx.scale(1 / k, 1 / k)
  ctx.font = `${weight} 100px ${family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing * k}px`
  ctx.fillText(text, 0, 0)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  ctx.restore()
}

// Fine sunray brushing, shared by every dial, so light sweeps across the surface.
let sharedRoughness
function sunrayRoughness() {
  if (sharedRoughness) return sharedRoughness
  const canvas = makeCanvas(2048)
  const ctx = dialContext(canvas, DIAL_R)
  disc(ctx, DIAL_R, 'rgb(112,112,112)')
  for (let i = 0; i < 9000; i++) {
    const a = Math.random() * Math.PI * 2
    const v = 92 + Math.random() * 46
    ctx.strokeStyle = `rgba(${v},${v},${v},0.5)`
    ctx.lineWidth = 0.0012
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 0.1, Math.sin(a) * 0.1)
    ctx.lineTo(Math.cos(a) * DIAL_R, Math.sin(a) * DIAL_R)
    ctx.stroke()
  }
  sharedRoughness = toTexture(canvas, { srgb: false })
  return sharedRoughness
}

function drawDial(model) {
  const { dial } = model
  const canvas = makeCanvas(3000)
  const ctx = dialContext(canvas, DIAL_R)

  disc(ctx, DIAL_R, dial.minutes)
  disc(ctx, 1.26, dial.hours)
  disc(ctx, 0.84, dial.centre)
  if (!dial.plain) {
    ring(ctx, 1.26, 0.0055, dial.ink)
    ring(ctx, 0.84, 0.0055, dial.ink)
  }

  radialTicks(ctx, dial.ink, 60, 1.285, 1.335, 0.0055)
  radialTicks(ctx, dial.ink, 12, 1.285, 1.36, 0.013)

  if (dial.roman) {
    ROMAN.forEach((numeral, i) => {
      if (i === 6) return // The small seconds dial sits here
      radialNumber(ctx, dial.ink, numeral, (i / 12) * Math.PI * 2, 1.06, 0.24, 600, DISPLAY_FONT)
    })
  } else {
    for (let i = 1; i <= 12; i++) {
      radialNumber(ctx, dial.ink, String(i * 5), (i / 12) * Math.PI * 2, 1.425, 0.085)
    }
  }

  dialText(ctx, dial.ink, 'HALDEN', -0.5, 0.125, 800, 0.012, DISPLAY_FONT)
  dialText(ctx, dial.ink, model.name, -0.375, 0.066, 500, 0.003, PRINT_FONT)
  return toTexture(canvas)
}

function drawSubDial({ dial }) {
  const canvas = makeCanvas(1200)
  const ctx = dialContext(canvas, SUB_R)
  disc(ctx, SUB_R, dial.sub)
  // Concentric grooves, as machined on a real recessed sub-dial.
  for (let r = 0.02; r < SUB_R; r += 0.0065) {
    ring(ctx, r, 0.0012, dial.groove)
  }
  radialTicks(ctx, dial.ink, 60, 0.345, 0.375, 0.0028)
  radialTicks(ctx, dial.ink, 12, 0.335, 0.375, 0.0055)
  ;[20, 40, 60].forEach((n) => {
    radialNumber(ctx, dial.ink, String(n), (n / 60) * Math.PI * 2, 0.268, 0.075)
  })
  return toTexture(canvas)
}

// Each dial is drawn once and kept, so changing watch later costs nothing.
const cache = new Map()

export function getDialTextures(model) {
  if (!cache.has(model.id)) {
    cache.set(model.id, {
      map: drawDial(model),
      subMap: drawSubDial(model),
      roughnessMap: sunrayRoughness(),
    })
  }
  return cache.get(model.id)
}

// Fine irregular pebbling for the leather strap, used as a bump map.
export function createLeatherBump() {
  const size = 512
  const canvas = makeCanvas(size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 14000; i++) {
    const v = 90 + Math.random() * 90
    ctx.fillStyle = `rgba(${v},${v},${v},0.55)`
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 0.8 + Math.random() * 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = toTexture(canvas, { srgb: false })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5, 16)
  return texture
}
