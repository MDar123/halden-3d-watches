import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/*
  The whole page is one shot. `pose` is the single source of truth: scrolling
  moves these numbers, and the 3D scene reads them on every frame.

  rx, ry, rz    how the watch is turned
  fx, fy, fz    the point on the watch to look at, in watch units
  scale         how close we are
  sx, sy        where that point sits on screen, as a fraction of half the screen
  explode       0 is assembled, 1 is fully separated
  light         1 is the studio lights on, 0 is the room dark
  model         which watch from the collection is on show
*/
const HERO = {
  rx: -0.36, ry: 0.3, rz: 0.12, fx: 0, fy: 0, fz: 0, scale: 1, sx: 0.41, sy: 0.03,
  explode: 0, light: 1, model: 0,
}

export const pose = { ...HERO }

const PRODUCT = { fx: 0, fy: 0, fz: 0, scale: 1.08, sx: 0.28, sy: 0, explode: 0 }
const TURN = Math.PI * 2

// Times are in the same units as the section heights in styles.css: 100 is one screen.
const SHOTS = [
  { at: 0, duration: 80, to: { rx: -0.16, ry: 0.16, rz: 0.05, fx: 0, fy: 0.1, fz: 0.1, scale: 1.9, sx: 0.5, sy: 0 } },
  { at: 140, duration: 80, to: { rx: -0.22, ry: 0.22, rz: 0.02, fx: 0, fy: -0.72, fz: 0, scale: 2.4, sx: 0.58, sy: 0.1 } },
  { at: 280, duration: 80, to: { rx: -0.5, ry: -0.85, rz: 0.32, fx: 1.75, fy: 0, fz: -0.1, scale: 2.2, sx: 0.66, sy: 0 } },
  { at: 400, duration: 90, to: { rx: -0.98, ry: 0, rz: 0.6, fx: 0, fy: 0, fz: 1.3, scale: 0.62, sx: 0.3, sy: -0.02 } },
  { at: 440, duration: 130, to: { explode: 1 } },
  { at: 640, duration: 100, to: { rx: -0.2, ry: 0.14, rz: 0.06, fx: 0, fy: 0, fz: 0, scale: 1.05, sx: 0.3, sy: 0, explode: 0 } },
  { at: 740, duration: 80, to: { ...PRODUCT, rx: -0.3, ry: 0.22, rz: -0.1 } },
]

// Between watches the room goes dark while the watch turns, and the next one is
// lit as it comes back around. The swap happens at the darkest point.
const CHANGES = [
  { at: 880, model: 1, to: { rx: -0.34, ry: TURN + 0.24, rz: 0.14 } },
  { at: 1020, model: 2, to: { rx: -0.3, ry: TURN * 2 + 0.22, rz: -0.1 } },
  { at: 1160, model: 3, to: { rx: -0.32, ry: TURN * 3 + 0.2, rz: 0.12 } },
]
const CHANGE_LENGTH = 80
const PAGE_END = 1300

export function createScrollTimeline(trigger) {
  const timeline = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger, start: 'top top', end: 'bottom bottom', scrub: true },
  })
  SHOTS.forEach(({ at, duration, to }) => timeline.to(pose, { ...to, duration }, at))
  CHANGES.forEach(({ at, model, to }) => {
    timeline.to(pose, { ...to, duration: CHANGE_LENGTH }, at)
    timeline.to(pose, { light: 0, duration: 28, ease: 'power1.in' }, at + 12)
    timeline.set(pose, { model }, at + 40)
    timeline.to(pose, { light: 1, duration: 28, ease: 'power1.out' }, at + 40)
  })
  // Holds the last watch still until the end of the page.
  timeline.to({}, { duration: PAGE_END - 1240 }, 1240)
  return timeline
}

export const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
