import type { AVComponentDef } from '@/types/av'
import { realGearDefinitions } from './real-gear-definitions'

const genericDefinitions: AVComponentDef[] = [
  // ─── Audio ───
  {
    type: 'mixer',
    label: 'Mixing Console',
    category: 'audio',
    icon: 'SlidersHorizontal',
    deviceRole: 'processor',
    defaultPorts: [
      { id: 'in-1', label: 'Ch 1', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-2', label: 'Ch 2', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-3', label: 'Ch 3', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-4', label: 'Ch 4', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'out-main-l', label: 'Main L', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'out-main-r', label: 'Main R', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'out-aux-1', label: 'Aux 1', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'out-aux-2', label: 'Aux 2', domain: 'audio', connector: 'xlr', direction: 'output' },
    ],
  },
  {
    type: 'speaker',
    label: 'Speaker',
    category: 'audio',
    icon: 'Speaker',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'speakon', direction: 'input' },
      { id: 'out-1', label: 'Thru', domain: 'audio', connector: 'speakon', direction: 'output' },
    ],
  },
  {
    type: 'subwoofer',
    label: 'Subwoofer',
    category: 'audio',
    icon: 'Speaker',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'speakon', direction: 'input' },
      { id: 'out-1', label: 'Thru', domain: 'audio', connector: 'speakon', direction: 'output' },
    ],
  },
  {
    type: 'microphone',
    label: 'Microphone',
    category: 'audio',
    icon: 'Mic',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'out-1', label: 'Output', domain: 'audio', connector: 'xlr', direction: 'output' },
    ],
  },
  {
    type: 'wireless-mic',
    label: 'Wireless Mic',
    category: 'audio',
    icon: 'Radio',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'out-1', label: 'Output', domain: 'audio', connector: 'xlr', direction: 'output' },
    ],
  },
  {
    type: 'di-box',
    label: 'DI Box',
    category: 'audio',
    icon: 'BoxSelect',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'trs', direction: 'input' },
      { id: 'out-1', label: 'Output', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'thru-1', label: 'Thru', domain: 'audio', connector: 'trs', direction: 'output' },
    ],
  },
  {
    type: 'amplifier',
    label: 'Power Amplifier',
    category: 'audio',
    icon: 'Zap',
    deviceRole: 'processor',
    defaultPorts: [
      { id: 'in-1', label: 'Input A', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-2', label: 'Input B', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'out-1', label: 'Output A', domain: 'audio', connector: 'speakon', direction: 'output' },
      { id: 'out-2', label: 'Output B', domain: 'audio', connector: 'speakon', direction: 'output' },
    ],
  },
  {
    type: 'dsp',
    label: 'DSP Processor',
    category: 'audio',
    icon: 'Cpu',
    deviceRole: 'processor',
    defaultPorts: [
      { id: 'in-1', label: 'Input 1', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-2', label: 'Input 2', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-3', label: 'Input 3', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-4', label: 'Input 4', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'out-1', label: 'Output 1', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'out-2', label: 'Output 2', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'out-3', label: 'Output 3', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'out-4', label: 'Output 4', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'net-1', label: 'Network', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
    ],
  },
  {
    type: 'stage-box',
    label: 'Stage Box',
    category: 'audio',
    icon: 'LayoutGrid',
    deviceRole: 'infrastructure',
    defaultPorts: [
      { id: 'in-1', label: 'Input 1', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-2', label: 'Input 2', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-3', label: 'Input 3', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-4', label: 'Input 4', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-5', label: 'Input 5', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-6', label: 'Input 6', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-7', label: 'Input 7', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-8', label: 'Input 8', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'out-1', label: 'Snake Out', domain: 'audio', connector: 'ethernet', direction: 'output' },
    ],
  },
  {
    type: 'monitor-wedge',
    label: 'Monitor Wedge',
    category: 'audio',
    icon: 'TriangleRight',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'xlr', direction: 'input' },
    ],
  },
  {
    type: 'iem-transmitter',
    label: 'IEM Transmitter',
    category: 'audio',
    icon: 'Headphones',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'xlr', direction: 'input' },
    ],
  },
  {
    type: 'eq',
    label: 'Equalizer',
    category: 'audio',
    icon: 'BarChart3',
    deviceRole: 'processor',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'out-1', label: 'Output', domain: 'audio', connector: 'xlr', direction: 'output' },
    ],
  },
  {
    type: 'compressor',
    label: 'Compressor',
    category: 'audio',
    icon: 'Gauge',
    deviceRole: 'processor',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'out-1', label: 'Output', domain: 'audio', connector: 'xlr', direction: 'output' },
    ],
  },

  // ─── Video ───
  {
    type: 'camera',
    label: 'Camera',
    category: 'video',
    icon: 'Camera',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'out-sdi', label: 'SDI Out', domain: 'video', connector: 'sdi', direction: 'output' },
      { id: 'out-hdmi', label: 'HDMI Out', domain: 'video', connector: 'hdmi', direction: 'output' },
    ],
  },
  {
    type: 'display',
    label: 'Display / TV',
    category: 'video',
    icon: 'Monitor',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-hdmi', label: 'HDMI In', domain: 'video', connector: 'hdmi', direction: 'input' },
    ],
  },
  {
    type: 'projector',
    label: 'Projector',
    category: 'video',
    icon: 'Projector',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-hdmi', label: 'HDMI In', domain: 'video', connector: 'hdmi', direction: 'input' },
      { id: 'in-sdi', label: 'SDI In', domain: 'video', connector: 'sdi', direction: 'input' },
    ],
  },
  {
    type: 'video-switcher',
    label: 'Video Switcher',
    category: 'video',
    icon: 'Merge',
    deviceRole: 'processor',
    defaultPorts: [
      { id: 'in-1', label: 'Input 1', domain: 'video', connector: 'hdmi', direction: 'input' },
      { id: 'in-2', label: 'Input 2', domain: 'video', connector: 'hdmi', direction: 'input' },
      { id: 'in-3', label: 'Input 3', domain: 'video', connector: 'sdi', direction: 'input' },
      { id: 'out-pgm', label: 'PGM Out', domain: 'video', connector: 'hdmi', direction: 'output' },
      { id: 'out-aux', label: 'Aux Out', domain: 'video', connector: 'sdi', direction: 'output' },
    ],
  },
  {
    type: 'media-player',
    label: 'Media Player',
    category: 'video',
    icon: 'Play',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'out-hdmi', label: 'HDMI Out', domain: 'video', connector: 'hdmi', direction: 'output' },
      { id: 'out-audio', label: 'Audio Out', domain: 'audio', connector: 'rca', direction: 'output' },
    ],
  },
  {
    type: 'video-bar',
    label: 'Video Bar',
    category: 'video',
    icon: 'MonitorSpeaker',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-hdmi', label: 'HDMI In', domain: 'video', connector: 'hdmi', direction: 'input' },
      { id: 'in-usb', label: 'USB', domain: 'network', connector: 'usb', direction: 'bidirectional' },
      { id: 'out-audio', label: 'Audio Out', domain: 'audio', connector: 'trs', direction: 'output' },
    ],
  },
  {
    type: 'capture-card',
    label: 'Capture Card',
    category: 'video',
    icon: 'HardDrive',
    deviceRole: 'processor',
    defaultPorts: [
      { id: 'in-hdmi', label: 'HDMI In', domain: 'video', connector: 'hdmi', direction: 'input' },
      { id: 'out-usb', label: 'USB Out', domain: 'network', connector: 'usb', direction: 'output' },
    ],
  },

  // ─── Lighting ───
  {
    type: 'lighting-console',
    label: 'Lighting Console',
    category: 'lighting',
    icon: 'SlidersHorizontal',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'out-dmx-1', label: 'DMX 1', domain: 'network', connector: 'dmx', direction: 'output' },
      { id: 'out-dmx-2', label: 'DMX 2', domain: 'network', connector: 'dmx', direction: 'output' },
      { id: 'net-1', label: 'Network', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
    ],
  },
  {
    type: 'moving-head',
    label: 'Moving Head',
    category: 'lighting',
    icon: 'Lightbulb',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-dmx', label: 'DMX In', domain: 'network', connector: 'dmx', direction: 'input' },
      { id: 'out-dmx', label: 'DMX Thru', domain: 'network', connector: 'dmx', direction: 'output' },
      { id: 'in-power', label: 'Power', domain: 'power', connector: 'powercon', direction: 'input' },
    ],
  },
  {
    type: 'par-can',
    label: 'PAR Can',
    category: 'lighting',
    icon: 'Sun',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-dmx', label: 'DMX In', domain: 'network', connector: 'dmx', direction: 'input' },
      { id: 'out-dmx', label: 'DMX Thru', domain: 'network', connector: 'dmx', direction: 'output' },
      { id: 'in-power', label: 'Power', domain: 'power', connector: 'powercon', direction: 'input' },
    ],
  },
  {
    type: 'led-strip',
    label: 'LED Strip',
    category: 'lighting',
    icon: 'Sparkles',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-dmx', label: 'DMX In', domain: 'network', connector: 'dmx', direction: 'input' },
      { id: 'in-power', label: 'Power', domain: 'power', connector: 'powercon', direction: 'input' },
    ],
  },
  {
    type: 'dmx-splitter',
    label: 'DMX Splitter',
    category: 'lighting',
    icon: 'Split',
    deviceRole: 'infrastructure',
    defaultPorts: [
      { id: 'in-dmx', label: 'DMX In', domain: 'network', connector: 'dmx', direction: 'input' },
      { id: 'out-1', label: 'Out 1', domain: 'network', connector: 'dmx', direction: 'output' },
      { id: 'out-2', label: 'Out 2', domain: 'network', connector: 'dmx', direction: 'output' },
      { id: 'out-3', label: 'Out 3', domain: 'network', connector: 'dmx', direction: 'output' },
      { id: 'out-4', label: 'Out 4', domain: 'network', connector: 'dmx', direction: 'output' },
    ],
  },

  // ─── Infrastructure ───
  {
    type: 'network-switch',
    label: 'Network Switch',
    category: 'infrastructure',
    icon: 'Network',
    deviceRole: 'infrastructure',
    defaultPorts: [
      { id: 'port-1', label: 'Port 1', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
      { id: 'port-2', label: 'Port 2', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
      { id: 'port-3', label: 'Port 3', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
      { id: 'port-4', label: 'Port 4', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
    ],
  },
  {
    type: 'dante-interface',
    label: 'Dante Interface',
    category: 'infrastructure',
    icon: 'Wifi',
    deviceRole: 'infrastructure',
    defaultPorts: [
      { id: 'in-1', label: 'Analog In 1', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'in-2', label: 'Analog In 2', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'out-1', label: 'Analog Out 1', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'out-2', label: 'Analog Out 2', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'net-pri', label: 'Primary', domain: 'av-over-ip', connector: 'dante', direction: 'bidirectional' },
      { id: 'net-sec', label: 'Secondary', domain: 'av-over-ip', connector: 'dante', direction: 'bidirectional' },
    ],
  },
  {
    type: 'power-distro',
    label: 'Power Distribution',
    category: 'infrastructure',
    icon: 'Plug',
    deviceRole: 'infrastructure',
    defaultPorts: [
      { id: 'in-power', label: 'Mains In', domain: 'power', connector: 'powercon', direction: 'input' },
      { id: 'out-1', label: 'Out 1', domain: 'power', connector: 'powercon', direction: 'output' },
      { id: 'out-2', label: 'Out 2', domain: 'power', connector: 'powercon', direction: 'output' },
      { id: 'out-3', label: 'Out 3', domain: 'power', connector: 'powercon', direction: 'output' },
      { id: 'out-4', label: 'Out 4', domain: 'power', connector: 'powercon', direction: 'output' },
    ],
  },
  {
    type: 'patch-panel',
    label: 'Patch Panel',
    category: 'infrastructure',
    icon: 'LayoutGrid',
    deviceRole: 'infrastructure',
    defaultPorts: [
      { id: 'port-1', label: 'Port 1', domain: 'audio', connector: 'xlr', direction: 'bidirectional' },
      { id: 'port-2', label: 'Port 2', domain: 'audio', connector: 'xlr', direction: 'bidirectional' },
      { id: 'port-3', label: 'Port 3', domain: 'audio', connector: 'xlr', direction: 'bidirectional' },
      { id: 'port-4', label: 'Port 4', domain: 'audio', connector: 'xlr', direction: 'bidirectional' },
    ],
  },

  // ─── Offsheet ───
  {
    type: 'offsheet-connector',
    label: 'Offsheet Connector',
    category: 'infrastructure',
    icon: 'FileOutput',
    deviceRole: 'infrastructure',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'xlr', direction: 'input' },
      { id: 'out-1', label: 'Output', domain: 'audio', connector: 'xlr', direction: 'output' },
    ],
  },

  // ─── Corporate ───
  {
    type: 'laptop',
    label: 'Laptop',
    category: 'corporate',
    icon: 'Laptop',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'out-hdmi', label: 'HDMI Out', domain: 'video', connector: 'hdmi', direction: 'output' },
      { id: 'out-usb', label: 'USB', domain: 'network', connector: 'usb', direction: 'bidirectional' },
      { id: 'out-audio', label: 'Audio Out', domain: 'audio', connector: 'trs', direction: 'output' },
    ],
  },
  {
    type: 'ceiling-mic',
    label: 'Ceiling Microphone',
    category: 'corporate',
    icon: 'Mic',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'out-1', label: 'Output', domain: 'audio', connector: 'xlr', direction: 'output' },
      { id: 'net-1', label: 'Network', domain: 'av-over-ip', connector: 'dante', direction: 'bidirectional' },
    ],
  },
  {
    type: 'ceiling-speaker',
    label: 'Ceiling Speaker',
    category: 'corporate',
    icon: 'Speaker',
    deviceRole: 'destination',
    defaultPorts: [
      { id: 'in-1', label: 'Input', domain: 'audio', connector: 'speakon', direction: 'input' },
    ],
  },
  {
    type: 'touch-panel',
    label: 'Touch Panel',
    category: 'corporate',
    icon: 'Tablet',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'net-1', label: 'Network', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
    ],
  },

  // ─── Software — Remote Participants ───
  {
    type: 'remote-participant',
    label: 'Remote Participant',
    category: 'software',
    icon: 'UserCircle',
    deviceRole: 'processor',
    defaultPorts: [
      { id: 'out-video', label: 'Camera Feed', domain: 'video', connector: 'ndi', direction: 'output' },
      { id: 'out-audio', label: 'Mic Audio', domain: 'audio', connector: 'ndi', direction: 'output' },
      { id: 'in-video', label: 'Room Video', domain: 'video', connector: 'ndi', direction: 'input' },
      { id: 'in-audio', label: 'Room Audio', domain: 'audio', connector: 'ndi', direction: 'input' },
      { id: 'net-1', label: 'Network', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
    ],
  },
  {
    type: 'tablet-control',
    label: 'Tablet Control App',
    category: 'software',
    icon: 'Tablet',
    deviceRole: 'source',
    defaultPorts: [
      { id: 'wifi-1', label: 'Wi-Fi', domain: 'network', connector: 'wifi', direction: 'bidirectional' },
    ],
  },

  // ─── Infrastructure — Wireless ───
  {
    type: 'wireless-ap',
    label: 'Wireless Router / AP',
    category: 'infrastructure',
    icon: 'Wifi',
    deviceRole: 'infrastructure',
    defaultPorts: [
      { id: 'eth-1', label: 'LAN 1', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
      { id: 'eth-2', label: 'LAN 2', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
      { id: 'eth-wan', label: 'WAN', domain: 'network', connector: 'ethernet', direction: 'bidirectional' },
      { id: 'wifi-1', label: 'Wi-Fi', domain: 'network', connector: 'wifi', direction: 'bidirectional' },
    ],
  },
]

export const componentDefinitions: AVComponentDef[] = [
  ...genericDefinitions,
  ...realGearDefinitions,
]

export function getComponentDef(type: string): AVComponentDef | undefined {
  return componentDefinitions.find((c) => c.type === type)
}

export function getComponentsByCategory(category: string): AVComponentDef[] {
  return componentDefinitions.filter((c) => c.category === category)
}

export function searchComponents(query: string): AVComponentDef[] {
  const q = query.toLowerCase()
  return componentDefinitions.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.manufacturer && c.manufacturer.toLowerCase().includes(q)) ||
      (c.model && c.model.toLowerCase().includes(q))
  )
}
