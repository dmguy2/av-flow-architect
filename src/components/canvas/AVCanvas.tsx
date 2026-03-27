import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
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
import { SIGNAL_Z_ORDER } from '@/lib/signal-colors'
import { validateConnection } from '@/lib/connection-validation'
import type { AVNodeData, AVEdgeData, AVPort } from '@/types/av'
import type { Node, Edge, IsValidConnection, NodeChange, EdgeChange } from '@xyflow/react'
import { log } from '@/lib/logger'
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

  // Wrap onNodesChange to detect selection changes
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<AVNodeData>>[]) => {
      onNodesChange(changes)
      const selectionChange = changes.find(
        (c) => c.type === 'select'
      ) as (NodeChange & { type: 'select'; id: string; selected: boolean }) | undefined
      if (selectionChange) {
        if (selectionChange.selected) {
          setSelectedNode(selectionChange.id)
        } else {
          // Only clear if no other node is selected
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
        deleteKeyCode="Delete"
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls
          className="av-controls"
          showInteractive={false}
        />
        <MiniMap
          className="av-minimap"
          nodeStrokeWidth={2}
          nodeColor="rgba(255, 255, 255, 0.15)"
          nodeStrokeColor="rgba(255, 255, 255, 0.25)"
          maskColor="rgba(0, 0, 0, 0.65)"
          bgColor="transparent"
          zoomable
          pannable
        />
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
