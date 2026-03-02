import type { Node, Edge } from '@xyflow/react'
import type { AVNodeData, AVEdgeData } from '@/types/av'
import { getComponentDef } from './component-definitions'
import type { AVPort } from '@/types/av'

interface Template {
  id: string
  name: string
  description: string
  icon: string
  nodes: Node<AVNodeData>[]
  edges: Edge<AVEdgeData>[]
}

function makeNode(
  id: string,
  componentType: string,
  x: number,
  y: number,
  overrides?: Partial<AVNodeData>
): Node<AVNodeData> {
  const def = getComponentDef(componentType)!
  return {
    id,
    type: 'signalFlow',
    position: { x, y },
    data: {
      componentType,
      label: overrides?.label ?? def.label,
      ports: def.defaultPorts.map((p: AVPort) => ({ ...p })),
      model: overrides?.model,
      ...overrides,
    },
  }
}

function makeEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  domain: 'audio' | 'video' | 'network' | 'power' | 'av-over-ip' = 'audio',
  connector: string = 'xlr'
): Edge<AVEdgeData> {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'avEdge',
    data: { domain, connector: connector as AVEdgeData['connector'] },
  }
}

export const templates: Template[] = [
  {
    id: 'conference-room',
    name: 'Conference Room',
    description: 'Display, video bar, DSP, ceiling mics, ceiling speakers',
    icon: 'Monitor',
    nodes: [
      makeNode('n1', 'display', 400, 0, { label: 'Main Display', model: '75" Display' }),
      makeNode('n2', 'video-bar', 400, 150, { label: 'Video Bar', model: 'Poly Studio' }),
      makeNode('n3', 'dsp', 400, 320, { label: 'DSP', model: 'Biamp TesiraFORTE' }),
      makeNode('n4', 'ceiling-mic', 100, 200, { label: 'Ceiling Mic L' }),
      makeNode('n5', 'ceiling-mic', 100, 320, { label: 'Ceiling Mic R' }),
      makeNode('n6', 'ceiling-speaker', 700, 200, { label: 'Ceiling Spk L' }),
      makeNode('n7', 'ceiling-speaker', 700, 320, { label: 'Ceiling Spk R' }),
      makeNode('n8', 'laptop', 100, 50, { label: 'Presenter Laptop' }),
      makeNode('n9', 'network-switch', 400, 500, { label: 'Room Switch' }),
    ],
    edges: [
      makeEdge('e1', 'n8', 'out-hdmi', 'n2', 'in-hdmi', 'video', 'hdmi'),
      makeEdge('e2', 'n2', 'out-audio', 'n3', 'in-1', 'audio', 'trs'),
      makeEdge('e3', 'n4', 'out-1', 'n3', 'in-1', 'audio', 'xlr'),
      makeEdge('e4', 'n5', 'out-1', 'n3', 'in-2', 'audio', 'xlr'),
      makeEdge('e5', 'n3', 'out-1', 'n6', 'in-1', 'audio', 'speakon'),
      makeEdge('e6', 'n3', 'out-2', 'n7', 'in-1', 'audio', 'speakon'),
      makeEdge('e7', 'n3', 'net-1', 'n9', 'port-1', 'network', 'ethernet'),
    ],
  },
  {
    id: 'live-band',
    name: 'Live Band Stage Plot',
    description: 'Mics, DI boxes, monitor wedges, FOH console',
    icon: 'Mic',
    nodes: [
      makeNode('n1', 'mixer', 400, 500, { label: 'FOH Console', model: 'Yamaha CL5' }),
      makeNode('n2', 'stage-box', 400, 300, { label: 'Stage Box', model: '32ch Digital Snake' }),
      makeNode('n3', 'microphone', 50, 50, { label: 'Vocal Mic 1', model: 'SM58' }),
      makeNode('n4', 'microphone', 50, 150, { label: 'Vocal Mic 2', model: 'SM58' }),
      makeNode('n5', 'microphone', 250, 50, { label: 'Drum OH L', model: 'SM81' }),
      makeNode('n6', 'microphone', 250, 150, { label: 'Snare Mic', model: 'SM57' }),
      makeNode('n7', 'di-box', 500, 50, { label: 'Bass DI' }),
      makeNode('n8', 'di-box', 500, 150, { label: 'Keys DI' }),
      makeNode('n9', 'monitor-wedge', 150, 300, { label: 'Mon Wedge 1' }),
      makeNode('n10', 'monitor-wedge', 650, 300, { label: 'Mon Wedge 2' }),
      makeNode('n11', 'speaker', 700, 500, { label: 'Main L', model: 'JBL VTX' }),
      makeNode('n12', 'speaker', 700, 620, { label: 'Main R', model: 'JBL VTX' }),
      makeNode('n13', 'subwoofer', 700, 740, { label: 'Subs', model: 'JBL S28' }),
      makeNode('n14', 'amplifier', 550, 650, { label: 'Amp Rack' }),
    ],
    edges: [
      makeEdge('e1', 'n3', 'out-1', 'n2', 'in-1', 'audio', 'xlr'),
      makeEdge('e2', 'n4', 'out-1', 'n2', 'in-2', 'audio', 'xlr'),
      makeEdge('e3', 'n5', 'out-1', 'n2', 'in-3', 'audio', 'xlr'),
      makeEdge('e4', 'n6', 'out-1', 'n2', 'in-4', 'audio', 'xlr'),
      makeEdge('e5', 'n7', 'out-1', 'n2', 'in-3', 'audio', 'xlr'),
      makeEdge('e6', 'n2', 'out-1', 'n1', 'in-1', 'audio', 'ethernet'),
      makeEdge('e7', 'n1', 'out-main-l', 'n14', 'in-1', 'audio', 'xlr'),
      makeEdge('e8', 'n1', 'out-main-r', 'n14', 'in-2', 'audio', 'xlr'),
      makeEdge('e9', 'n14', 'out-1', 'n11', 'in-1', 'audio', 'speakon'),
      makeEdge('e10', 'n14', 'out-2', 'n12', 'in-1', 'audio', 'speakon'),
      makeEdge('e11', 'n1', 'out-aux-1', 'n9', 'in-1', 'audio', 'xlr'),
      makeEdge('e12', 'n1', 'out-aux-2', 'n10', 'in-1', 'audio', 'xlr'),
    ],
  },
  {
    id: 'corporate-presentation',
    name: 'Corporate Presentation',
    description: 'Projector, laptop, wireless mic, speakers',
    icon: 'Projector',
    nodes: [
      makeNode('n1', 'laptop', 50, 100, { label: 'Presenter Laptop' }),
      makeNode('n2', 'wireless-mic', 50, 250, { label: 'Wireless Lapel' }),
      makeNode('n3', 'video-switcher', 300, 150, { label: 'Switcher', model: 'ATEM Mini' }),
      makeNode('n4', 'projector', 550, 50, { label: 'Projector', model: 'Epson EB-L250F' }),
      makeNode('n5', 'dsp', 300, 320, { label: 'DSP' }),
      makeNode('n6', 'speaker', 550, 280, { label: 'Speaker L' }),
      makeNode('n7', 'speaker', 550, 380, { label: 'Speaker R' }),
    ],
    edges: [
      makeEdge('e1', 'n1', 'out-hdmi', 'n3', 'in-1', 'video', 'hdmi'),
      makeEdge('e2', 'n3', 'out-pgm', 'n4', 'in-hdmi', 'video', 'hdmi'),
      makeEdge('e3', 'n2', 'out-1', 'n5', 'in-1', 'audio', 'xlr'),
      makeEdge('e4', 'n5', 'out-1', 'n6', 'in-1', 'audio', 'speakon'),
      makeEdge('e5', 'n5', 'out-2', 'n7', 'in-1', 'audio', 'speakon'),
    ],
  },
  {
    id: 'house-of-worship',
    name: 'House of Worship',
    description: 'FOH console, stage monitors, broadcast split, livestream',
    icon: 'Radio',
    nodes: [
      makeNode('n1', 'mixer', 300, 400, { label: 'FOH Console', model: 'Allen & Heath dLive' }),
      makeNode('n2', 'stage-box', 300, 200, { label: 'Stage Box' }),
      makeNode('n3', 'microphone', 50, 50, { label: 'Pastor Mic' }),
      makeNode('n4', 'microphone', 50, 150, { label: 'Choir Mic L' }),
      makeNode('n5', 'microphone', 50, 250, { label: 'Choir Mic R' }),
      makeNode('n6', 'speaker', 600, 350, { label: 'Main L' }),
      makeNode('n7', 'speaker', 600, 450, { label: 'Main R' }),
      makeNode('n8', 'monitor-wedge', 600, 200, { label: 'Stage Mon' }),
      makeNode('n9', 'capture-card', 600, 570, { label: 'Stream Encoder' }),
      makeNode('n10', 'camera', 50, 400, { label: 'PTZ Camera' }),
      makeNode('n11', 'video-switcher', 300, 570, { label: 'Video Switcher' }),
    ],
    edges: [
      makeEdge('e1', 'n3', 'out-1', 'n2', 'in-1', 'audio', 'xlr'),
      makeEdge('e2', 'n4', 'out-1', 'n2', 'in-2', 'audio', 'xlr'),
      makeEdge('e3', 'n5', 'out-1', 'n2', 'in-3', 'audio', 'xlr'),
      makeEdge('e4', 'n2', 'out-1', 'n1', 'in-1', 'audio', 'ethernet'),
      makeEdge('e5', 'n1', 'out-main-l', 'n6', 'in-1', 'audio', 'speakon'),
      makeEdge('e6', 'n1', 'out-main-r', 'n7', 'in-1', 'audio', 'speakon'),
      makeEdge('e7', 'n1', 'out-aux-1', 'n8', 'in-1', 'audio', 'xlr'),
      makeEdge('e8', 'n10', 'out-hdmi', 'n11', 'in-1', 'video', 'hdmi'),
      makeEdge('e9', 'n11', 'out-pgm', 'n9', 'in-hdmi', 'video', 'hdmi'),
    ],
  },
  {
    id: 'festival-stage',
    name: 'Festival Stage',
    description: 'FOH, monitor world, stage boxes, PA hangs, subs',
    icon: 'Speaker',
    nodes: [
      makeNode('n1', 'mixer', 400, 600, { label: 'FOH Console', model: 'DiGiCo SD12' }),
      makeNode('n2', 'mixer', 100, 400, { label: 'Monitor Console', model: 'Yamaha PM5D' }),
      makeNode('n3', 'stage-box', 400, 200, { label: 'Stage Box A' }),
      makeNode('n4', 'stage-box', 400, 350, { label: 'Stage Box B' }),
      makeNode('n5', 'microphone', 100, 50, { label: 'Drum Kit Mics' }),
      makeNode('n6', 'microphone', 250, 50, { label: 'Guitar Mics' }),
      makeNode('n7', 'di-box', 550, 50, { label: 'Bass / Keys DI' }),
      makeNode('n8', 'speaker', 700, 400, { label: 'Main PA L' }),
      makeNode('n9', 'speaker', 700, 500, { label: 'Main PA R' }),
      makeNode('n10', 'subwoofer', 700, 620, { label: 'Sub Array' }),
      makeNode('n11', 'monitor-wedge', 100, 150, { label: 'Mon 1' }),
      makeNode('n12', 'monitor-wedge', 250, 150, { label: 'Mon 2' }),
      makeNode('n13', 'iem-transmitter', 550, 150, { label: 'IEM TX' }),
      makeNode('n14', 'amplifier', 550, 500, { label: 'Main Amps' }),
      makeNode('n15', 'network-switch', 400, 450, { label: 'FOH Switch' }),
    ],
    edges: [
      makeEdge('e1', 'n5', 'out-1', 'n3', 'in-1', 'audio', 'xlr'),
      makeEdge('e2', 'n6', 'out-1', 'n3', 'in-2', 'audio', 'xlr'),
      makeEdge('e3', 'n7', 'out-1', 'n3', 'in-3', 'audio', 'xlr'),
      makeEdge('e4', 'n3', 'out-1', 'n15', 'port-1', 'network', 'ethernet'),
      makeEdge('e5', 'n4', 'out-1', 'n15', 'port-2', 'network', 'ethernet'),
      makeEdge('e6', 'n15', 'port-3', 'n1', 'in-1', 'network', 'ethernet'),
      makeEdge('e7', 'n15', 'port-4', 'n2', 'in-1', 'network', 'ethernet'),
      makeEdge('e8', 'n1', 'out-main-l', 'n14', 'in-1', 'audio', 'xlr'),
      makeEdge('e9', 'n1', 'out-main-r', 'n14', 'in-2', 'audio', 'xlr'),
      makeEdge('e10', 'n14', 'out-1', 'n8', 'in-1', 'audio', 'speakon'),
      makeEdge('e11', 'n14', 'out-2', 'n9', 'in-1', 'audio', 'speakon'),
      makeEdge('e12', 'n2', 'out-aux-1', 'n11', 'in-1', 'audio', 'xlr'),
      makeEdge('e13', 'n2', 'out-aux-2', 'n12', 'in-1', 'audio', 'xlr'),
      makeEdge('e14', 'n2', 'out-main-l', 'n13', 'in-1', 'audio', 'xlr'),
    ],
  },
]
