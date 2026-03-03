/**
 * port-mapper.ts
 *
 * Maps scraped B&H port descriptions (e.g. "1x HDMI Output") to AVPort objects.
 * Uses ordered regex rules to infer connector type, signal domain, and direction.
 */

import type { AVPort, SignalDomain, ConnectorType, PortDirection } from '@/types/av'

// ---------------------------------------------------------------------------
// Connector inference rules (order matters — first match wins)
// ---------------------------------------------------------------------------

interface ConnectorRule {
  pattern: RegExp
  connector: ConnectorType
  domain: SignalDomain
}

const CONNECTOR_RULES: ConnectorRule[] = [
  { pattern: /\bhdmi\b/i, connector: 'hdmi', domain: 'video' },
  { pattern: /\bsdi\b/i, connector: 'sdi', domain: 'video' },
  { pattern: /\bndi\b/i, connector: 'ndi', domain: 'av-over-ip' },
  { pattern: /\bdante\b/i, connector: 'dante', domain: 'av-over-ip' },
  { pattern: /\baes.?50\b/i, connector: 'aes50', domain: 'audio' },
  { pattern: /\bxlr\b/i, connector: 'xlr', domain: 'audio' },
  { pattern: /\btrs\b/i, connector: 'trs', domain: 'audio' },
  { pattern: /\brca\b/i, connector: 'rca', domain: 'audio' },
  { pattern: /\bspeakon\b/i, connector: 'speakon', domain: 'audio' },
  { pattern: /\bdmx\b/i, connector: 'dmx', domain: 'network' },
  { pattern: /\bwi-?fi|wireless|802\.11\b/i, connector: 'wifi', domain: 'network' },
  { pattern: /\bethernet|rj.?45\b/i, connector: 'ethernet', domain: 'network' },
  { pattern: /\bfiber|sfp\b/i, connector: 'fiber', domain: 'network' },
  { pattern: /\bmicrosd|micro.?sd\b/i, connector: 'sd', domain: 'network' },
  { pattern: /\bsd(?:hc|xc)?(?:\s|$)|cfast|cfexpress|compactflash\b/i, connector: 'sd', domain: 'network' },
  { pattern: /\busb\b/i, connector: 'usb', domain: 'video' },
  { pattern: /\bpowercon|iec\b/i, connector: 'powercon', domain: 'power' },
]

// ---------------------------------------------------------------------------
// Direction inference
// ---------------------------------------------------------------------------

function inferDirection(
  description: string,
  specName: string,
  categoryName: string
): PortDirection {
  const combined = `${categoryName} ${specName} ${description}`.toLowerCase()

  // Bidirectional connectors
  if (/\bethernet|rj.?45|usb|dante|ndi\b/i.test(description)) {
    // Unless explicitly labeled as input or output
    if (/\boutput\b/i.test(combined) && !/\binput\b/i.test(combined)) return 'output'
    if (/\binput\b/i.test(combined) && !/\boutput\b/i.test(combined)) return 'input'
    return 'bidirectional'
  }

  if (/\boutput\b/i.test(combined)) return 'output'
  if (/\binput\b/i.test(combined)) return 'input'

  // Default: bidirectional if truly ambiguous
  return 'bidirectional'
}

// ---------------------------------------------------------------------------
// Map a single port description to connector + domain
// ---------------------------------------------------------------------------

interface InferredPort {
  connector: ConnectorType
  domain: SignalDomain
  needsReview: boolean
}

function inferConnector(description: string): InferredPort {
  for (const rule of CONNECTOR_RULES) {
    if (rule.pattern.test(description)) {
      return { connector: rule.connector, domain: rule.domain, needsReview: false }
    }
  }
  // Fallback: ethernet/network, flagged for user review
  return { connector: 'ethernet', domain: 'network', needsReview: true }
}

// ---------------------------------------------------------------------------
// Scraped port structure (from Python scraper)
// ---------------------------------------------------------------------------

export interface ScrapedPortNode {
  qty: number
  port_description: string
}

export interface ScrapedPortCategory {
  [specName: string]: ScrapedPortNode[]
}

export interface ScrapedPorts {
  [categoryName: string]: ScrapedPortCategory
}

// ---------------------------------------------------------------------------
// Main mapping function
// ---------------------------------------------------------------------------

export interface MappedPort extends AVPort {
  needsReview: boolean
  originalDescription: string
}

/**
 * Convert the scraper's nested port structure into a flat array of AVPort objects.
 * Each scraped port with qty N expands into N individual ports with sequential labels.
 */
export function mapScrapedPorts(scrapedPorts: ScrapedPorts): MappedPort[] {
  const result: MappedPort[] = []
  let portIndex = 1

  for (const [categoryName, specs] of Object.entries(scrapedPorts)) {
    for (const [specName, portNodes] of Object.entries(specs)) {
      for (const node of portNodes) {
        const { connector, domain, needsReview } = inferConnector(node.port_description)
        const direction = inferDirection(node.port_description, specName, categoryName)

        for (let i = 0; i < node.qty; i++) {
          const label =
            node.qty > 1
              ? `${node.port_description} ${i + 1}`
              : node.port_description

          result.push({
            id: `port-${portIndex}`,
            label,
            domain,
            connector,
            direction,
            needsReview,
            originalDescription: node.port_description,
          })
          portIndex++
        }
      }
    }
  }

  return result
}
