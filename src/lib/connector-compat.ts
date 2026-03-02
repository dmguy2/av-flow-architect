import type { ConnectorType } from '@/types/av'

export type ConnectorCompatLevel = 'direct' | 'passive-adapter' | 'active-converter' | 'incompatible'

export interface ConnectorCompatResult {
  compat: ConnectorCompatLevel
  note: string
}

/**
 * Pairwise connector compatibility lookup.
 * Keys are sorted alphabetically: "connA|connB"
 */
const CONNECTOR_COMPAT: Record<string, ConnectorCompatResult> = {
  // Video cross-connector
  'displayport|hdmi': { compat: 'passive-adapter', note: 'Passive DP++ to HDMI adapter' },
  'hdmi|sdi': { compat: 'active-converter', note: 'Active HDMI-to-SDI converter required' },
  'displayport|sdi': { compat: 'active-converter', note: 'Active DP-to-SDI converter required' },
  'bnc|hdmi': { compat: 'active-converter', note: 'Active composite-to-HDMI converter' },
  'bnc|sdi': { compat: 'incompatible', note: 'BNC reference/composite is not SDI' },

  // Audio cross-connector
  'trs|xlr': { compat: 'passive-adapter', note: 'XLR-to-TRS adapter (check balanced/unbalanced)' },
  'rca|xlr': { compat: 'passive-adapter', note: 'XLR-to-RCA adapter (impedance mismatch)' },
  'rca|trs': { compat: 'passive-adapter', note: 'TRS-to-RCA adapter (unbalanced)' },
  'rca|speakon': { compat: 'incompatible', note: 'Line-level vs speaker-level' },
  'speakon|trs': { compat: 'incompatible', note: 'Speaker-level vs line-level' },
  'speakon|xlr': { compat: 'incompatible', note: 'Speaker-level vs mic/line-level' },

  // Network / data cross-connector
  'ethernet|usb': { compat: 'active-converter', note: 'USB Ethernet adapter' },
  'thunderbolt|usb': { compat: 'passive-adapter', note: 'USB-C/Thunderbolt compatible' },
  'ethernet|thunderbolt': { compat: 'active-converter', note: 'Thunderbolt Ethernet adapter' },
}

/**
 * Look up cross-connector compatibility between two connector types.
 * Returns undefined if the pair is not in the matrix (fall through to generic rules).
 */
export function getConnectorCompatibility(
  c1: ConnectorType,
  c2: ConnectorType
): ConnectorCompatResult | undefined {
  if (c1 === c2) return undefined // Same connector — not a cross-connector issue
  const key = [c1, c2].sort().join('|')
  return CONNECTOR_COMPAT[key]
}
