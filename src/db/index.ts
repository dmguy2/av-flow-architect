import Dexie, { type EntityTable } from 'dexie'
import type { AVProject } from '@/types/av'
import type { AVComponentDef } from '@/types/av'

interface CustomComponentRecord extends AVComponentDef {
  id?: number
}

interface ComponentImageRecord {
  typeSlug: string
  images: Blob[]
}

const db = new Dexie('AVDiagramDB') as Dexie & {
  projects: EntityTable<AVProject, 'id'>
  customComponents: EntityTable<CustomComponentRecord, 'id'>
  componentImages: EntityTable<ComponentImageRecord, 'typeSlug'>
}

db.version(1).stores({
  projects: 'id, name, updatedAt',
})

db.version(2).stores({
  projects: 'id, name, updatedAt',
  customComponents: '++id, type, category',
})

db.version(3).stores({
  projects: 'id, name, updatedAt',
  customComponents: '++id, type, category',
  componentImages: 'typeSlug',
})

export { db }
export type { CustomComponentRecord, ComponentImageRecord }
