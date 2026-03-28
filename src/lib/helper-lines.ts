/**
 * helper-lines.ts
 *
 * Computes smart alignment guide lines when dragging nodes.
 * Detects when a dragging node's edges or center align with
 * other nodes, returning snap positions and guide line coordinates.
 */

export interface HelperLinesResult {
  snapX?: number
  snapY?: number
  verticalLine: number | null   // x coordinate (flow space) for vertical guide
  horizontalLine: number | null // y coordinate (flow space) for horizontal guide
}

interface NodeRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

const SNAP_THRESHOLD = 5 // pixels in flow space

export function getHelperLines(
  dragging: NodeRect,
  others: NodeRect[]
): HelperLinesResult {
  const result: HelperLinesResult = {
    verticalLine: null,
    horizontalLine: null,
  }

  const dL = dragging.x
  const dR = dragging.x + dragging.width
  const dCX = dragging.x + dragging.width / 2
  const dT = dragging.y
  const dB = dragging.y + dragging.height
  const dCY = dragging.y + dragging.height / 2

  let closestX = SNAP_THRESHOLD
  let closestY = SNAP_THRESHOLD

  for (const n of others) {
    const nL = n.x
    const nR = n.x + n.width
    const nCX = n.x + n.width / 2
    const nT = n.y
    const nB = n.y + n.height
    const nCY = n.y + n.height / 2

    // Vertical alignment (X axis): left/center/right of dragging ↔ left/center/right of target
    const xChecks: [number, number][] = [
      [dL, nL], [dL, nCX], [dL, nR],
      [dCX, nL], [dCX, nCX], [dCX, nR],
      [dR, nL], [dR, nCX], [dR, nR],
    ]
    for (const [dv, nv] of xChecks) {
      const dist = Math.abs(dv - nv)
      if (dist < closestX) {
        closestX = dist
        result.verticalLine = nv
        result.snapX = dragging.x + (nv - dv)
      }
    }

    // Horizontal alignment (Y axis): top/center/bottom of dragging ↔ top/center/bottom of target
    const yChecks: [number, number][] = [
      [dT, nT], [dT, nCY], [dT, nB],
      [dCY, nT], [dCY, nCY], [dCY, nB],
      [dB, nT], [dB, nCY], [dB, nB],
    ]
    for (const [dv, nv] of yChecks) {
      const dist = Math.abs(dv - nv)
      if (dist < closestY) {
        closestY = dist
        result.horizontalLine = nv
        result.snapY = dragging.y + (nv - dv)
      }
    }
  }

  return result
}
