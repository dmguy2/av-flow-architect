/**
 * chain-analysis-api.ts
 *
 * Frontend client for the backend LLM signal chain analysis endpoint.
 */

import type { SignalChain } from './signal-chain'

export interface LLMChainIssue {
  severity: 'error' | 'warning' | 'info'
  category: string
  message: string
  suggestion: string
}

export interface LLMAnalysisResult {
  issues: LLMChainIssue[]
  summary: string
}

export async function analyzeChainWithLLM(
  chain: SignalChain
): Promise<LLMAnalysisResult> {
  const body = {
    chain: chain.path.map((node) => ({
      label: node.label,
      componentType: node.componentType,
      manufacturer: node.manufacturer ?? null,
      model: node.model ?? null,
      inConnector: node.inPort?.connector ?? null,
      inVariant: node.inPort?.variant ?? null,
      outConnector: node.outPort?.connector ?? null,
      outVariant: node.outPort?.variant ?? null,
      powerDraw: node.powerDraw ?? null,
    })),
    context: chain.domain,
  }

  const response = await fetch('/api/analyze-chain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => 'Unknown error')
    throw new Error(`Analysis failed: ${detail}`)
  }

  return response.json()
}
