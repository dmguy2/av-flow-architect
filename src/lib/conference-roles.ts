import type { ConferenceRole } from '@/types/av'

export const CONFERENCE_ROLE_LABELS: Record<ConferenceRole, string> = {
  'far-end-audio-in': 'Far-End Audio In',
  'far-end-audio-out': 'Far-End Audio Out',
  'far-end-video-in': 'Far-End Video In',
  'far-end-video-out': 'Far-End Video Out',
  'content-share-in': 'Content Share In',
  'content-share-out': 'Content Share Out',
  'program-out': 'Program Out',
  'confidence-monitor': 'Confidence Monitor',
}

export const CONFERENCE_ROLE_SHORT: Record<ConferenceRole, string> = {
  'far-end-audio-in': 'FAI',
  'far-end-audio-out': 'FAO',
  'far-end-video-in': 'FVI',
  'far-end-video-out': 'FVO',
  'content-share-in': 'CSI',
  'content-share-out': 'CSO',
  'program-out': 'PGM',
  'confidence-monitor': 'CFM',
}

export const CONFERENCE_ROLE_COLORS: Record<ConferenceRole, string> = {
  'far-end-audio-in': '#06B6D4',
  'far-end-audio-out': '#0891B2',
  'far-end-video-in': '#14B8A6',
  'far-end-video-out': '#0D9488',
  'content-share-in': '#2DD4BF',
  'content-share-out': '#0EA5E9',
  'program-out': '#6366F1',
  'confidence-monitor': '#8B5CF6',
}

export const ALL_CONFERENCE_ROLES: ConferenceRole[] = [
  'far-end-audio-in',
  'far-end-audio-out',
  'far-end-video-in',
  'far-end-video-out',
  'content-share-in',
  'content-share-out',
  'program-out',
  'confidence-monitor',
]
