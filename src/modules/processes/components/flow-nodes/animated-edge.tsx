import { memo, useMemo } from 'react'
import { getSmoothStepPath, type EdgeProps } from '@xyflow/react'

/**
 * Take a smooth SVG path and add subtle hand-drawn jitter.
 * We parse the path commands and offset each coordinate slightly.
 */
function wobblyPath(path: string, seed: number): string {
  let i = 0
  return path.replace(/-?\d+(\.\d+)?/g, (match) => {
    const val = parseFloat(match)
    // Deterministic jitter based on seed + index
    const jitter = Math.sin(seed * 127.1 + i * 311.7) * 1.2
    i++
    return (val + jitter).toFixed(2)
  })
}

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [basePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 20,
  })

  // Stable seed from the edge id
  const seed = useMemo(() => {
    let h = 0
    for (let c = 0; c < id.length; c++) {
      h = (h * 31 + id.charCodeAt(c)) | 0
    }
    return h
  }, [id])

  const handDrawnPath = useMemo(() => wobblyPath(basePath, seed), [basePath, seed])

  return (
    <>
      {/* Main hand-drawn stroke */}
      <path
        d={handDrawnPath}
        fill="none"
        stroke="hsl(var(--foreground) / 0.35)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#sketchy-filter)"
      />

      {/* Subtle second stroke offset for pencil doubling effect */}
      <path
        d={basePath}
        fill="none"
        stroke="hsl(var(--foreground) / 0.08)"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Small animated arrowhead dot flowing along the path */}
      <circle r="2.5" fill="hsl(var(--foreground) / 0.4)">
        <animateMotion dur="3.5s" repeatCount="indefinite" path={basePath} />
      </circle>
    </>
  )
}

export const AnimatedEdge = memo(AnimatedEdgeComponent)
