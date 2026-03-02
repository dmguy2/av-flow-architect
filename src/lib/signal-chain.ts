/**
 * signal-chain.ts
 *
 * Traces signal paths through the canvas graph from source nodes
 * (microphones, cameras, media players) to terminal nodes (speakers, displays).
 * Used by the signal chain analysis system.
 */

import type { Node, Edge } from '@xyflow/react'
import type { AVNodeData, AVEdgeData, AVPort, SignalDomain } from '@/types/av'

export interface SignalChainNode {
  nodeId: string
  label: string
  componentType: string
  manufacturer?: string
  model?: string
  powerDraw?: string
  /** The port that receives the signal into this node */
  inPort?: AVPort
  /** The port that sends the signal onward from this node */
  outPort?: AVPort
}

export interface SignalChain {
  id: string
  domain: SignalDomain
  path: SignalChainNode[]
  sourceLabel: string
  destLabel: string
}

// Component types that are signal sources (have outputs but conceptually originate signal)
const SOURCE_TYPES = new Set([
  'microphone', 'wireless-mic', 'di-box', 'media-player',
  'camera', 'ptz-camera', 'laptop', 'blu-ray',
  'remote-participant',
])

// Component types that are signal destinations (terminal sinks)
const SINK_TYPES = new Set([
  'speaker', 'subwoofer', 'ceiling-speaker',
  'display', 'projector',
  'recorder',
])

/**
 * Extract port ID from a React Flow handle ID.
 * Handle IDs are plain port IDs. Legacy edges may still use "portId-source" or "portId-target" suffixes.
 */
function portIdFromHandle(handle: string | null | undefined): string {
  if (!handle) return ''
  return handle.replace(/-(?:target|source)$/, '')
}

interface AdjEntry {
  edgeId: string
  targetNodeId: string
  sourcePortId: string
  targetPortId: string
  domain: SignalDomain
}

/**
 * Build an adjacency list mapping each node to its outgoing connections.
 */
function buildAdjacency(
  edges: Edge<AVEdgeData>[]
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>()

  for (const edge of edges) {
    if (!edge.source || !edge.target) continue
    const entry: AdjEntry = {
      edgeId: edge.id,
      targetNodeId: edge.target,
      sourcePortId: portIdFromHandle(edge.sourceHandle),
      targetPortId: portIdFromHandle(edge.targetHandle),
      domain: edge.data?.domain ?? 'audio',
    }

    const existing = adj.get(edge.source)
    if (existing) {
      existing.push(entry)
    } else {
      adj.set(edge.source, [entry])
    }
  }

  return adj
}

/**
 * Find all nodes that act as signal sources:
 * Either they are known source types, or they have output ports
 * with no incoming edges (nothing feeds into them).
 */
function findSourceNodes(
  nodes: Node<AVNodeData>[],
  edges: Edge<AVEdgeData>[],
  domainFilter?: SignalDomain
): Node<AVNodeData>[] {
  // Collect all node IDs that have incoming edges
  const nodesWithIncoming = new Set<string>()
  for (const edge of edges) {
    if (edge.target) nodesWithIncoming.add(edge.target)
  }

  return nodes.filter((node) => {
    const data = node.data
    // Known source types always qualify
    if (SOURCE_TYPES.has(data.componentType)) return true
    // Nodes with outputs but no incoming edges are potential sources
    const hasOutputs = data.ports.some(
      (p: AVPort) =>
        (p.direction === 'output' || p.direction === 'bidirectional' || p.direction === 'undefined') &&
        (!domainFilter || p.domain === domainFilter)
    )
    return hasOutputs && !nodesWithIncoming.has(node.id)
  })
}

/**
 * Trace all signal chains from source nodes through the graph.
 */
export function traceSignalChains(
  nodes: Node<AVNodeData>[],
  edges: Edge<AVEdgeData>[],
  domainFilter?: SignalDomain
): SignalChain[] {
  const adj = buildAdjacency(edges)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const sources = findSourceNodes(nodes, edges, domainFilter)
  const chains: SignalChain[] = []
  let chainId = 0

  for (const source of sources) {
    // DFS from each source
    const visited = new Set<string>()
    const stack: { nodeId: string; path: SignalChainNode[]; domain: SignalDomain }[] = []

    // Start from each output port of the source
    const outEdges = adj.get(source.id) ?? []
    for (const edge of outEdges) {
      if (domainFilter && edge.domain !== domainFilter) continue

      const outPort = source.data.ports.find((p: AVPort) => p.id === edge.sourcePortId)
      const targetNode = nodeMap.get(edge.targetNodeId)
      if (!targetNode) continue

      const inPort = targetNode.data.ports.find((p: AVPort) => p.id === edge.targetPortId)

      const sourceCN: SignalChainNode = {
        nodeId: source.id,
        label: source.data.label,
        componentType: source.data.componentType,
        manufacturer: source.data.manufacturer,
        model: source.data.model,
        powerDraw: source.data.powerDraw,
        outPort: outPort,
      }

      const targetCN: SignalChainNode = {
        nodeId: targetNode.id,
        label: targetNode.data.label,
        componentType: targetNode.data.componentType,
        manufacturer: targetNode.data.manufacturer,
        model: targetNode.data.model,
        powerDraw: targetNode.data.powerDraw,
        inPort: inPort,
      }

      stack.push({
        nodeId: edge.targetNodeId,
        path: [sourceCN, targetCN],
        domain: edge.domain,
      })
    }

    while (stack.length > 0) {
      const current = stack.pop()!
      const visitKey = `${current.nodeId}-${current.domain}`

      // Cycle detection
      if (visited.has(visitKey)) continue
      visited.add(visitKey)

      const nextEdges = adj.get(current.nodeId) ?? []
      const relevantEdges = nextEdges.filter(
        (e) => !domainFilter || e.domain === current.domain
      )

      if (relevantEdges.length === 0 || SINK_TYPES.has(current.path[current.path.length - 1].componentType)) {
        // Terminal node — record this chain
        if (current.path.length >= 2) {
          chains.push({
            id: `chain-${chainId++}`,
            domain: current.domain,
            path: current.path,
            sourceLabel: current.path[0].label,
            destLabel: current.path[current.path.length - 1].label,
          })
        }
        continue
      }

      // Continue traversing
      for (const edge of relevantEdges) {
        const lastNode = current.path[current.path.length - 1]
        const outPort = nodeMap.get(current.nodeId)?.data.ports.find(
          (p: AVPort) => p.id === edge.sourcePortId
        )
        const targetNode = nodeMap.get(edge.targetNodeId)
        if (!targetNode) continue
        const inPort = targetNode.data.ports.find(
          (p: AVPort) => p.id === edge.targetPortId
        )

        // Update last node's outPort
        const updatedLast: SignalChainNode = { ...lastNode, outPort }
        const nextCN: SignalChainNode = {
          nodeId: targetNode.id,
          label: targetNode.data.label,
          componentType: targetNode.data.componentType,
          manufacturer: targetNode.data.manufacturer,
          model: targetNode.data.model,
          powerDraw: targetNode.data.powerDraw,
          inPort: inPort,
        }

        stack.push({
          nodeId: edge.targetNodeId,
          path: [...current.path.slice(0, -1), updatedLast, nextCN],
          domain: current.domain,
        })
      }
    }
  }

  return chains
}
