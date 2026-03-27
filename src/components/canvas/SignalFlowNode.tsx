import { memo, useEffect, useMemo, useState, useRef } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps, type Node } from '@xyflow/react'
import type { AVNodeData, AVPort } from '@/types/av'
import { getSignalColor } from '@/lib/signal-colors'
import { CONFERENCE_ROLE_SHORT, CONFERENCE_ROLE_COLORS } from '@/lib/conference-roles'
import { getIcon } from '@/lib/icons'
import { getComponentDef } from '@/data/component-definitions'
import { cn } from '@/lib/utils'
import { useDiagramStore } from '@/store/diagram-store'

import type { ConnectorType } from '@/types/av'

const CONNECTOR_SHORT: Record<ConnectorType, string> = {
  xlr: 'XLR', trs: 'TRS', rca: 'RCA', hdmi: 'HDMI', sdi: 'SDI',
  ethernet: 'ETH', dante: 'DTE', usb: 'USB', speakon: 'SPK',
  powercon: 'PWR', dmx: 'DMX', fiber: 'FBR', aes50: 'AES', ndi: 'NDI',
  wifi: 'WiFi', thunderbolt: 'TB', db9: 'DB9', bnc: 'BNC',
  displayport: 'DP', sd: 'SD',
}

type SignalFlowNodeType = Node<AVNodeData, 'signalFlow'>

