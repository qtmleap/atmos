// Measures an element's content box with ResizeObserver, so a chart can draw
// in real pixels instead of stretching a fixed viewBox
// (components/project/compare-chart.tsx). 0x0 until the ref attaches and the
// observer reports its first entry; lib/chart-geometry.ts `plotBox` falls
// back to a default box for that gap.
import { type RefCallback, useCallback, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

export function useElementSize<T extends Element>(): [RefCallback<T>, ElementSize] {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })
  const ref = useCallback((node: T | null) => {
    if (node === null || typeof ResizeObserver === 'undefined') {
      return
    }
    const rect = node.getBoundingClientRect()
    setSize({ width: rect.width, height: rect.height })
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box !== undefined) {
        setSize({ width: box.width, height: box.height })
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}
