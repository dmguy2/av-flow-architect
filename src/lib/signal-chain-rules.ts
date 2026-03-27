/**
 * signal-chain-rules.ts
 *
 * Deterministic signal chain validation rules that run instantly
 * (no LLM required). Checks for common real-world issues like
 * missing preamps, unpowered passive speakers, and gain staging.
 */

import type { Node, Edge } from '@xyflow/react'
import type { AVNodeData, AVEdgeData } from '@/types/av'
import type { SignalChain } from './signal-chain'

export interface ChainIssue {
  severity: 'error' | 'warning' | 'info'
  category: 'gain-staging' | 'impedance' | 'power' | 'missing-device' | 'signal-type' | 'disconnected'
  message: string
  suggestion: string
  chainId: string
  affectedNodes: string[] // node IDs
}

// Component type classifications
const MIC_LEVEL_SOURCES = new Set([
  'microphone', 'wireless-mic',
])

const LINE_LEVEL_DEVICES = new Set([
  'mixer', 'di-box', 'dsp', 'audio-interface',
  'qsc-core-110f', 'biamp-tesiraforte-ai',
  'behringer-x32', 'yamaha-cl5', 'ah-dlive-s7000',
])

const PREAMP_DEVICES = new Set([
  'mixer', 'audio-interface', 'preamp',
  'behringer-x32', 'yamaha-cl5', 'ah-dlive-s7000',
  'qsc-core-110f', 'biamp-tesiraforte-ai',
])

const AMPLIFIER_DEVICES = new Set([
  'amplifier', 'powered-speaker',
  'crown-cdi-drivecore-4-600',
])

const PASSIVE_SPEAKERS = new Set([
  'speaker', 'subwoofer', 'ceiling-speaker',
])

const POWERED_SPEAKERS = new Set([
  'powered-speaker',
])


/**
 * Check if a chain has a microphone going directly to a powered speaker
 * without a mixer or preamp in between.
 */
function checkMissingPreamp(chain: SignalChain): ChainIssue | null {
  if (chain.domain !== 'audio') return null

  const path = chain.path
  if (path.length < 2) return null

  const source = path[0]
  if (!MIC_LEVEL_SOURCES.has(source.componentType)) return null

  // Check if any intermediate node is a preamp/mixer
  const intermediates = path.slice(1, -1)
  const hasPreamp = intermediates.some((n) => PREAMP_DEVICES.has(n.componentType))
  if (hasPreamp) return null

  const dest = path[path.length - 1]
  return {
    severity: 'warning',
    category: 'missing-device',
    message: `Microphone "${source.label}" connects to "${dest.label}" without a preamp or mixer`,
    suggestion: 'Add a mixing console or preamp between the microphone and the destination',
    chainId: chain.id,
    affectedNodes: [source.nodeId, dest.nodeId],
  }
}

/**
 * Check if a passive speaker is at the end of a chain without an amplifier upstream.
 */
function checkMissingAmplifier(chain: SignalChain): ChainIssue | null {
  if (chain.domain !== 'audio') return null

  const dest = chain.path[chain.path.length - 1]
  if (!PASSIVE_SPEAKERS.has(dest.componentType)) return null
  // Powered speakers don't need external amps
  if (POWERED_SPEAKERS.has(dest.componentType)) return null

  // Check if any node in the chain is an amplifier
  const hasAmp = chain.path.some((n) => AMPLIFIER_DEVICES.has(n.componentType))
  if (hasAmp) return null

  return {
    severity: 'error',
    category: 'power',
    message: `Passive speaker "${dest.label}" has no amplifier in the signal chain`,
    suggestion: 'Add a power amplifier before the passive speaker',
    chainId: chain.id,
    affectedNodes: [dest.nodeId],
  }
}

/**
 * Check for mic-level signals going into line-level inputs
 * (gain staging issue).
 */
function checkGainStaging(chain: SignalChain): ChainIssue | null {
  if (chain.domain !== 'audio') return null
  if (chain.path.length < 2) return null

  const source = chain.path[0]
  if (!MIC_LEVEL_SOURCES.has(source.componentType)) return null

  // If the next device in chain is a line-level device (not a preamp),
  // that's a gain staging issue
  const nextDevice = chain.path[1]
  if (
    LINE_LEVEL_DEVICES.has(nextDevice.componentType) &&
    !PREAMP_DEVICES.has(nextDevice.componentType)
  ) {
    return {
      severity: 'warning',
      category: 'gain-staging',
      message: `Mic-level signal from "${source.label}" into line-level input of "${nextDevice.label}"`,
      suggestion: 'Use a preamp or mixer with mic preamp inputs to boost the signal to line level',
      chainId: chain.id,
      affectedNodes: [source.nodeId, nextDevice.nodeId],
    }
  }

  return null
}

