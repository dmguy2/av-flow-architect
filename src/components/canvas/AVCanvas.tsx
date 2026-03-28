import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  useViewport,
  type NodeTypes,
  type EdgeTypes,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import SignalFlowNode from './SignalFlowNode'
import PhysicalLayoutNode from './PhysicalLayoutNode'
import GroupNode from './GroupNode'
import OffsheetConnectorNode from './OffsheetConnectorNode'
import AVEdge from './AVEdge'
import ConnectionLine from './ConnectionLine'
import { useDiagramStore } from '@/store/diagram-store'
import { getComponentDef } from '@/data/component-definitions'
import { generateId } from '@/lib/utils'
import { SIGNAL_Z_ORDER, SIGNAL_COLORS, SIGNAL_LABELS } from '@/lib/signal-colors'
import type { SignalDomain } from '@/types/av'
import { validateConnection } from '@/lib/connection-validation'
import type { AVNodeData, AVEdgeData, AVPort } from '@/types/av'
import type { Node, Edge, IsValidConnection, NodeChange, EdgeChange } from '@xyflow/react'
import { log } from '@/lib/logger'
import { getHelperLines } from '@/lib/helper-lines'
import { Copy, Trash2, CopyPlus, Group, ClipboardPaste, MousePointerSquareDashed, Maximize, AlertTriangle, AlignCenterHorizontal, AlignCenterVertical, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Tag } from 'lucide-react'

// ── Error boundary for node rendering resilience ──

class NodeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state: { hasError: boolean; error?: Error } = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-destructive/10 border-2 border-destructive/30 border-dashed rounded-lg p-3 min-w-[130px] text-center">
          <AlertTriangle className="w-4 h-4 text-destructive mx-auto mb-1" />
          <div className="text-[10px] font-medium text-destructive">Render Error</div>
          <div className="text-[8px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
            {this.state.error?.message ?? 'Unknown error'}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function withNodeErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <NodeErrorBoundary>
      <Component {...props} />
    </NodeErrorBoundary>
  )
  Wrapped.displayName = `Safe(${Component.displayName || Component.name || 'Node'})`
  return Wrapped
}

const nodeTypes: NodeTypes = {
  signalFlow: withNodeErrorBoundary(SignalFlowNode),
  physicalLayout: withNodeErrorBoundary(PhysicalLayoutNode),
  group: withNodeErrorBoundary(GroupNode),
  offsheetConnector: withNodeErrorBoundary(OffsheetConnectorNode),
}

const edgeTypes: EdgeTypes = {
  avEdge: AVEdge,
}

type ContextMenu =
  | { type: 'node'; x: number; y: number; nodeId: string }
  | { type: 'edge'; x: number; y: number; edgeId: string }
  | { type: 'pane'; x: number; y: number }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const modKey = isMac ? '⌘' : 'Ctrl+'

// ── Minimap node colors by device role ──

const ROLE_FILL: Record<string, string> = {
  source: 'rgba(96, 165, 250, 0.55)',       // blue-400
  processor: 'rgba(245, 158, 11, 0.55)',     // amber-500
  destination: 'rgba(52, 211, 153, 0.55)',   // emerald-400
  infrastructure: 'rgba(156, 163, 175, 0.4)', // gray-400
}
const ROLE_STROKE: Record<string, string> = {
  source: 'rgba(96, 165, 250, 0.8)',
  processor: 'rgba(245, 158, 11, 0.8)',
  destination: 'rgba(52, 211, 153, 0.8)',
  infrastructure: 'rgba(156, 163, 175, 0.7)',
}

function minimapNodeColor(node: Node<AVNodeData>): string {
  if (node.type === 'group') return 'rgba(255, 255, 255, 0.04)'
  return ROLE_FILL[node.data.deviceRole ?? ''] ?? 'rgba(255, 255, 255, 0.2)'
}
function minimapStrokeColor(node: Node<AVNodeData>): string {
  if (node.type === 'group') return 'rgba(255, 255, 255, 0.08)'
  return ROLE_STROKE[node.data.deviceRole ?? ''] ?? 'rgba(255, 255, 255, 0.3)'
}

// ── Alignment snap guide lines (rendered inside ReactFlow) ──

