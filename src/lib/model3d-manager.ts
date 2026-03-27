/**
 * model3d-manager.ts
 *
 * Orchestrates 3D model generation: generate -> poll -> download -> cache.
 * Models are cached in IndexedDB (models3d table) keyed by componentType.
 */

import { db } from '@/db'
import { generate3DModel, poll3DStatus, download3DModel } from '@/lib/threedai-api'
import { log } from '@/lib/logger'

const POLL_INTERVAL = 5_000 // 5 seconds
const MAX_POLLS = 60 // 5 minutes max

/**
 * Get a cached 3D model or generate a new one.
 * Returns an object URL pointing to the GLB/OBJ blob.
 */
export async function getOrGenerate3DModel(
  componentType: string,
  imageDataUri: string,
  prompt?: string,
  onProgress?: (status: string) => void,
): Promise<string> {
  // 1. Check IndexedDB cache
  const cached = await db.models3d.get(componentType)
  if (cached) {
    log('3D', `Cache hit: ${componentType}`)
    onProgress?.('cached')
    return URL.createObjectURL(cached.glbBlob)
  }

  // 2. Submit generation request
  onProgress?.('submitting')
  const taskId = await generate3DModel(imageDataUri, componentType, prompt)

  // 3. Poll until complete
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
    const result = await poll3DStatus(taskId)
    onProgress?.(result.status.toLowerCase())

    if (result.status === 'FINISHED' && result.modelUrl) {
      // 4. Download the model
      onProgress?.('downloading')
      const blob = await download3DModel(result.modelUrl)

      // 5. Cache in IndexedDB
      await db.models3d.put({
        componentType,
        glbBlob: blob,
        generatedAt: Date.now(),
      })

      log('3D', `Cached model: ${componentType}`, `${(blob.size / 1024).toFixed(0)} KB`)
      return URL.createObjectURL(blob)
    }

    if (result.status === 'FAILED') {
      throw new Error(`3D generation failed for ${componentType}`)
    }
  }

  throw new Error(`3D generation timed out for ${componentType} after ${MAX_POLLS * POLL_INTERVAL / 1000}s`)
}

/**
 * Delete a cached model (for regeneration).
 */
export async function deleteCachedModel(componentType: string): Promise<void> {
  await db.models3d.delete(componentType)
  log('3D', `Cache cleared: ${componentType}`)
}
