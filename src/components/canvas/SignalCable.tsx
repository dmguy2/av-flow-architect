import { useMemo } from 'react'
import { CatmullRomCurve3, Vector3 } from 'three'
import type { Edge, Node } from '@xyflow/react'
import type { AVEdgeData, AVNodeData } from '@/types/av'
import { getSignalColor } from '@/lib/signal-colors'
import { flowToWorld } from './three-utils'

interface SignalCableProps {
  edge: Edge<AVEdgeData>
  nodes: Node<AVNodeData>[]
}

export default function SignalCable({ edge, nodes }: SignalCableProps) {
  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)

  const { curve, color } = useMemo(() => {
    if (!sourceNode || !targetNode) return { curve: null, color: '#888' }

    const start = flowToWorld(sourceNode.position.x, sourceNode.position.y, nodes)
    const end = flowToWorld(targetNode.position.x, targetNode.position.y, nodes)

    const startV = new Vector3(...start)
    const endV = new Vector3(...end)
    const dist = startV.distanceTo(endV)

    // Scale droop with distance for natural-looking cables
    const droop = -Math.min(0.5, dist * 0.15)
    const mid: [number, number, number] = [
      (start[0] + end[0]) / 2,
      Math.min(start[1], end[1]) + droop,
      (start[2] + end[2]) / 2,
    ]

    return {
      curve: new CatmullRomCurve3([
        startV,
        new Vector3(...mid),
        endV,
      ]),
      color: getSignalColor(edge.data?.domain ?? 'audio'),
    }
  }, [sourceNode, targetNode, edge.data?.domain, nodes])

  if (!curve) return null

  return (
    <mesh>
      <tubeGeometry args={[curve, 32, 0.03, 8, false]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}