function HelperLines({ horizontal, vertical }: { horizontal: number | null; vertical: number | null }) {
  const { x: panX, y: panY, zoom } = useViewport()
  if (horizontal == null && vertical == null) return null
  return (
    <svg style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, pointerEvents: 'none', zIndex: 4 }}>
      {vertical != null && (
        <line
          x1={vertical * zoom + panX} y1={0}
          x2={vertical * zoom + panX} y2="100%"
          stroke="#0ea5e9" strokeWidth={1} strokeDasharray="4 2" opacity={0.7}
        />
      )}
      {horizontal != null && (
        <line
          x1={0} y1={horizontal * zoom + panY}
          x2="100%" y2={horizontal * zoom + panY}
          stroke="#0ea5e9" strokeWidth={1} strokeDasharray="4 2" opacity={0.7}
        />
      )}
    </svg>
  )
}

// ── Zoom percentage indicator ──

function ZoomIndicator() {
  const { zoom } = useViewport()
  const { zoomTo } = useReactFlow()
  const pct = Math.round(zoom * 100)
  return (
    <Panel position="bottom-left" className="!mb-[52px] !ml-1.5">
      <button
        onClick={() => zoomTo(1, { duration: 200 })}
        className="px-1.5 py-0.5 rounded bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm text-[10px] text-muted-foreground tabular-nums hover:text-foreground transition-colors"
        title="Click to reset to 100%"
      >
        {pct}%
      </button>
    </Panel>
  )
}

