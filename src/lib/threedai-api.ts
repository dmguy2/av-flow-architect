/**
 * threedai-api.ts
 *
 * Thin fetch client for the 3D AI Studio proxy endpoints.
 */

import { log } from '@/lib/logger'

export async function generate3DModel(image: string, componentType: string, prompt?: string): Promise<string> {
  log('3D', `Generating 3D model`, componentType)
  const res = await fetch('/api/3d/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, component_type: componentType, prompt }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = body.detail || `3D generation failed (${res.status})`
    log('3D', `Generation failed: ${err}`, componentType, 'error')
    throw new Error(err)
  }
  const data = await res.json()
  log('3D', `Generation submitted`, `task_id: ${data.task_id}`)
  return data.task_id
}

export async function poll3DStatus(taskId: string): Promise<{ status: string; modelUrl?: string }> {
  const res = await fetch(`/api/3d/status/${taskId}`)
  if (!res.ok) {
    throw new Error(`Status check failed (${res.status})`)
  }
  const data = await res.json()
  return { status: data.status, modelUrl: data.model_url ?? undefined }
}

export async function download3DModel(modelUrl: string): Promise<Blob> {
  log('3D', `Downloading 3D model`)
  const res = await fetch(`/api/3d/download?url=${encodeURIComponent(modelUrl)}`)
  if (!res.ok) {
    throw new Error(`Model download failed (${res.status})`)
  }
  return res.blob()
}

export async function check3DBalance(): Promise<number> {
  const res = await fetch('/api/3d/balance')
  if (!res.ok) throw new Error(`Balance check failed (${res.status})`)
  const data = await res.json()
  return data.credits
}

export async function check3DAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/3d/available')
    if (!res.ok) return false
    const data = await res.json()
    return data.available === true
  } catch {
    return false
  }
}
