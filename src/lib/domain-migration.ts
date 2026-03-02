import type { SignalDomain, AVNodeData, AVEdgeData } from '@/types/av'
import type { Node, Edge } from '@xyflow/react'

/**
 * Maps old domain names to new ones.
 * 'data' splits into 'network' or 'av-over-ip' depending on the connector.
 * 'lighting' becomes 'network' (DMX is a control protocol).
 */
export function migrateDomain(domain: string, connector?: string): SignalDomain {
  if (domain === 'data') {
    if (connector === 'dante' || connector === 'fiber') {
      return 'av-over-ip'
    }
    return 'network'
  }
  if (domain === 'lighting') {
    return 'network'
  }
  return domain as SignalDomain
}

export function migrateNodes(nodes: Node<AVNodeData>[]): Node<AVNodeData>[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      ports: node.data.ports?.map((port) => ({
        ...port,
        domain: migrateDomain(port.domain, port.connector),
      })) ?? [],
    },
  }))
}

export function migrateEdges(edges: Edge<AVEdgeData>[]): Edge<AVEdgeData>[] {
  return edges.map((edge) => {
    if (!edge.data) return edge
    return {
      ...edge,
      data: {
        ...edge.data,
        domain: migrateDomain(edge.data.domain, edge.data.connector),
      },
    }
  })
}
