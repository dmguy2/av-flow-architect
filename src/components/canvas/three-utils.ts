import type { Node } from '@xyflow/react'
import type { AVNodeData } from '@/types/av'

const SCALE = 0.01

/**
 * Convert React Flow 2D position to Three.js 3D world coordinates.
 * Flow: origin top-left, y-down → Three: origin center, y-up.
 * y3d = 0 (ground plane), z3d inverted from flowY.
 */
export function flowToWorld(
  flowX: number,
  flowY: number,
  allNodes: Node<AVNodeData>[],
): [number, number, number] {
  const scalable = allNodes.filter((n) => n.type === 'signalFlow' || n.type === 'physicalLayout')
  if (scalable.length === 0) return [0, 0, 0]

  const cx = scalable.reduce((s, n) => s + n.position.x, 0) / scalable.length
  const cy = scalable.reduce((s, n) => s + n.position.y, 0) / scalable.length

  return [
    (flowX - cx) * SCALE,
    0,
    -(flowY - cy) * SCALE,
  ]
}

/**
 * Scale hint based on device role, for rough relative sizing.
 */
export function getScaleHint(deviceRole?: string): number {
  switch (deviceRole) {
    case 'source': return 0.5
    case 'processor': return 0.8
    case 'destination': return 1.0
    case 'infrastructure': return 0.6
    default: return 0.7
  }
}
