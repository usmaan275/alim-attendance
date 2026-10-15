import { useEffect, useRef } from 'react'

// ---------- Swipe settings ----------
const SWIPE_SNAP = 0.25 // drag at least 25% of the width to change page
const SWIPE_EDGE = 20   // px: ignore touches starting at the screen edge (iOS back gesture)
const SWIPE_MS = 200    // slide-out duration

/**
 * Touch-drag carousel behaviour.
 * - areaRef    -> the stable wrapper that listens for touches
 * - contentRef -> the element that follows the finger (re-created for each page)
 * - canGo(dir)      whether there is a page in that direction ('next' | 'prev')
 * - confirmGo(dir)  optional: return false to cancel (e.g. unsaved changes)
 * - onGo(dir)       change the page
 */
export default function useSwipe({ enabled, canGo, confirmGo, onGo }) {
  const areaRef = useRef(null)
  const contentRef = useRef(null)
  const latest = useRef({})
  latest.current = { canGo, confirmGo, onGo }

  useEffect(() => {
    const area = areaRef.current
    if (!enabled || !area) return

    let startX = 0
    let startY = 0
    let startT = 0
    let tracking = false
    let horizontal = null // null = undecided, then true / false once the direction is locked
    let busy = false
    let swallowClick = false
    let timer = null
    let clickTimer = null

    const drag = (x) => {
      const el = contentRef.current
      if (!el) return
      el.style.transition = 'none'
      el.style.transform = `translate3d(${x}px, 0, 0)`
    }

    const settle = (x, fade) => {
      const el = contentRef.current
      if (!el) return
      el.style.transition = `transform ${SWIPE_MS}ms ease, opacity ${SWIPE_MS}ms ease`
      el.style.transform = `translate3d(${x}px, 0, 0)`
      el.style.opacity = fade ? '0' : '1'
    }

    const onStart = (e) => {
      if (busy || e.touches.length !== 1 || !contentRef.current) return
      const t = e.touches[0]
      if (t.clientX < SWIPE_EDGE || t.clientX > window.innerWidth - SWIPE_EDGE) return
      startX = t.clientX
      startY = t.clientY
      startT = Date.now()
      tracking = true
      horizontal = null
    }

    const onMove = (e) => {
      if (!tracking) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY

      if (horizontal === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        horizontal = Math.abs(dx) > Math.abs(dy)
      }
      if (!horizontal) return

      if (e.cancelable) e.preventDefault()
      const dir = dx < 0 ? 'next' : 'prev'
      // Rubber-band resistance when there is nothing further in that direction
      drag(latest.current.canGo(dir) ? dx : dx * 0.25)
    }

    const onEnd = (e) => {
      if (!tracking) return
      tracking = false
      if (!horizontal) return

      // The finger moved sideways, so ignore the click the browser may still fire
      swallowClick = true
      clickTimer = setTimeout(() => { swallowClick = false }, 350)

      const dx = e.changedTouches[0].clientX - startX
      const width = area.offsetWidth
      const far = Math.abs(dx) > width * SWIPE_SNAP
      const quick = Date.now() - startT < 250 && Math.abs(dx) > 40
      const dir = dx < 0 ? 'next' : 'prev'
      const { canGo, confirmGo, onGo } = latest.current

      const commit = (far || quick) && canGo(dir) && (!confirmGo || confirmGo(dir))

      busy = true
      if (!commit) {
        settle(0, false)
        timer = setTimeout(() => { busy = false }, SWIPE_MS)
        return
      }

      settle(dx < 0 ? -width : width, true)
      timer = setTimeout(() => {
        onGo(dir)
        busy = false
      }, SWIPE_MS)
    }

    const onCancel = () => {
      if (tracking && horizontal) settle(0, false)
      tracking = false
    }

    const onClickCapture = (e) => {
      if (swallowClick) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    area.addEventListener('touchstart', onStart, { passive: true })
    area.addEventListener('touchmove', onMove, { passive: false })
    area.addEventListener('touchend', onEnd, { passive: true })
    area.addEventListener('touchcancel', onCancel, { passive: true })
    area.addEventListener('click', onClickCapture, true)

    return () => {
      area.removeEventListener('touchstart', onStart)
      area.removeEventListener('touchmove', onMove)
      area.removeEventListener('touchend', onEnd)
      area.removeEventListener('touchcancel', onCancel)
      area.removeEventListener('click', onClickCapture, true)
      clearTimeout(timer)
      clearTimeout(clickTimer)
    }
  }, [enabled])

  return { areaRef, contentRef }
}