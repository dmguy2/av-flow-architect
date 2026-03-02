import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDiagramStore } from '@/store/diagram-store'
import { cn } from '@/lib/utils'

export default function PagePanel() {
  const pages = useDiagramStore((s) => s.pages)
  const activePageId = useDiagramStore((s) => s.activePageId)
  const addPage = useDiagramStore((s) => s.addPage)
  const deletePage = useDiagramStore((s) => s.deletePage)
  const renamePage = useDiagramStore((s) => s.renamePage)
  const setActivePage = useDiagramStore((s) => s.setActivePage)

  const nodes = useDiagramStore((s) => s.nodes)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startRename = (pageId: string, currentLabel: string) => {
    setEditingId(pageId)
    setEditValue(currentLabel)
  }

  const confirmRename = () => {
    if (editingId && editValue.trim()) {
      renamePage(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const cancelRename = () => {
    setEditingId(null)
  }

  return (
    <div className="p-2 space-y-1">
      {pages.map((page, idx) => {
        const isActive = page.id === activePageId
        const isEditing = editingId === page.id

        return (
          <div
            key={page.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors group',
              isActive
                ? 'bg-primary/10 text-foreground'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
          >
            {isEditing ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename()
                    if (e.key === 'Escape') cancelRename()
                  }}
                  className="h-6 text-xs flex-1"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={confirmRename}>
                  <Check className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={cancelRename}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                <button
                  className="flex-1 text-left text-xs font-medium truncate min-w-0"
                  onClick={() => setActivePage(page.id)}
                >
                  <span className="text-[10px] text-muted-foreground mr-1.5">{idx + 1}.</span>
                  {page.label}
                </button>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {isActive ? nodes.length : page.nodes.length}
                </span>
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation()
                      startRename(page.id, page.label)
                    }}
                    title="Rename page"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  {pages.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        deletePage(page.id)
                      }}
                      title="Delete page"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs h-7 text-muted-foreground"
        onClick={() => addPage()}
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Page
      </Button>
    </div>
  )
}
