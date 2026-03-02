import { memo, useState, useRef, useCallback } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import type { AVComponentDef } from '@/types/av'
import { getIcon } from '@/lib/icons'
import { SIGNAL_COLORS } from '@/lib/signal-colors'
import type { ComponentCategory } from '@/types/av'
import { db } from '@/db'
import { componentDefinitions } from '@/data/component-definitions'
import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  audio: SIGNAL_COLORS.audio,
  video: SIGNAL_COLORS.video,
  lighting: SIGNAL_COLORS.network,
  infrastructure: SIGNAL_COLORS.network,
  corporate: '#6B7280',
  software: '#8B5CF6',
}

interface ComponentCardProps {
  def: AVComponentDef
  showImage?: boolean
  deletable?: boolean
  onEdit?: (def: AVComponentDef) => void
}

function ComponentCard({ def, showImage, deletable, onEdit }: ComponentCardProps) {
  const Icon = getIcon(def.icon)
  const catColor = CATEGORY_COLORS[def.category]
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showSpecs, setShowSpecs] = useState(false)
  const hoverTimer = useRef<number | null>(null)

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/av-component', def.type)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    // Remove from IndexedDB
    await db.customComponents.where('type').equals(def.type).delete()
    await db.componentImages.where('typeSlug').equals(def.type).delete().catch(() => {})
    // Remove from in-memory array
    const idx = componentDefinitions.findIndex((c) => c.type === def.type)
    if (idx !== -1) componentDefinitions.splice(idx, 1)
    // Notify listeners
    window.dispatchEvent(new Event('av-components-changed'))
  }

  const handleMouseEnter = useCallback(() => {
    if (def.specs && Object.keys(def.specs).length > 0) {
      hoverTimer.current = window.setTimeout(() => setShowSpecs(true), 1500)
    }
  }, [def.specs])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
    setShowSpecs(false)
    setConfirmDelete(false)
  }, [])

  const inputCount = def.defaultPorts.filter((p) => p.direction === 'input').length
  const outputCount = def.defaultPorts.filter((p) => p.direction === 'output').length
  const bidiCount = def.defaultPorts.filter((p) => p.direction === 'bidirectional').length
  const undefinedCount = def.defaultPorts.filter((p) => p.direction === 'undefined').length

  const hasImage = showImage && def.images && def.images.length > 0

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative rounded-md border border-border bg-card hover:bg-accent hover:-translate-y-px hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-150 group"
    >
      <div className={cn("flex items-center gap-2 px-2 py-1.5", deletable && onEdit ? "pr-12" : deletable ? "pr-7" : "")}>
        {hasImage ? (
          <div className="w-8 h-8 rounded shrink-0 overflow-hidden bg-white border border-border">
            <img
              src={def.images![0]}
              alt={def.label}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div
            className="flex items-center justify-center w-7 h-7 rounded shrink-0"
            style={{ backgroundColor: catColor + '20', color: catColor }}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{def.label}</div>
          {def.manufacturer && (
            <div className="text-[10px] text-muted-foreground truncate">{def.manufacturer}</div>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            {inputCount > 0 && (
              <span className="text-[9px] text-muted-foreground bg-muted px-1 py-px rounded tabular-nums">
                {inputCount}in
              </span>
            )}
            {outputCount > 0 && (
              <span className="text-[9px] text-muted-foreground bg-muted px-1 py-px rounded tabular-nums">
                {outputCount}out
              </span>
            )}
            {bidiCount > 0 && (
              <span className="text-[9px] text-muted-foreground bg-muted px-1 py-px rounded tabular-nums">
                {bidiCount}bi
              </span>
            )}
            {undefinedCount > 0 && (
              <span className="text-[9px] text-muted-foreground bg-muted px-1 py-px rounded tabular-nums">
                {undefinedCount}?
              </span>
            )}
          </div>
        </div>
      </div>
      {deletable && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit(def) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground transition-all"
              title="Edit component"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={handleDelete}
            className={cn(
              'p-1 rounded transition-all',
              confirmDelete
                ? 'bg-destructive/20 text-destructive opacity-100'
                : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive'
            )}
            title={confirmDelete ? 'Click again to confirm' : 'Remove from library'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Specs tooltip — appears after 1.5s hover */}
      {showSpecs && def.specs && (
        <div className="absolute left-full top-0 ml-2 z-50 w-56 max-h-72 overflow-y-auto p-2.5 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
          {Object.entries(def.specs).map(([category, items]) => (
            <div key={category} className="mb-2 last:mb-0">
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {category}
              </div>
              {Object.entries(items).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2 py-px">
                  <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
                  <span className="text-[10px] text-foreground text-right truncate font-medium">{value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(ComponentCard)