/**
 * Check for very long video chains that might have signal degradation.
 */
function checkVideoChainLength(chain: SignalChain): ChainIssue | null {
  if (chain.domain !== 'video') return null
  if (chain.path.length <= 4) return null

  return {
    severity: 'info',
    category: 'signal-type',
    message: `Long video chain (${chain.path.length} devices): ${chain.sourceLabel} → ${chain.destLabel}`,
    suggestion: 'Consider using a distribution amplifier or signal extender for long video chains',
    chainId: chain.id,
    affectedNodes: chain.path.map((n) => n.nodeId),
  }
}

/**
 * Run all deterministic rules against a set of signal chains.
 * Returns all issues found.
 */
export function analyzeChainsDeterministic(chains: SignalChain[]): ChainIssue[] {
  const issues: ChainIssue[] = []

  const rules = [
    checkMissingPreamp,
    checkMissingAmplifier,
    checkGainStaging,
    checkVideoChainLength,
  ]

  for (const chain of chains) {
    for (const rule of rules) {
      const issue = rule(chain)
      if (issue) issues.push(issue)
    }
  }

  return issues
}

// ── Graph-level analysis (operates on all nodes/edges, not just traced chains) ──

/** Destination device types that should have incoming signal connections */
const SINK_TYPES = new Set([
  'speaker', 'subwoofer', 'ceiling-speaker', 'powered-speaker',
  'display', 'projector', 'recorder',
])

/** Source device types that should have outgoing signal connections */
const SOURCE_TYPES = new Set([
  'microphone', 'wireless-mic', 'camera', 'ptz-camera',
  'media-player', 'laptop', 'blu-ray',
])

/**
 * Find destination devices (speakers, displays, projectors) that have
 * no incoming signal connections — likely forgotten wiring.
 */
function checkDisconnectedSinks(
  nodes: Node<AVNodeData>[],
  edges: Edge<AVEdgeData>[]
): ChainIssue[] {
  const nodesWithIncoming = new Set<string>()
  for (const edge of edges) {
    if (edge.target) nodesWithIncoming.add(edge.target)
  }

  const issues: ChainIssue[] = []
  for (const node of nodes) {
    if (node.type === 'group') continue
    if (!SINK_TYPES.has(node.data.componentType)) continue
    if (nodesWithIncoming.has(node.id)) continue

    const kind = PASSIVE_SPEAKERS.has(node.data.componentType) || POWERED_SPEAKERS.has(node.data.componentType)
      ? 'speaker' : node.data.componentType === 'recorder' ? 'recorder' : 'display'

    issues.push({
      severity: 'warning',
      category: 'disconnected',
      message: `${kind === 'speaker' ? 'Speaker' : kind === 'display' ? 'Display' : 'Recorder'} "${node.data.label}" has no incoming signal`,
      suggestion: `Connect a signal source to this ${kind}`,
      chainId: '',
      affectedNodes: [node.id],
    })
  }

  return issues
}

/**
 * Find source devices (mics, cameras) that have no outgoing connections —
 * likely forgotten wiring or placeholder devices.
 */
function checkDisconnectedSources(
  nodes: Node<AVNodeData>[],
  edges: Edge<AVEdgeData>[]
): ChainIssue[] {
  const nodesWithOutgoing = new Set<string>()
  for (const edge of edges) {
    if (edge.source) nodesWithOutgoing.add(edge.source)
  }

  const issues: ChainIssue[] = []
  for (const node of nodes) {
    if (node.type === 'group') continue
    if (!SOURCE_TYPES.has(node.data.componentType)) continue
    if (nodesWithOutgoing.has(node.id)) continue

    issues.push({
      severity: 'info',
      category: 'disconnected',
      message: `Source "${node.data.label}" has no outgoing connections`,
      suggestion: 'Connect this source to a mixer, processor, or destination',
      chainId: '',
      affectedNodes: [node.id],
    })
  }

  return issues
}

/**
 * Graph-level analysis that checks all nodes/edges for structural issues
 * (disconnected devices, etc.) that chain-level analysis can't detect.
 */
export function analyzeGraphIssues(
  nodes: Node<AVNodeData>[],
  edges: Edge<AVEdgeData>[]
): ChainIssue[] {
  return [
    ...checkDisconnectedSinks(nodes, edges),
    ...checkDisconnectedSources(nodes, edges),
  ]
}
