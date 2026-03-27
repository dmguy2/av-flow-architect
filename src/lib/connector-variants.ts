import type { ConnectorType, ConnectorVariant } from '@/types/av'

/** Which variants each connector type supports */
export const CONNECTOR_VARIANTS: Record<ConnectorType, ConnectorVariant[]> = {
  xlr: ['xlr-3pin', 'xlr-5pin', 'xlr-7pin'],
  trs: ['trs-quarter', 'trs-3.5mm', 'trs-2.5mm'],
  hdmi: ['hdmi-full', 'hdmi-mini', 'hdmi-micro'],
  ethernet: ['ethernet-rj45', 'ethernet-ethercon'],
  usb: ['usb-a', 'usb-b', 'usb-c', 'usb-micro-b'],
  powercon: ['powercon-20a', 'powercon-32a', 'powercon-true1'],
  speakon: ['speakon-2pole', 'speakon-4pole', 'speakon-8pole'],
  sdi: ['sdi-bnc', 'sdi-micro-bnc'],
  thunderbolt: ['thunderbolt-3', 'thunderbolt-4'],
  db9: ['db9-rs422', 'db9-rs232'],
  bnc: ['bnc-reference', 'bnc-composite', 'bnc-wordclock'],
  displayport: ['displayport-full', 'displayport-mini'],
  sd: ['sd-full', 'sd-micro', 'sd-cfast', 'sd-cfexpress'],
  // No variants
  rca: [],
  dante: [],
  dmx: [],
  fiber: [],
  aes50: [],
  ndi: [],
  wifi: [],
}

/** Human-readable labels for each variant */
export const VARIANT_LABELS: Record<ConnectorVariant, string> = {
  'xlr-3pin': '3-Pin',
  'xlr-5pin': '5-Pin (DMX)',
  'xlr-7pin': '7-Pin',
  'trs-quarter': '1/4"',
  'trs-3.5mm': '3.5mm',
  'trs-2.5mm': '2.5mm',
  'hdmi-full': 'Full-Size',
  'hdmi-mini': 'Mini',
  'hdmi-micro': 'Micro',
  'ethernet-rj45': 'RJ45',
  'ethernet-ethercon': 'etherCON',
  'usb-a': 'Type-A',
  'usb-b': 'Type-B',
  'usb-c': 'Type-C',
  'usb-micro-b': 'Micro-B',
  'powercon-20a': '20A (Blue)',
  'powercon-32a': '32A',
  'powercon-true1': 'TRUE1',
  'speakon-2pole': '2-Pole',
  'speakon-4pole': '4-Pole',
  'speakon-8pole': '8-Pole',
  'sdi-bnc': 'BNC',
  'sdi-micro-bnc': 'Micro-BNC',
  'thunderbolt-3': 'Thunderbolt 3',
  'thunderbolt-4': 'Thunderbolt 4',
  'db9-rs422': 'RS-422',
  'db9-rs232': 'RS-232',
  'bnc-reference': 'Reference/Genlock',
  'bnc-composite': 'Composite',
  'bnc-wordclock': 'Word Clock',
  'displayport-full': 'Full-Size',
  'displayport-mini': 'Mini',
  'sd-full': 'SD/SDHC/SDXC',
  'sd-micro': 'microSD',
  'sd-cfast': 'CFast',
  'sd-cfexpress': 'CFexpress',
}

type VariantCompat = 'same' | 'compatible' | 'incompatible'

/**
 * Compatibility matrix for variant pairs.
 * Keys are sorted alphabetically: "variant1|variant2"
 *
 * - same: identical connector, direct connect
 * - compatible: adapter required but signals compatible
 * - incompatible: physically and/or electrically incompatible, blocked
 */
