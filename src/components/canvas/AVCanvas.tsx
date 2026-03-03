import { useCallback, useRef, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type OnSelectionChangeFunc,
  type NodeChange,
  type EdgeChange,
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
import type { AVNodeData, AVPort } from '@/types/av'
import type { Node, IsValidConnection } from '@xyflow/react'

const nodeTypes: NodeTypes = {
  signalFlow: SignalFlowNode,
  physicalLayout: PhysicalLayoutNode,
  group: GroupNode,
  offsheetConnector: OffsheetConnectorNode,
}

const edgeTypes: EdgeTypes = {
  avEdge: AVEdge,
}

export default function AVCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { fitView } = useReactFlow()
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
    (changes: NodeChange[]) => {
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
    (changes: EdgeChange[]) => {
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

      addNode(newNode)
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
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [setSelectedNode, setSelectedEdge])

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
      if (result.tier === 'block') return false

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
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={ConnectionLine}
        isValidConnection={isValidConnection}
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
    </div>
  )
}
