import type { AVPort, ConnectorType, SignalDomain } from '@/types/av'
import { getVariantCompatibility, VARIANT_LABELS } from '@/lib/connector-variants'
import { getConnectorCompatibility } from '@/lib/connector-compat'

export const CONNECTOR_DOMAIN_MAP: Record<ConnectorType, SignalDomain> = {
  xlr: 'audio',
  trs: 'audio',
  rca: 'audio',
  speakon: 'audio',
  hdmi: 'video',
  sdi: 'video',
  ethernet: 'network',
  dante: 'av-over-ip',
  usb: 'network',
  powercon: 'power',
  dmx: 'network', // DMX uses XLR-style connectors but is a data/control protocol
  fiber: 'network',
  aes50: 'av-over-ip',
  ndi: 'av-over-ip',
  wifi: 'network',
  thunderbolt: 'network',
  db9: 'network',
  bnc: 'video',
  displayport: 'video',
  sd: 'network',
}

export interface ValidationResult {
  tier: 'allow' | 'warn' | 'block'
  message?: string
}

const POWER_CONNECTORS: Set<ConnectorType> = new Set(['powercon'])
const VIDEO_CONNECTORS: Set<ConnectorType> = new Set(['hdmi', 'sdi', 'bnc', 'displayport'])
const AUDIO_CONNECTORS: Set<ConnectorType> = new Set(['xlr', 'trs', 'rca', 'speakon'])
// Pure network connectors with zero audio/video physical compatibility.
// Excludes USB, Thunderbolt, Dante (which can bridge signal domains via protocol).
const NETWORK_ONLY_CONNECTORS: Set<ConnectorType> = new Set(['ethernet', 'fiber'])