export default function AVCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { fitView, setCenter } = useReactFlow()
  const {
    nodes,
    edges,
    mode,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    setSelectedEdge,
    deleteSelected,
  } = useDiagramStore()
  const showProductImages = useDiagramStore((s) => s.showProductImages)
  const duplicateSelected = useDiagramStore((s) => s.duplicateSelected)
  const copySelected = useDiagramStore((s) => s.copySelected)
  const pasteClipboard = useDiagramStore((s) => s.pasteClipboard)
  const selectAll = useDiagramStore((s) => s.selectAll)
  const groupSelectedNodes = useDiagramStore((s) => s.groupSelectedNodes)
  const alignNodes = useDiagramStore((s) => s.alignNodes)
  const distributeNodes = useDiagramStore((s) => s.distributeNodes)
  const setEditingEdge = useDiagramStore((s) => s.setEditingEdge)
  const clipboard = useDiagramStore((s) => s.clipboard)

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [helperLines, setHelperLines] = useState<{ horizontal: number | null; vertical: number | null }>({ horizontal: null, vertical: null })
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const focusNodeId = useDiagramStore((s) => s.focusNodeId)

  // Zoom to node when focusNodeId is set (e.g., clicking issue in Signal Chain Panel)
  useEffect(() => {
    if (!focusNodeId) return
    const node = nodes.find((n) => n.id === focusNodeId)
    if (node) {
      const x = node.position.x + (node.measured?.width ?? 160) / 2
      const y = node.position.y + (node.measured?.height ?? 80) / 2
      setCenter(x, y, { zoom: 1.2, duration: 400 })
    }
    useDiagramStore.setState({ focusNodeId: null })
  }, [focusNodeId, nodes, setCenter])

  // Zoom to fit when triggered by keyboard shortcut (Ctrl+1)
  useEffect(() => {
    const handler = () => fitView({ padding: 0.15, duration: 300 })
    window.addEventListener('av-fit-view', handler)
    return () => window.removeEventListener('av-fit-view', handler)
  }, [fitView])

  // Fit viewport after toggling between image/module view
  const prevShowImages = useRef(showProductImages)
  useEffect(() => {
    if (prevShowImages.current !== showProductImages) {
      prevShowImages.current = showProductImages
      // Allow nodes to re-render with new dimensions before fitting
      const timer = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 350)
      return () => clearTimeout(timer)
    }
  }, [showProductImages, fitView])

  // Wrap onNodesChange to detect selection + compute alignment snap guides
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<AVNodeData>>[]) => {
      let modifiedChanges = changes
      let newHLine: number | null = null
      let newVLine: number | null = null

      // Detect single-node drag for alignment snap
      let dragId: string | null = null
      let dragPos: { x: number; y: number } | null = null
      let multiDrag = false
      for (const c of changes) {
        if (c.type === 'position' && c.dragging && c.position) {
          if (dragId) { multiDrag = true; break }
          dragId = c.id
          dragPos = c.position
        }
      }

      if (dragId && dragPos && !multiDrag) {
        const currentNodes = nodesRef.current
        const dragNode = currentNodes.find((n) => n.id === dragId)
        if (dragNode) {
          const others = currentNodes.filter(
            (n) => n.id !== dragId && !n.selected && n.type !== 'group'
          )
          const result = getHelperLines(
            { id: dragId, x: dragPos.x, y: dragPos.y, width: dragNode.measured?.width ?? 160, height: dragNode.measured?.height ?? 80 },
            others.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, width: n.measured?.width ?? 160, height: n.measured?.height ?? 80 }))
          )
          newHLine = result.horizontalLine
          newVLine = result.verticalLine
          if (result.snapX != null || result.snapY != null) {
            const sx = result.snapX ?? dragPos.x
            const sy = result.snapY ?? dragPos.y
            modifiedChanges = changes.map((c) =>
              c.type === 'position' && c.id === dragId ? { ...c, position: { x: sx, y: sy } } : c
            )
          }
        }
      }

      // Clear on drag end
      if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
        newHLine = null
        newVLine = null
      }

      setHelperLines((prev) =>
        prev.horizontal === newHLine && prev.vertical === newVLine ? prev : { horizontal: newHLine, vertical: newVLine }
      )

      onNodesChange(modifiedChanges)

      // Handle selection changes
      const selectionChange = changes.find(
        (c) => c.type === 'select'
      ) as (NodeChange & { type: 'select'; id: string; selected: boolean }) | undefined
      if (selectionChange) {
        if (selectionChange.selected) {
          setSelectedNode(selectionChange.id)
        } else {
          const otherSelected = changes.find(
            (c) => c.type === 'select' && 'selected' in c && c.selected && c.id !== selectionChange.id
          )
          if (!otherSelected) {
            setSelectedNode(null)
          }
        }
      }
    },
    [onNodesChange, setSelectedNode]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge<AVEdgeData>>[]) => {
      onEdgesChange(changes)
      const selectionChange = changes.find(
        (c) => c.type === 'select'
      ) as (EdgeChange & { type: 'select'; id: string; selected: boolean }) | undefined
      if (selectionChange) {
        if (selectionChange.selected) {
          setSelectedEdge(selectionChange.id)
        } else {
          setSelectedEdge(null)
        }
      }
    },
    [onEdgesChange, setSelectedEdge]
  )

  // Sort edges by z-order: power at bottom, av-over-ip on top
  const sortedEdges = useMemo(() => {
    return [...edges].sort((a, b) => {
      const zA = SIGNAL_Z_ORDER[a.data?.domain ?? 'audio'] ?? 2
      const zB = SIGNAL_Z_ORDER[b.data?.domain ?? 'audio'] ?? 2
      return zA - zB
    })
  }, [edges])

  // Signal domains in use (for legend)
  const usedDomains = useMemo(() => {
    const set = new Set<SignalDomain>()
    for (const e of edges) if (e.data?.domain) set.add(e.data.domain)
    return Array.from(set)
  }, [edges])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const componentType = event.dataTransfer.getData('application/av-component')
      if (!componentType) return

      const def = getComponentDef(componentType)
      if (!def) return

      const wrapperBounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!wrapperBounds) return

      // Get the React Flow instance viewport from the wrapper
      const rfElement = reactFlowWrapper.current?.querySelector('.react-flow__viewport')
      if (!rfElement) return

      const transform = window.getComputedStyle(rfElement).transform
      const matrix = new DOMMatrix(transform)

      const position = {
        x: (event.clientX - wrapperBounds.left - matrix.e) / matrix.a,
        y: (event.clientY - wrapperBounds.top - matrix.f) / matrix.d,
      }

      const nodeType = def.type === 'offsheet-connector'
        ? 'offsheetConnector'
        : mode === 'signal-flow' ? 'signalFlow' : 'physicalLayout'

      const isGenericInstance = !def.manufacturer
      const newNode: Node<AVNodeData> = {
        id: generateId(),
        type: nodeType,
        position,
        data: {
          componentType: def.type,
          label: def.label,
          ports: def.defaultPorts.map((p: AVPort) => ({ ...p, enabled: p.enabled ?? true })),
          ...(def.manufacturer && { manufacturer: def.manufacturer }),
          ...(def.model && { model: def.model }),
          isGenericInstance,
          ...(def.configurableIO && { configurableIO: true }),
          ...(def.powerDraw && { powerDraw: def.powerDraw }),
          ...(def.deviceRole && { deviceRole: def.deviceRole }),
          ...(def.images?.[0] && { image: def.images[0] }),
          ...(def.images && { images: def.images }),
          ...(def.specs && { specs: def.specs }),
          ...(def.bhUrl && { bhUrl: def.bhUrl }),
          ...(def.dimensions && { dimensions: def.dimensions }),
        },
      }

      log('CANVAS', `Dropped component: "${def.label}"`, def.type)
      addNode(newNode)

      // Track recently used component types in localStorage
      try {
        const key = 'av-recent-components'
        const recent: string[] = JSON.parse(localStorage.getItem(key) || '[]')
        const updated = [componentType, ...recent.filter((t) => t !== componentType)].slice(0, 8)
        localStorage.setItem(key, JSON.stringify(updated))
        window.dispatchEvent(new Event('av-recent-changed'))
      } catch { /* ignore localStorage errors */ }
    },
    [addNode, mode]
  )

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectedNodes.length === 1) {
        setSelectedNode(selectedNodes[0].id)
      } else {
        setSelectedNode(null)
      }
      if (selectedEdges.length === 1 && selectedNodes.length === 0) {
        setSelectedEdge(selectedEdges[0].id)
      } else {
        setSelectedEdge(null)
      }
    },
    [setSelectedNode, setSelectedEdge]
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode]
  )

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { id: string }) => {
      setSelectedEdge(edge.id)
    },
    [setSelectedEdge]
  )

  const onPaneClick = useCallback(() => {
    log('CANVAS', 'Deselected all (pane click)', undefined, 'debug')
    setSelectedNode(null)
    setSelectedEdge(null)
    setContextMenu(null)
  }, [setSelectedNode, setSelectedEdge])

  // ── Context menu handlers ──

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setSelectedNode(node.id)
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return
      setContextMenu({
        type: 'node',
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        nodeId: node.id,
      })
    },
    [setSelectedNode]
  )

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      setSelectedEdge(edge.id)
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return
      setContextMenu({
        type: 'edge',
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        edgeId: edge.id,
      })
    },
    [setSelectedEdge]
  )

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return
      setContextMenu({
        type: 'pane',
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
    },
    []
  )

  const closeMenu = useCallback(() => setContextMenu(null), [])

  const selectedNodeCount = nodes.filter((n) => n.selected).length

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelected()
      }
    },
    [deleteSelected]
  )

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)
      const sourcePortId = connection.sourceHandle?.replace(/-(?:target|source)$/, '') ?? connection.sourceHandle
      const targetPortId = connection.targetHandle?.replace(/-(?:target|source)$/, '') ?? connection.targetHandle
      const sourcePort = sourceNode?.data.ports.find(
        (p: AVPort) => p.id === sourcePortId
      )
      const targetPort = targetNode?.data.ports.find(
        (p: AVPort) => p.id === targetPortId
      )
      if (!sourcePort || !targetPort) return true
      const result = validateConnection(sourcePort, targetPort)
      if (result.tier === 'block') {
        log('CONNECTION', `Validation blocked: ${sourcePort.label} → ${targetPort.label}`, result.message, 'warn')
        return false
      }

      // Enforce one connection per physical port
      const portInUse = edges.some((e) => {
        const eSrc = e.sourceHandle?.replace(/-(?:target|source)$/, '') ?? e.sourceHandle
        const eTgt = e.targetHandle?.replace(/-(?:target|source)$/, '') ?? e.targetHandle
        return (
          (e.source === connection.source && eSrc === sourcePortId) ||
          (e.target === connection.source && eTgt === sourcePortId) ||
          (e.source === connection.target && eSrc === targetPortId) ||
          (e.target === connection.target && eTgt === targetPortId)
        )
      })
      if (portInUse) return false

      return true
    },
    [nodes, edges]
  )

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full" onKeyDown={onKeyDown} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={sortedEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={ConnectionLine}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ type: 'avEdge' }}
        snapToGrid
        snapGrid={[16, 16]}
        fitView
        deleteKeyCode={null}
        className="bg-background"
      >
        <HelperLines horizontal={helperLines.horizontal} vertical={helperLines.vertical} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls
          className="av-controls"
          showInteractive={false}
        />
        <ZoomIndicator />
        <MiniMap
          className="av-minimap"
          nodeStrokeWidth={2}
          nodeColor={minimapNodeColor}
          nodeStrokeColor={minimapStrokeColor}
          maskColor="rgba(0, 0, 0, 0.65)"
          bgColor="transparent"
          zoomable
          pannable
        />
        {usedDomains.length > 0 && !showProductImages && (
          <Panel position="bottom-left" className="!mb-1 !ml-1">
            <div className="flex items-center gap-2.5 px-2 py-1 rounded bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm">
              {usedDomains.map((domain) => (
                <div key={domain} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SIGNAL_COLORS[domain] }} />
                  <span className="text-[9px] text-muted-foreground">{SIGNAL_LABELS[domain]}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* ── Context Menu Overlay ── */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu() }} />
          <div
            className="absolute z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'node' && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground truncate max-w-[180px]">
                  {nodes.find((n) => n.id === contextMenu.nodeId)?.data.label ?? 'Node'}
                </div>
                <div className="-mx-1 my-0.5 h-px bg-muted" />
                <CtxItem icon={<Copy className="w-4 h-4" />} label="Copy" shortcut={`${modKey}C`} onClick={() => { copySelected(); closeMenu() }} />
                <CtxItem icon={<CopyPlus className="w-4 h-4" />} label="Duplicate" shortcut={`${modKey}D`} onClick={() => { duplicateSelected(); closeMenu() }} />
                {selectedNodeCount > 1 && (
                  <>
                    <div className="-mx-1 my-1 h-px bg-muted" />
                    <CtxItem icon={<Group className="w-4 h-4" />} label="Group Selection" shortcut={`${modKey}G`} onClick={() => { groupSelectedNodes(); closeMenu() }} />
                    <div className="-mx-1 my-1 h-px bg-muted" />
                    <CtxItem icon={<AlignCenterVertical className="w-4 h-4" />} label="Align Horizontally" onClick={() => { alignNodes('horizontal'); closeMenu() }} />
                    <CtxItem icon={<AlignCenterHorizontal className="w-4 h-4" />} label="Align Vertically" onClick={() => { alignNodes('vertical'); closeMenu() }} />
                    {selectedNodeCount > 2 && (
                      <>
                        <CtxItem icon={<AlignHorizontalSpaceAround className="w-4 h-4" />} label="Distribute Horizontally" onClick={() => { distributeNodes('horizontal'); closeMenu() }} />
                        <CtxItem icon={<AlignVerticalSpaceAround className="w-4 h-4" />} label="Distribute Vertically" onClick={() => { distributeNodes('vertical'); closeMenu() }} />
                      </>
                    )}
                  </>
                )}
                <div className="-mx-1 my-1 h-px bg-muted" />
                <CtxItem icon={<Trash2 className="w-4 h-4 text-destructive" />} label="Delete" shortcut="⌫" className="text-destructive focus:text-destructive" onClick={() => { deleteSelected(); closeMenu() }} />
              </>
            )}
            {contextMenu.type === 'edge' && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground truncate max-w-[180px]">
                  {edges.find((e) => e.id === contextMenu.edgeId)?.data?.label ?? 'Cable'}
                </div>
                <div className="-mx-1 my-0.5 h-px bg-muted" />
                <CtxItem icon={<Tag className="w-4 h-4" />} label="Rename Cable" onClick={() => { setEditingEdge(contextMenu.edgeId); closeMenu() }} />
                <div className="-mx-1 my-1 h-px bg-muted" />
                <CtxItem icon={<Trash2 className="w-4 h-4 text-destructive" />} label="Delete Cable" shortcut="⌫" className="text-destructive focus:text-destructive" onClick={() => { deleteSelected(); closeMenu() }} />
              </>
            )}
            {contextMenu.type === 'pane' && (
              <>
                <CtxItem icon={<ClipboardPaste className="w-4 h-4" />} label="Paste" shortcut={`${modKey}V`} disabled={!clipboard || clipboard.nodes.length === 0} onClick={() => { pasteClipboard(); closeMenu() }} />
                <CtxItem icon={<MousePointerSquareDashed className="w-4 h-4" />} label="Select All" shortcut={`${modKey}A`} onClick={() => { selectAll(); closeMenu() }} />
                <div className="-mx-1 my-1 h-px bg-muted" />
                <CtxItem icon={<Maximize className="w-4 h-4" />} label="Zoom to Fit" onClick={() => { fitView({ padding: 0.15, duration: 300 }); closeMenu() }} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Context menu item (matches Radix DropdownMenuItem style) ── */

function CtxItem({ icon, label, shortcut, disabled, className, onClick }: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  disabled?: boolean
  className?: string
  onClick: () => void
}) {
  return (
    <button
      className={`relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 ${className ?? ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {shortcut && <span className="ml-auto text-xs text-muted-foreground">{shortcut}</span>}
    </button>
  )
}
