import { Eye, EyeOff, Focus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useDiagramStore } from '@/store/diagram-store'
import {
  SIGNAL_COLORS,
  SIGNAL_LABELS,
  SIGNAL_DASH_PATTERNS,
  ALL_SIGNAL_DOMAINS,
} from '@/lib/signal-colors'
import type { SignalDomain } from '@/types/av'

function DashPreview({ domain }: { domain: SignalDomain }) {
  const color = SIGNAL_COLORS[domain]
  const dash = SIGNAL_DASH_PATTERNS[domain]

  return (
    <svg width="32" height="8" className="shrink-0">
      <line
        x1="0"
        y1="4"
        x2="32"
        y2="4"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dash || undefined}
      />
    </svg>
  )
}

export default function LayerPanel() {
  const layerVisibility = useDiagramStore((s) => s.layerVisibility)
  const focusedLayer = useDiagramStore((s) => s.focusedLayer)
  const showEdgeLabels = useDiagramStore((s) => s.showEdgeLabels)
  const toggleLayerVisibility = useDiagramStore((s) => s.toggleLayerVisibility)
  const setFocusedLayer = useDiagramStore((s) => s.setFocusedLayer)
  const setShowEdgeLabels = useDiagramStore((s) => s.setShowEdgeLabels)

  return (
    <div className="p-2 space-y-1">
      {ALL_SIGNAL_DOMAINS.map((domain) => {
        const isVisible = layerVisibility[domain]
        const isFocused = focusedLayer === domain
        const color = SIGNAL_COLORS[domain]

        return (
          <div
            key={domain}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            {/* Color swatch */}
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />

            {/* Dash preview */}
            <DashPreview domain={domain} />

            {/* Label */}
            <span className="text-xs font-medium flex-1 truncate">
              {SIGNAL_LABELS[domain]}
            </span>

            {/* Focus button */}
            <Button
              size="icon"
              variant={isFocused ? 'default' : 'ghost'}
              className="h-6 w-6"
              onClick={() => setFocusedLayer(isFocused ? null : domain)}
              title={isFocused ? 'Exit focus mode' : `Focus on ${SIGNAL_LABELS[domain]}`}
            >
              <Focus className="w-3 h-3" />
            </Button>

            {/* Visibility toggle */}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => toggleLayerVisibility(domain)}
              title={isVisible ? `Hide ${SIGNAL_LABELS[domain]}` : `Show ${SIGNAL_LABELS[domain]}`}
            >
              {isVisible ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3 text-muted-foreground" />
              )}
            </Button>
          </div>
        )
      })}

      <Separator className="my-2" />

      {/* Show inline edge labels checkbox */}
      <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md hover:bg-accent transition-colors">
        <input
          type="checkbox"
          checked={showEdgeLabels}
          onChange={(e) => setShowEdgeLabels(e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-xs">Show inline edge labels</span>
      </label>
    </div>
  )
}
