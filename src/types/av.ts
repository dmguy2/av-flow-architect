import type { Node, Edge } from '@xyflow/react'

export type SignalDomain = 'audio' | 'video' | 'network' | 'power' | 'av-over-ip'

export type ConnectorType =
  | 'xlr'
  | 'trs'
  | 'rca'
  | 'hdmi'
  | 'sdi'
  | 'ethernet'
  | 'dante'
  | 'usb'
  | 'speakon'
  | 'powercon'
  | 'dmx'
  | 'fiber'
  | 'aes50'
  | 'ndi'
  | 'wifi'
  | 'thunderbolt'
  | 'db9'
  | 'bnc'
  | 'displayport'
  | 'sd'

export type ConnectorVariant =
  // XLR variants
  | 'xlr-3pin' | 'xlr-5pin' | 'xlr-7pin'
  // TRS variants
  | 'trs-quarter' | 'trs-3.5mm' | 'trs-2.5mm'
  // HDMI variants
  | 'hdmi-full' | 'hdmi-mini' | 'hdmi-micro'
  // Ethernet variants
  | 'ethernet-rj45' | 'ethernet-ethercon'
  // USB variants
  | 'usb-a' | 'usb-b' | 'usb-c' | 'usb-micro-b'
  // Powercon variants
  | 'powercon-20a' | 'powercon-32a' | 'powercon-true1'
  // Speakon variants
  | 'speakon-2pole' | 'speakon-4pole' | 'speakon-8pole'
  // SDI variants
  | 'sdi-bnc' | 'sdi-micro-bnc'
  // Thunderbolt variants
  | 'thunderbolt-3' | 'thunderbolt-4'
  // DB9 variants
  | 'db9-rs422' | 'db9-rs232'
  // BNC variants
  | 'bnc-reference' | 'bnc-composite' | 'bnc-wordclock'
  // DisplayPort variants
  | 'displayport-full' | 'displayport-mini'
  // SD card variants
  | 'sd-full' | 'sd-micro' | 'sd-cfast' | 'sd-cfexpress'

export type PortDirection = 'input' | 'output' | 'bidirectional' | 'undefined'

export type ConferenceRole =
  | 'far-end-audio-in'
  | 'far-end-audio-out'
  | 'far-end-video-in'
  | 'far-end-video-out'
  | 'content-share-in'
  | 'content-share-out'
  | 'program-out'
  | 'confidence-monitor'

export type DeviceRole = 'source' | 'destination' | 'processor' | 'infrastructure'

export interface AVPort {
  id: string
  label: string
  domain: SignalDomain
  connector: ConnectorType
  variant?: ConnectorVariant
  direction: PortDirection
  enabled?: boolean
  conferenceRole?: ConferenceRole
}

export type ComponentCategory = 'audio' | 'video' | 'lighting' | 'infrastructure' | 'corporate' | 'software'

export interface AVComponentDef {
  type: string
  label: string
  category: ComponentCategory
  icon: string
  defaultPorts: AVPort[]
  defaultWidth?: number
  defaultHeight?: number
  manufacturer?: string
  model?: string
  isGeneric?: boolean
  configurableIO?: boolean
  powerDraw?: string
  bhUrl?: string
  images?: string[]
  specs?: Record<string, Record<string, string>>
  deviceRole?: DeviceRole
  importSource?: 'bh' | 'manual'
  importedAt?: number
}

export interface AVNodeData {
  componentType: string
  label: string
  ports: AVPort[]
  model?: string
  notes?: string
  image?: string
  rotation?: number
  manufacturer?: string
  isGenericInstance?: boolean
  configurableIO?: boolean
  powerDraw?: string
  deviceRole?: DeviceRole
  [key: string]: unknown
}

export interface AVEdgeData {
  domain: SignalDomain
  connector: ConnectorType
  variant?: ConnectorVariant
  label?: string
  warning?: string
  [key: string]: unknown
}

export type DiagramMode = 'signal-flow' | 'physical-layout'

export interface ProjectPage {
  id: string
  label: string
  nodes: Node<AVNodeData>[]
  edges: Edge<AVEdgeData>[]
  viewport: { x: number; y: number; zoom: number }
}

export interface OffsheetConnector {
  id: string
  label: string
  signalType: SignalDomain
  sourcePageId: string
  targetPageId: string
}

export interface AVProject {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  mode: DiagramMode
  nodes: Node<AVNodeData>[]
  edges: Edge<AVEdgeData>[]
  viewport: { x: number; y: number; zoom: number }
  layerVisibility?: Record<SignalDomain, boolean>
  focusedLayer?: SignalDomain | null
  showEdgeLabels?: boolean
  pages?: ProjectPage[]
  activePageId?: string
  offsheetConnectors?: OffsheetConnector[]
}
