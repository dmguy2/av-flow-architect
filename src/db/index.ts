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

interface Model3DRecord {
  componentType: string
  glbBlob: Blob
  generatedAt: number
}

const db = new Dexie('AVDiagramDB') as Dexie & {
  projects: EntityTable<AVProject, 'id'>
  customComponents: EntityTable<CustomComponentRecord, 'id'>
  componentImages: EntityTable<ComponentImageRecord, 'typeSlug'>
  models3d: EntityTable<Model3DRecord, 'componentType'>
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

db.version(4).stores({
  projects: 'id, name, updatedAt',
  customComponents: '++id, type, category',
  componentImages: 'typeSlug',
  models3d: 'componentType',
})

export { db }
export type { CustomComponentRecord, ComponentImageRecord, Model3DRecord }
