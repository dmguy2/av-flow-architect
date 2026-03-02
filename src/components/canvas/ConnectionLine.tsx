import type { ConnectionLineComponentProps } from '@xyflow/react'
import { useDiagramStore } from '@/store/diagram-store'
import { getSignalColor } from '@/lib/signal-colors'
import { validateConnection } from '@/lib/connection-validation'
import type { AVPort, AVNodeData } from '@/types/av'
import type { Node } from '@xyflow/react'

export default function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromHandle,
  connectionStatus,
  toNode,
  toHandle,
}: ConnectionLineComponentProps) {
  const nodes = useDiagramStore((s) => s.nodes)

  const sourceNode = nodes.find((n) => n.id === fromHandle?.nodeId)
  const sourcePort = sourceNode?.data.ports.find(
    (p: AVPort) => p.id === fromHandle?.id
  )
  const domainColor = sourcePort ? getSignalColor(sourcePort.domain) : '#888'

  // Determine line color based on validation
  let color = domainColor
  let isBlocked = false
  let isWarned = false

  if (connectionStatus === 'invalid') {
    color = '#EF4444' // red
    isBlocked = true
  } else if (connectionStatus === 'valid' && toNode && toHandle && sourcePort) {
    // connectionStatus is 'valid' (not blocked), but check for warn tier
    const targetNodeData = (toNode as unknown as Node<AVNodeData>).data
    const targetPort = targetNodeData?.ports?.find(
      (p: AVPort) => p.id === toHandle.id
    )
    if (targetPort) {
      const result = validateConnection(sourcePort, targetPort)
      if (result.tier === 'warn') {
        color = '#F59E0B' // amber
        isWarned = true
      }
    }
  }

  return (
    <g>
      <path
        d={`M${fromX},${fromY} C${fromX + 50},${fromY} ${toX - 50},${toY} ${toX},${toY}`}
        fill="none"
        stroke={color}
        strokeWidth={isBlocked || isWarned ? 3 : 2}
        strokeDasharray={isBlocked ? '6 4' : '8 4'}
        strokeOpacity={0.7}
      />
      <circle
        cx={toX}
        cy={toY}
        r={isBlocked ? 6 : 4}
        fill={color}
        fillOpacity={isBlocked ? 0.8 : 0.5}
      />
      {isBlocked && (
        <>
          {/* X indicator for blocked connections */}
          <line
            x1={toX - 3}
            y1={toY - 3}
            x2={toX + 3}
            y2={toY + 3}
            stroke="white"
            strokeWidth={1.5}
          />
          <line
            x1={toX + 3}
            y1={toY - 3}
            x2={toX - 3}
            y2={toY + 3}
            stroke="white"
            strokeWidth={1.5}
          />
        </>
      )}
      {isWarned && (
        <>
          {/* ! indicator for warned connections */}
          <text
            x={toX}
            y={toY + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={8}
            fontWeight="bold"
          >
            !
          </text>
        </>
      )}
    </g>
  )
}
