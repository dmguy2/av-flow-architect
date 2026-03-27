import { useMemo } from 'react'
import { Loader2, Check, X, Box } from 'lucide-react'

interface GenerationOverlayProps {
  statuses: Record<string, string>
}

export default function GenerationOverlay({ statuses }: GenerationOverlayProps) {
  const entries = useMemo(() => Object.entries(statuses), [statuses])

  const readyCount = entries.filter(([, s]) => s === 'ready').length
  const failedCount = entries.filter(([, s]) => s === 'failed').length
  const total = entries.length

  // Hide when all done or nothing to show
  if (total === 0 || readyCount + failedCount === total) return null

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-card/80 backdrop-blur border border-border rounded-lg shadow-lg p-4 pointer-events-auto">
      <div className="flex items-center gap-2 mb-3">
        <Box className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Generating 3D Models</span>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        {readyCount}/{total} complete
      </div>

      <div className="w-full bg-muted rounded-full h-1.5 mb-3">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((readyCount + failedCount) / total) * 100}%` }}
        />
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {entries.map(([compType, status]) => (
          <div key={compType} className="flex items-center gap-2 text-xs">
            {status === 'ready' ? (
              <Check className="w-3 h-3 text-green-500 shrink-0" />
            ) : status === 'failed' ? (
              <X className="w-3 h-3 text-red-500 shrink-0" />
            ) : (
              <Loader2 className="w-3 h-3 text-muted-foreground animate-spin shrink-0" />
            )}
            <span className="truncate text-muted-foreground">{compType}</span>
            <span className="ml-auto text-[10px] text-muted-foreground/60 capitalize shrink-0">
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
