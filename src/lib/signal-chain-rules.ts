/**
 * signal-chain-rules.ts
 *
 * Deterministic signal chain validation rules that run instantly
 * (no LLM required). Checks for common real-world issues like
 * missing preamps, unpowered passive speakers, and gain staging.
 */

import type { SignalChain, SignalChainNode } from './signal-chain'

export interface ChainIssue {
  severity: 'error' | 'warning' | 'info'
  category: 'gain-staging' | 'impedance' | 'power' | 'missing-device' | 'signal-type'
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

const HI_Z_SOURCES = new Set([
  'di-box', // DI boxes are often at the end of a hi-Z guitar signal
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
