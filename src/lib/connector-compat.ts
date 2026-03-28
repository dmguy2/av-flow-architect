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
  'bnc|displayport': { compat: 'active-converter', note: 'Active composite-to-DP converter required' },
  // SDI uses BNC connectors physically — same 75Ω BNC, but verify signal format
  'bnc|sdi': { compat: 'passive-adapter', note: 'Same BNC connector — verify signal format (SDI vs composite/reference)' },

  // Audio cross-connector
  'trs|xlr': { compat: 'passive-adapter', note: 'XLR-to-TRS adapter (check balanced/unbalanced)' },
  'rca|xlr': { compat: 'passive-adapter', note: 'XLR-to-RCA adapter (impedance mismatch)' },
  'rca|trs': { compat: 'passive-adapter', note: 'TRS-to-RCA adapter (unbalanced)' },
  'rca|speakon': { compat: 'incompatible', note: 'Line-level vs speaker-level' },
  'speakon|trs': { compat: 'incompatible', note: 'Speaker-level vs line-level' },
  'speakon|xlr': { compat: 'incompatible', note: 'Speaker-level vs mic/line-level' },

  // DMX is a lighting control protocol, not audio — common cross-wiring mistake
  'dmx|xlr': { compat: 'incompatible', note: 'DMX is lighting control data — not compatible with audio XLR' },
  'dmx|trs': { compat: 'incompatible', note: 'DMX is lighting control data — not an audio signal' },
  'dmx|speakon': { compat: 'incompatible', note: 'DMX is lighting control — cannot drive speakers' },

  // Network / data cross-connector
  'ethernet|usb': { compat: 'active-converter', note: 'USB Ethernet adapter' },
  'thunderbolt|usb': { compat: 'direct', note: 'USB-C/Thunderbolt share the same connector' },
  'ethernet|thunderbolt': { compat: 'active-converter', note: 'Thunderbolt Ethernet adapter' },
  'ethernet|fiber': { compat: 'active-converter', note: 'Fiber media converter required' },
  'fiber|thunderbolt': { compat: 'active-converter', note: 'Thunderbolt-to-fiber adapter required' },

  // Digital audio protocol mismatches (same Ethernet cable, incompatible protocols)
  'aes50|dante': { compat: 'incompatible', note: 'AES50 and Dante are different digital audio protocols' },
  'aes50|ndi': { compat: 'incompatible', note: 'AES50 is audio-only, NDI is video — different protocols' },
  'dante|ndi': { compat: 'incompatible', note: 'Dante (audio) and NDI (video) are different network protocols' },
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
