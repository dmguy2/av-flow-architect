/**
 * bh-api.ts
 *
 * Thin fetch client for the B&H scraper backend.
 */

export interface ScrapedPort {
  qty: number
  label: string
  connector: string
  domain: string
  direction: string
  variant?: string
}

export interface ScrapeResult {
  name: string
  images: string[]   // base64 data URIs
  specs: Record<string, Record<string, string>>
  ports: ScrapedPort[]   // flat list from LLM or regex fallback
  port_source: 'llm' | 'regex'
}

/**
 * Call the local Python scraper backend to fetch B&H product data.
 * The Vite dev server proxies /api/* to http://127.0.0.1:8420.
 */
export async function scrapeProduct(url: string): Promise<ScrapeResult> {
  const response = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Scrape failed (${response.status})`)
  }

  return response.json()
}

/**
 * Tell the backend to shut down Chrome. Call after a batch import finishes.
 */
export async function shutdownDriver(): Promise<void> {
  try {
    await fetch('/api/driver/shutdown', { method: 'POST', signal: AbortSignal.timeout(5000) })
  } catch {
    // Best-effort — Chrome will be cleaned up on server shutdown anyway
  }
}

/**
 * Check if the Python backend is reachable.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Auto-infer component category from product name.
 */
export function inferCategory(name: string): import('@/types/av').ComponentCategory {
  const n = name.toLowerCase()
  if (/mixer|speaker|amplifier|microphone|headphone|audio|xlr|dante|dsp/i.test(n)) return 'audio'
  if (/camera|monitor|switcher|hdmi|sdi|projector|display|video/i.test(n)) return 'video'
  if (/light|dmx|console|fixture|led|wash|spot|moving head/i.test(n)) return 'lighting'
  if (/switch|router|network|rack|power|ups|cable|adapter|hub|dock/i.test(n)) return 'infrastructure'
  return 'video'
}

/**
 * Auto-infer icon from category.
 */
export function inferIcon(category: import('@/types/av').ComponentCategory): string {
  const map: Record<import('@/types/av').ComponentCategory, string> = {
    audio: 'SlidersHorizontal',
    video: 'Monitor',
    lighting: 'Lightbulb',
    infrastructure: 'Network',
    corporate: 'Laptop',
    software: 'Cpu',
  }
  return map[category] || 'BoxSelect'
}