const VARIANT_COMPAT: Record<string, VariantCompat> = {
  // XLR: 3-pin (audio) ↔ 5-pin (DMX) adapter exists but different signal use;
  // 7-pin is lighting/special, incompatible with 3-pin and 5-pin
  'xlr-3pin|xlr-5pin': 'compatible',
  'xlr-3pin|xlr-7pin': 'incompatible',
  'xlr-5pin|xlr-7pin': 'incompatible',

  // TRS: different barrel sizes, all adaptable
  'trs-2.5mm|trs-quarter': 'compatible',
  'trs-3.5mm|trs-quarter': 'compatible',
  'trs-2.5mm|trs-3.5mm': 'compatible',

  // HDMI: all interchangeable with passive adapters
  'hdmi-full|hdmi-micro': 'compatible',
  'hdmi-full|hdmi-mini': 'compatible',
  'hdmi-micro|hdmi-mini': 'compatible',

  // Ethernet: etherCON accepts RJ45 but not vice versa (adapter needed)
  'ethernet-ethercon|ethernet-rj45': 'compatible',

  // USB: all combinations adaptable
  'usb-a|usb-b': 'compatible',
  'usb-a|usb-c': 'compatible',
  'usb-a|usb-micro-b': 'compatible',
  'usb-b|usb-c': 'compatible',
  'usb-b|usb-micro-b': 'compatible',
  'usb-c|usb-micro-b': 'compatible',

  // Powercon: different lockout profiles, NOT interchangeable
  'powercon-20a|powercon-32a': 'incompatible',
  'powercon-20a|powercon-true1': 'incompatible',
  'powercon-32a|powercon-true1': 'incompatible',

  // Speakon: 2-pole fits 4-pole chassis; 8-pole is physically different
  'speakon-2pole|speakon-4pole': 'compatible',
  'speakon-2pole|speakon-8pole': 'incompatible',
  'speakon-4pole|speakon-8pole': 'incompatible',

  // SDI: BNC ↔ micro-BNC adapter required
  'sdi-bnc|sdi-micro-bnc': 'compatible',

  // Thunderbolt: TB3 ↔ TB4 backward compatible
  'thunderbolt-3|thunderbolt-4': 'compatible',

  // Thunderbolt ↔ USB: Physical connector is the same for USB-C, adapters exist for others
  'thunderbolt-3|usb-a': 'compatible',
  'thunderbolt-3|usb-b': 'compatible',
  'thunderbolt-3|usb-c': 'same',
  'thunderbolt-3|usb-micro-b': 'compatible',
  'thunderbolt-4|usb-a': 'compatible',
  'thunderbolt-4|usb-b': 'compatible',
  'thunderbolt-4|usb-c': 'same',
  'thunderbolt-4|usb-micro-b': 'compatible',

  // DB9: RS-422 ↔ RS-232 different protocols, same physical connector
  'db9-rs232|db9-rs422': 'incompatible',

  // BNC: all use same physical BNC but carry different signals
  'bnc-composite|bnc-reference': 'incompatible',
  'bnc-composite|bnc-wordclock': 'incompatible',
  'bnc-reference|bnc-wordclock': 'incompatible',

  // DisplayPort: full ↔ mini adapter
  'displayport-full|displayport-mini': 'compatible',
}

/** Adapter descriptions for compatible variant pairs */
const ADAPTER_DESCRIPTIONS: Record<string, string> = {
  'xlr-3pin|xlr-5pin': 'XLR 3-pin to 5-pin adapter',
  'trs-2.5mm|trs-quarter': '2.5mm to 1/4" adapter',
  'trs-3.5mm|trs-quarter': '3.5mm to 1/4" adapter',
  'trs-2.5mm|trs-3.5mm': '2.5mm to 3.5mm adapter',
  'hdmi-full|hdmi-micro': 'HDMI to Micro-HDMI adapter',
  'hdmi-full|hdmi-mini': 'HDMI to Mini-HDMI adapter',
  'hdmi-micro|hdmi-mini': 'Mini-HDMI to Micro-HDMI adapter',
  'ethernet-ethercon|ethernet-rj45': 'etherCON to RJ45 adapter',
  'usb-a|usb-b': 'USB-A to USB-B cable',
  'usb-a|usb-c': 'USB-A to USB-C adapter',
  'usb-a|usb-micro-b': 'USB-A to Micro-B cable',
  'usb-b|usb-c': 'USB-B to USB-C adapter',
  'usb-b|usb-micro-b': 'USB-B to Micro-B adapter',
  'usb-c|usb-micro-b': 'USB-C to Micro-B adapter',
  'speakon-2pole|speakon-4pole': '2-pole into 4-pole chassis (partial wiring)',
  'sdi-bnc|sdi-micro-bnc': 'BNC to Micro-BNC adapter',
  'thunderbolt-3|thunderbolt-4': 'TB3 ↔ TB4 backward compatible',
  'thunderbolt-3|usb-a': 'Thunderbolt/USB-C to USB-A adapter',
  'thunderbolt-3|usb-b': 'Thunderbolt/USB-C to USB-B adapter',
  'thunderbolt-3|usb-c': 'Direct physical connection (USB-C cable)',
  'thunderbolt-3|usb-micro-b': 'Thunderbolt/USB-C to Micro-B adapter',
  'thunderbolt-4|usb-a': 'Thunderbolt/USB-C to USB-A adapter',
  'thunderbolt-4|usb-b': 'Thunderbolt/USB-C to USB-B adapter',
  'thunderbolt-4|usb-c': 'Direct physical connection (USB-C cable)',
  'thunderbolt-4|usb-micro-b': 'Thunderbolt/USB-C to Micro-B adapter',
  'displayport-full|displayport-mini': 'DisplayPort to Mini-DisplayPort adapter',
}

export function getVariantCompatibility(
  v1: ConnectorVariant,
  v2: ConnectorVariant
): { compat: VariantCompat; adapter?: string } {
  if (v1 === v2) return { compat: 'same' }
  const key = [v1, v2].sort().join('|')
  const compat = VARIANT_COMPAT[key] ?? 'incompatible'
  const adapter = compat === 'compatible' ? ADAPTER_DESCRIPTIONS[key] : undefined
  return { compat, adapter }
}
