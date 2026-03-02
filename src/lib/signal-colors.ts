import type { SignalDomain } from '@/types/av'

export const SIGNAL_COLORS: Record<SignalDomain, string> = {
  audio: '#3B82F6',
  video: '#22C55E',
  network: '#EAB308',
  power: '#EF4444',
  'av-over-ip': '#A855F7',
}

export const SIGNAL_LABELS: Record<SignalDomain, string> = {
  audio: 'Audio',
  video: 'Video',
  network: 'Network',
  power: 'Power',
  'av-over-ip': 'AV-over-IP',
}

export const SIGNAL_SHORT_LABELS: Record<SignalDomain, string> = {
  audio: 'AUD',
  video: 'VID',
  network: 'NET',
  power: 'PWR',
  'av-over-ip': 'AoIP',
}

export const SIGNAL_DASH_PATTERNS: Record<SignalDomain, string> = {
  audio: '',
  video: '8 4',
  network: '2 3',
  power: '10 4 2 4',
  'av-over-ip': '16 6',
}

export const SIGNAL_Z_ORDER: Record<SignalDomain, number> = {
  power: 0,
  network: 1,
  audio: 2,
  video: 3,
  'av-over-ip': 4,
}

export const ALL_SIGNAL_DOMAINS: SignalDomain[] = ['power', 'network', 'audio', 'video', 'av-over-ip']

export function getSignalColor(domain: SignalDomain): string {
  return SIGNAL_COLORS[domain]
}

export function getSignalDashPattern(domain: SignalDomain): string {
  return SIGNAL_DASH_PATTERNS[domain]
}
