import { useEffect, useRef } from 'react'

const RADIANS_PER_PIXEL = 0.009
const MAX_TILT = 1.15
const KEY_STEP = 0.4
const TURN = Math.PI * 2

// Things that keep their usual behaviour: links, buttons, readable text, the footer.
const NOT_DRAGGABLE = 'a, button, .caption, .site-header, .site-footer'

/*
  Lets the visitor turn the watch by hand. A mouse can turn and tilt it. A finger
  only turns it, because up and down swipes have to keep scrolling the page. The
  watch stays where it was left until the visitor scrolls, then eases back so the
  next shot is framed properly.
*/
export function useDragTurn() {
  const turn = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, dragging: false, scrollY: 0 })

  useEffect(() => {
    const t = turn.current
    let last = null
    let velocity = 0

    const down = (event) => {
      if (event.button !== 0 || event.target.closest?.(NOT_DRAGGABLE)) return
      last = { x: event.clientX, y: event.clientY, id: event.pointerId }
      velocity = 0
      t.dragging = true
      document.documentElement.classList.add('is-turning')
    }

    const move = (event) => {
      if (!last || event.pointerId !== last.id) return
      const dx = (event.clientX - last.x) * RADIANS_PER_PIXEL
      const dy = (event.clientY - last.y) * RADIANS_PER_PIXEL
      t.targetYaw += dx
      velocity = dx
      if (event.pointerType === 'mouse') {
        t.targetPitch = Math.max(-MAX_TILT, Math.min(MAX_TILT, t.targetPitch + dy))
      }
      last.x = event.clientX
      last.y = event.clientY
    }

    const up = () => {
      if (!last) return
      // A flick keeps the watch moving a little after it is let go.
      t.targetYaw += velocity * 8
      last = null
      t.dragging = false
      t.scrollY = window.scrollY
      document.documentElement.classList.remove('is-turning')
    }

    const key = (event) => {
      if (event.key === 'ArrowLeft') t.targetYaw -= KEY_STEP
      else if (event.key === 'ArrowRight') t.targetYaw += KEY_STEP
      else return
      t.scrollY = window.scrollY
    }

    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
      document.documentElement.classList.remove('is-turning')
    }
  }, [])

  return turn
}

// Scrolling hands the watch back to the page, by the shortest way round.
export function releaseOnScroll(t) {
  if (t.dragging || Math.abs(window.scrollY - t.scrollY) < 24) return
  t.targetYaw = Math.round(t.targetYaw / TURN) * TURN
  t.targetPitch = 0
  t.scrollY = window.scrollY
}