function SignalFlowNode({ data, selected, id }: NodeProps<SignalFlowNodeType>) {
  const updateNodeInternals = useUpdateNodeInternals()
  const def = getComponentDef(data.componentType)
  const Icon = getIcon(def?.icon ?? 'BoxSelect')
  const layerVisibility = useDiagramStore((s) => s.layerVisibility)
  const focusedLayer = useDiagramStore((s) => s.focusedLayer)
  const chainIssues = useDiagramStore((s) => s.chainIssues)
  const showProductImages = useDiagramStore((s) => s.showProductImages)
  const updateNodeData = useDiagramStore((s) => s.updateNodeData)

  // Connected port detection — only re-renders when THIS node's connections change
  const connectedPortsKey = useDiagramStore((s) => {
    const ids: string[] = []
    for (const e of s.edges) {
      if (e.source === id && e.sourceHandle) ids.push(e.sourceHandle.replace(/-(?:target|source)$/, ''))
      if (e.target === id && e.targetHandle) ids.push(e.targetHandle.replace(/-(?:target|source)$/, ''))
    }
    return ids.sort().join(',')
  })
  const connectedPorts = useMemo(() => new Set(connectedPortsKey.split(',').filter(Boolean)), [connectedPortsKey])

  // Inline label editing
  const [editing, setEditing] = useState(false)
  const [labelText, setLabelText] = useState(data.label)
  const labelInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLabelText(data.label) }, [data.label])
  useEffect(() => {
    if (editing && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [editing])

  const commitLabel = () => {
    setEditing(false)
    if (labelText.trim() && labelText !== data.label) {
      updateNodeData(id, { label: labelText.trim() })
    } else {
      setLabelText(data.label)
    }
  }

  // Resolve image: prefer node data.image, then node data.images array, then component definition
  const resolvedImage = data.image || (data.images as string[] | undefined)?.[0] || def?.images?.[0]

  // Re-measure handle positions after mount (and when presentation mode toggles) to ensure edges align
  useEffect(() => {
    const timer = setTimeout(() => updateNodeInternals(id), 250)
    return () => clearTimeout(timer)
  }, [id, updateNodeInternals, showProductImages])

  // Check if this node has any signal chain issues
  const nodeIssues = chainIssues.filter((issue) => issue.affectedNodes.includes(id))
  const worstSeverity = nodeIssues.some((i) => i.severity === 'error')
    ? 'error'
    : nodeIssues.some((i) => i.severity === 'warning')
      ? 'warning'
      : nodeIssues.length > 0
        ? 'info'
        : null

  const enabledPorts = data.ports.filter((p: AVPort) => p.enabled !== false)
  const inputPorts = enabledPorts.filter((p: AVPort) => p.direction === 'input')
  const outputPorts = enabledPorts.filter((p: AVPort) => p.direction === 'output')
  const bidiPorts = enabledPorts.filter((p: AVPort) => p.direction === 'bidirectional')
  const undefinedPorts = enabledPorts.filter((p: AVPort) => p.direction === 'undefined')

  // Determine if node should be dimmed
  const allPortDomains = data.ports.map((p: AVPort) => p.domain)
  const allPortsHidden = allPortDomains.length > 0 && allPortDomains.every((d) => !layerVisibility[d])
  const noPortMatchesFocus = focusedLayer !== null && allPortDomains.length > 0 && !allPortDomains.includes(focusedLayer)
  const isDimmed = allPortsHidden || noPortMatchesFocus

  // Domain-colored selection glow
  const primaryDomain = useMemo(() => {
    const domains = enabledPorts.map((p: AVPort) => p.domain)
    // Most common domain for the glow color
    const counts: Record<string, number> = {}
    for (const d of domains) counts[d] = (counts[d] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'audio'
  }, [enabledPorts])
  const glowColor = getSignalColor(primaryDomain as AVPort['domain'])

  // ── Presentation mode: clean product image card ──
  if (showProductImages) {
    const allHandles = [
      ...inputPorts.map((p: AVPort) => ({ id: p.id, type: 'target' as const, position: Position.Left })),
      ...outputPorts.map((p: AVPort) => ({ id: p.id, type: 'source' as const, position: Position.Right })),
      ...bidiPorts.flatMap((p: AVPort) => [
        { id: `${p.id}-target`, type: 'target' as const, position: Position.Left },
        { id: `${p.id}-source`, type: 'source' as const, position: Position.Left },
      ]),
      ...undefinedPorts.flatMap((p: AVPort) => [
        { id: `${p.id}-target`, type: 'target' as const, position: Position.Left },
        { id: `${p.id}-source`, type: 'source' as const, position: Position.Left },
      ]),
    ]
    const handleStyle = {
      opacity: 0,
      width: 1,
      height: 1,
      border: 'none',
      background: 'transparent',
    }

    return (
      <div
        className="bg-card border rounded-lg overflow-hidden"
        style={{
          width: 180,
          opacity: isDimmed ? 0.15 : 1,
          pointerEvents: isDimmed ? 'none' : undefined,
          boxShadow: selected
            ? `0 0 0 2px ${glowColor}40, 0 0 20px ${glowColor}15, 0 4px 12px rgba(0,0,0,0.3)`
            : '0 2px 8px rgba(0,0,0,0.15)',
          borderColor: selected ? 'transparent' : undefined,
        }}
      >
        {/* Product image or icon fallback */}
        <div className="aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
          {resolvedImage ? (
            <img src={resolvedImage} alt={data.label} className="w-full h-full object-contain" />
          ) : (
            <Icon className="w-12 h-12 text-muted-foreground/40" />
          )}
        </div>
        {/* Label */}
        <div className="px-2.5 py-1.5 border-t border-border/60">
          {editing ? (
            <input
              ref={labelInputRef}
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') { setLabelText(data.label); setEditing(false) }
                e.stopPropagation()
              }}
              className="text-[11px] font-semibold leading-tight w-full bg-transparent outline-none border-none p-0 text-foreground"
            />
          ) : (
            <div
              className="text-[11px] font-semibold truncate leading-tight cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
            >
              {data.label}
            </div>
          )}
          {(data.manufacturer || data.model) && (
            <div className="text-[9px] text-muted-foreground truncate leading-tight mt-0.5">
              {data.manufacturer && data.model
                ? `${data.manufacturer} ${data.model}`
                : data.model ?? data.manufacturer}
            </div>
          )}
        </div>
        {/* Invisible handles for edge routing */}
        {allHandles.map((h, idx) => (
          <Handle
            key={h.id}
            type={h.type}
            position={h.position}
            id={h.id}
            style={{
              ...handleStyle,
              top: `${((idx + 1) / (allHandles.length + 1)) * 100}%`,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative bg-card border rounded-lg min-w-[168px] transition-all duration-150',
        selected
          ? 'border-transparent'
          : 'border-border hover:border-muted-foreground/30',
        worstSeverity === 'error' && 'animate-issue-pulse'
      )}
      style={{
        opacity: isDimmed ? 0.15 : 1,
        pointerEvents: isDimmed ? 'none' : undefined,
        transition: 'opacity 0.2s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        boxShadow: selected
          ? `0 0 0 2px ${glowColor}40, 0 0 20px ${glowColor}15, 0 4px 12px rgba(0,0,0,0.3)`
          : '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {/* Issue badge */}
      {worstSeverity && (
        <div
          className={cn(
            'absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white z-10 shadow-lg',
            worstSeverity === 'error' && 'bg-red-500',
            worstSeverity === 'warning' && 'bg-amber-500',
            worstSeverity === 'info' && 'bg-blue-500'
          )}
          title={nodeIssues.map((i) => i.message).join('\n')}
        >
          {nodeIssues.length}
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border/60 rounded-t-lg"
        style={{
          background: selected
            ? `linear-gradient(135deg, ${glowColor}12 0%, transparent 60%)`
            : undefined,
        }}
      >
        <div
          className="flex items-center justify-center w-6 h-6 rounded shrink-0"
          style={{
            backgroundColor: glowColor + '18',
            color: glowColor,
          }}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={labelInputRef}
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') { setLabelText(data.label); setEditing(false) }
                e.stopPropagation()
              }}
              className="text-[11px] font-semibold leading-tight w-full bg-transparent outline-none border-none p-0 text-foreground"
            />
          ) : (
            <div
              className="text-[11px] font-semibold truncate leading-tight cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
            >
              {data.label}
            </div>
          )}
          {(data.manufacturer || data.model) && (
            <div className="text-[9px] text-muted-foreground truncate leading-tight mt-0.5">
              {data.manufacturer && data.model
                ? `${data.manufacturer} ${data.model}`
                : data.model ?? data.manufacturer}
            </div>
          )}
        </div>
      </div>

      {/* Ports */}
      <div className="relative py-[6px]">
        {/* Label rows in flow layout — these drive node width so labels never overlap */}
        {Array.from({ length: Math.max(inputPorts.length, outputPorts.length) }).map((_, idx) => {
          const inp = inputPorts[idx]
          const out = outputPorts[idx]
          return (
            <div key={idx} className="flex items-center h-6 pl-3 pr-3">
              {inp && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  {inp.label}
                  <span className="text-[7px] text-muted-foreground/40 font-medium">{CONNECTOR_SHORT[inp.connector]}</span>
                  {inp.conferenceRole && (
                    <span
                      className="text-[7px] font-bold px-1 py-0.5 rounded leading-none"
                      style={{
                        backgroundColor: CONFERENCE_ROLE_COLORS[inp.conferenceRole] + '25',
                        color: CONFERENCE_ROLE_COLORS[inp.conferenceRole],
                      }}
                    >
                      {CONFERENCE_ROLE_SHORT[inp.conferenceRole]}
                    </span>
                  )}
                </span>
              )}
              <span className="flex-1 min-w-3" />
              {out && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap text-right flex items-center justify-end gap-1">
                  {out.conferenceRole && (
                    <span
                      className="text-[7px] font-bold px-1 py-0.5 rounded leading-none"
                      style={{
                        backgroundColor: CONFERENCE_ROLE_COLORS[out.conferenceRole] + '25',
                        color: CONFERENCE_ROLE_COLORS[out.conferenceRole],
                      }}
                    >
                      {CONFERENCE_ROLE_SHORT[out.conferenceRole]}
                    </span>
                  )}
                  {out.label}
                  <span className="text-[7px] text-muted-foreground/40 font-medium">{CONNECTOR_SHORT[out.connector]}</span>
                </span>
              )}
            </div>
          )
        })}
        {bidiPorts.map((port: AVPort) => (
          <div key={port.id} className="flex items-center h-6 pl-3 pr-3">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
              ↔ {port.label}
              <span className="text-[7px] text-muted-foreground/40 font-medium">{CONNECTOR_SHORT[port.connector]}</span>
              {port.conferenceRole && (
                <span
                  className="text-[7px] font-bold px-1 py-0.5 rounded leading-none"
                  style={{
                    backgroundColor: CONFERENCE_ROLE_COLORS[port.conferenceRole] + '25',
                    color: CONFERENCE_ROLE_COLORS[port.conferenceRole],
                  }}
                >
                  {CONFERENCE_ROLE_SHORT[port.conferenceRole]}
                </span>
              )}
            </span>
          </div>
        ))}
        {undefinedPorts.map((port: AVPort) => (
          <div key={port.id} className="flex items-center h-6 pl-3 pr-3">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap italic flex items-center gap-1">
              ? {port.label}
              <span className="text-[7px] text-muted-foreground/40 font-medium not-italic">{CONNECTOR_SHORT[port.connector]}</span>
              {port.conferenceRole && (
                <span
                  className="text-[7px] font-bold px-1 py-0.5 rounded leading-none not-italic"
                  style={{
                    backgroundColor: CONFERENCE_ROLE_COLORS[port.conferenceRole] + '25',
                    color: CONFERENCE_ROLE_COLORS[port.conferenceRole],
                  }}
                >
                  {CONFERENCE_ROLE_SHORT[port.conferenceRole]}
                </span>
              )}
            </span>
          </div>
        ))}

        {/* Handles — absolutely positioned to match row centers */}
        {inputPorts.map((port: AVPort, idx: number) => {
          const color = getSignalColor(port.domain)
          const isConnected = connectedPorts.has(port.id)
          return (
            <Handle
              key={port.id}
              type="target"
              position={Position.Left}
              id={port.id}
              style={{
                top: 6 + 12 + idx * 24,
                background: isConnected ? color : `${color}30`,
                width: 9,
                height: 9,
                border: isConnected ? '2px solid var(--color-card)' : `2px solid ${color}`,
                boxShadow: isConnected ? `0 0 4px ${color}50` : 'none',
              }}
            />
          )
        })}
        {outputPorts.map((port: AVPort, idx: number) => {
          const color = getSignalColor(port.domain)
          const isConnected = connectedPorts.has(port.id)
          return (
            <Handle
              key={port.id}
              type="source"
              position={Position.Right}
              id={port.id}
              style={{
                top: 6 + 12 + idx * 24,
                background: isConnected ? color : `${color}30`,
                width: 9,
                height: 9,
                border: isConnected ? '2px solid var(--color-card)' : `2px solid ${color}`,
                boxShadow: isConnected ? `0 0 4px ${color}50` : 'none',
              }}
            />
          )
        })}
        {bidiPorts.map((port: AVPort, idx: number) => {
          const topOffset = 6 + 12 + (Math.max(inputPorts.length, outputPorts.length) + idx) * 24
          const color = getSignalColor(port.domain)
          const isConnected = connectedPorts.has(port.id)
          return (
            <span key={port.id}>
              <Handle
                type="target"
                position={Position.Left}
                id={`${port.id}-target`}
                style={{
                  top: topOffset,
                  background: isConnected ? color : `${color}30`,
                  width: 9,
                  height: 9,
                  border: isConnected ? '2px solid var(--color-card)' : `2px solid ${color}`,
                  boxShadow: isConnected ? `0 0 4px ${color}50` : 'none',
                }}
              />
              <Handle
                type="source"
                position={Position.Left}
                id={`${port.id}-source`}
                isConnectableEnd
                style={{
                  top: topOffset,
                  background: isConnected ? color : `${color}30`,
                  width: 9,
                  height: 9,
                  border: isConnected ? '2px solid var(--color-card)' : `2px solid ${color}`,
                  boxShadow: isConnected ? `0 0 4px ${color}50` : 'none',
                  zIndex: 1,
                }}
              />
            </span>
          )
        })}
        {undefinedPorts.map((port: AVPort, idx: number) => {
          const topOffset = 6 + 12 + (Math.max(inputPorts.length, outputPorts.length) + bidiPorts.length + idx) * 24
          const isConnected = connectedPorts.has(port.id)
          return (
            <span key={port.id}>
              <Handle
                type="target"
                position={Position.Left}
                id={`${port.id}-target`}
                style={{
                  top: topOffset,
                  background: isConnected ? '#6B7280' : '#6B728030',
                  width: 9,
                  height: 9,
                  border: isConnected ? '2px dashed var(--color-card)' : '2px dashed #6B7280',
                  boxShadow: isConnected ? '0 0 4px #6B728050' : 'none',
                }}
              />
              <Handle
                type="source"
                position={Position.Left}
                id={`${port.id}-source`}
                isConnectableEnd
                style={{
                  top: topOffset,
                  background: isConnected ? '#6B7280' : '#6B728030',
                  width: 9,
                  height: 9,
                  border: isConnected ? '2px dashed var(--color-card)' : '2px dashed #6B7280',
                  boxShadow: isConnected ? '0 0 4px #6B728050' : 'none',
                  zIndex: 1,
                }}
              />
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default memo(SignalFlowNode)
