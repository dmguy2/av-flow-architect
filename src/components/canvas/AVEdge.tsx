import { memo, useState, useRef, useEffect } from 'react'
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { AVEdgeData } from '@/types/av'
import { getSignalColor, getSignalDashPattern, SIGNAL_SHORT_LABELS } from '@/lib/signal-colors'
import { VARIANT_LABELS } from '@/lib/connector-variants'
import { useDiagramStore } from '@/store/diagram-store'

type AVEdgeType = Edge<AVEdgeData, 'avEdge'>

function AVEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<AVEdgeType>) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [labelText, setLabelText] = useState(data?.label ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData)
  const setSelectedEdge = useDiagramStore((s) => s.setSelectedEdge)
  const layerVisibility = useDiagramStore((s) => s.layerVisibility)
  const focusedLayer = useDiagramStore((s) => s.focusedLayer)
  const showEdgeLabels = useDiagramStore((s) => s.showEdgeLabels)
  const showProductImages = useDiagramStore((s) => s.showProductImages)
  const editingEdgeId = useDiagramStore((s) => s.editingEdgeId)
  const setEditingEdge = useDiagramStore((s) => s.setEditingEdge)

  const domain = data?.domain ?? 'audio'

  useEffect(() => {
    setLabelText(data?.label ?? '')
  }, [data?.label])

  // Enter edit mode when triggered from store (e.g., context menu "Rename Cable")
  useEffect(() => {
    if (editingEdgeId === id && !editing) {
      setEditing(true)
      setEditingEdge(null)
    }
  }, [editingEdgeId, id, editing, setEditingEdge])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // Hide edge when its layer is hidden
  if (!layerVisibility[domain]) {
    return null
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  })

  const color = getSignalColor(domain)
  const dashPattern = getSignalDashPattern(domain)

  // Dim to 20% when focus mode active and edge is unfocused
  const isFocusDimmed = focusedLayer !== null && focusedLayer !== domain
  const opacity = showProductImages ? 0.12 : isFocusDimmed ? 0.2 : 1

  const commitLabel = () => {
    setEditing(false)
    updateEdgeData(id, { label: labelText.trim() || undefined })
  }

  const connectorLabel = data?.variant && VARIANT_LABELS[data.variant]
    ? `${data.connector} ${VARIANT_LABELS[data.variant]}`
    : data?.connector
  const displayLabel = data?.label || connectorLabel
  const shortLabel = SIGNAL_SHORT_LABELS[domain]

  return (
    <g style={{ opacity, transition: 'opacity 0.2s ease' }}>
      {/* Glow effect when selected */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeOpacity={0.15}
          strokeLinecap="round"
        />
      )}
      {/* Invisible wider path for easier hover/click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setSelectedEdge(id)}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : hovered ? 2 : 1.5,
          strokeDasharray: dashPattern || undefined,
          filter: selected ? `drop-shadow(0 0 3px ${color}80)` : undefined,
          transition: 'stroke-width 0.1s ease',
        }}
      />
      {/* Persistent warning pill (always visible, not just on hover) */}
      {data?.warning && !showProductImages && (
        <foreignObject
          x={labelX - 10}
          y={labelY - 22}
          width={20}
          height={20}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex items-center justify-center h-full">
            <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
              <span className="text-[9px] font-bold text-white leading-none">!</span>
            </div>
          </div>
        </foreignObject>
      )}
      {/* Inline short label when showEdgeLabels is enabled — shows cable ID or domain abbreviation */}
      {showEdgeLabels && !editing && !showProductImages && (
        <foreignObject
          x={labelX - 24}
          y={labelY - 10}
          width={48}
          height={20}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex items-center justify-center h-full">
            <span
              className="px-1 py-0.5 rounded text-[8px] font-bold text-white uppercase whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {data?.label || shortLabel}
            </span>
          </div>
        </foreignObject>
      )}
      {editing ? (
        <foreignObject
          x={labelX - 50}
          y={labelY - 14}
          width={100}
          height={28}
          style={{ overflow: 'visible' }}
        >
          <input
            ref={inputRef}
            value={labelText}
            onChange={(e) => setLabelText(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel()
              if (e.key === 'Escape') {
                setLabelText(data?.label ?? '')
                setEditing(false)
              }
            }}
            placeholder="Cable #"
            className="w-full h-full text-center text-[10px] font-medium rounded border border-ring bg-background text-foreground px-1 outline-none"
            style={{ boxShadow: `0 0 0 2px ${color}40` }}
          />
        </foreignObject>
      ) : (
        (hovered || selected) && displayLabel && !showEdgeLabels && !showProductImages && (
          <foreignObject
            x={labelX - 40}
            y={labelY - 12}
            width={80}
            height={24}
            style={{ pointerEvents: 'none' }}
          >
            <div className="flex items-center justify-center h-full">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white uppercase truncate max-w-full"
                style={{ backgroundColor: color }}
              >
                {data?.label || data?.connector}
              </span>
            </div>
          </foreignObject>
        )
      )}
    </g>
  )
}

export default memo(AVEdge)