export function validateConnection(
  sourcePort: AVPort,
  targetPort: AVPort
): ValidationResult {
  // Undefined direction = wildcard, connects to anything
  if (sourcePort.direction === 'undefined' || targetPort.direction === 'undefined') {
    return { tier: 'allow' }
  }

  const srcConn = sourcePort.connector
  const tgtConn = targetPort.connector
  const srcDomain = sourcePort.domain
  const tgtDomain = targetPort.domain

  // ── Block Rules ──────────────────────────────────────────────

  // Power ↔ non-power: powercon can only connect to powercon
  if (POWER_CONNECTORS.has(srcConn) && !POWER_CONNECTORS.has(tgtConn)) {
    return { tier: 'block', message: 'Power connector can only connect to power' }
  }
  if (!POWER_CONNECTORS.has(srcConn) && POWER_CONNECTORS.has(tgtConn)) {
    return { tier: 'block', message: 'Only power connectors can connect to power' }
  }

  // Power domain mismatch (non-powercon but power domain vs non-power domain)
  if (srcDomain === 'power' && tgtDomain !== 'power') {
    return { tier: 'block', message: 'Power cannot connect to non-power' }
  }
  if (srcDomain !== 'power' && tgtDomain === 'power') {
    return { tier: 'block', message: 'Non-power cannot connect to power' }
  }

  // Video connector → audio connector
  if (VIDEO_CONNECTORS.has(srcConn) && AUDIO_CONNECTORS.has(tgtConn)) {
    return { tier: 'block', message: 'Video connector cannot connect to audio connector' }
  }

  // Audio connector → video connector
  if (AUDIO_CONNECTORS.has(srcConn) && VIDEO_CONNECTORS.has(tgtConn)) {
    return { tier: 'block', message: 'Audio connector cannot connect to video connector' }
  }

  // Wi-Fi ↔ physical audio/video connectors
  if (srcConn === 'wifi' && (AUDIO_CONNECTORS.has(tgtConn) || VIDEO_CONNECTORS.has(tgtConn))) {
    return { tier: 'block', message: 'Wi-Fi cannot connect directly to audio/video connector' }
  }
  if (tgtConn === 'wifi' && (AUDIO_CONNECTORS.has(srcConn) || VIDEO_CONNECTORS.has(srcConn))) {
    return { tier: 'block', message: 'Audio/video connector cannot connect directly to Wi-Fi' }
  }

  // Video connector ↔ network-only connector: physically incompatible
  if (VIDEO_CONNECTORS.has(srcConn) && NETWORK_ONLY_CONNECTORS.has(tgtConn)) {
    return { tier: 'block', message: 'Video connector cannot connect to network connector' }
  }
  if (NETWORK_ONLY_CONNECTORS.has(srcConn) && VIDEO_CONNECTORS.has(tgtConn)) {
    return { tier: 'block', message: 'Network connector cannot connect to video connector' }
  }

  // Audio connector ↔ network-only connector: physically incompatible
  if (AUDIO_CONNECTORS.has(srcConn) && NETWORK_ONLY_CONNECTORS.has(tgtConn)) {
    return { tier: 'block', message: 'Audio connector cannot connect to network connector' }
  }
  if (NETWORK_ONLY_CONNECTORS.has(srcConn) && AUDIO_CONNECTORS.has(tgtConn)) {
    return { tier: 'block', message: 'Network connector cannot connect to audio connector' }
  }

  // ── Connector Compatibility Matrix ───────────────────────────
  const compatResult = getConnectorCompatibility(srcConn, tgtConn)
  if (compatResult) {
    if (compatResult.compat === 'incompatible') {
      return { tier: 'block', message: compatResult.note }
    }
    if (compatResult.compat === 'passive-adapter') {
      return { tier: 'warn', message: `Passive adapter: ${compatResult.note}` }
    }
    if (compatResult.compat === 'active-converter') {
      return { tier: 'warn', message: `Active converter needed: ${compatResult.note}` }
    }
    if (compatResult.compat === 'direct') {
      return { tier: 'allow' }
    }
  }

  // ── Warn Rules ───────────────────────────────────────────────

  // Connector mismatch within same domain (fallback for pairs not in the matrix)
  if (srcDomain === tgtDomain && srcConn !== tgtConn) {
    if (AUDIO_CONNECTORS.has(srcConn) && AUDIO_CONNECTORS.has(tgtConn)) {
      return { tier: 'warn', message: `${srcConn.toUpperCase()}↔${tgtConn.toUpperCase()}: adapter needed` }
    }
    // Other same-domain connector mismatches
    return {
      tier: 'warn',
      message: `Connector mismatch: ${srcConn.toUpperCase()} to ${tgtConn.toUpperCase()}`,
    }
  }

  // Cross-domain but physically plausible
  // Ethernet ↔ Dante (same RJ45 but different protocols)
  if (
    (srcConn === 'ethernet' && tgtConn === 'dante') ||
    (srcConn === 'dante' && tgtConn === 'ethernet')
  ) {
    return { tier: 'warn', message: 'Ethernet↔Dante: same cable, different protocols' }
  }

  // Network ↔ AV-over-IP domain crossing
  if (
    (srcDomain === 'network' && tgtDomain === 'av-over-ip') ||
    (srcDomain === 'av-over-ip' && tgtDomain === 'network')
  ) {
    return { tier: 'warn', message: 'Network↔AV-over-IP: verify protocol compatibility' }
  }

  // DMX to ethernet or vice versa
  if (
    (srcConn === 'dmx' && tgtConn === 'ethernet') ||
    (srcConn === 'ethernet' && tgtConn === 'dmx')
  ) {
    return { tier: 'warn', message: 'DMX↔Ethernet: protocol adapter may be needed' }
  }

  // Domain mismatch not caught by block rules (e.g. audio↔network via USB)
  if (srcDomain !== tgtDomain) {
    return {
      tier: 'warn',
      message: `Domain mismatch: ${srcDomain} to ${tgtDomain}`,
    }
  }

  // ── Variant Rules ──────────────────────────────────────────

  // Only check when both ports specify a variant
  if (sourcePort.variant && targetPort.variant) {
    const { compat, adapter } = getVariantCompatibility(sourcePort.variant, targetPort.variant)
    if (compat === 'incompatible') {
      return {
        tier: 'block',
        message: `Incompatible: ${VARIANT_LABELS[sourcePort.variant]} to ${VARIANT_LABELS[targetPort.variant]}`,
      }
    }
    if (compat === 'compatible') {
      return {
        tier: 'warn',
        message: adapter
          ? `Adapter required: ${adapter}`
          : `Adapter required: ${VARIANT_LABELS[sourcePort.variant]} to ${VARIANT_LABELS[targetPort.variant]}`,
      }
    }
  }

  // ── Allow ────────────────────────────────────────────────────

  return { tier: 'allow' }
}
