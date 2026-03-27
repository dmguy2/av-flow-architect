import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Undo2, Redo2, Moon, Sun, Cable, Save, Group, Copy, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, AlignCenterHorizontal, AlignCenterVertical, Activity, Image, Box, Keyboard, Zap, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ExportMenu from './ExportMenu'
import CustomComponentDialog from './CustomComponentDialog'
import ProjectManager from './ProjectManager'
import { useDiagramStore } from '@/store/diagram-store'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl+'

const SHORTCUT_GROUPS = [
  {
    label: 'General',
    shortcuts: [
      { keys: `${MOD}S`, action: 'Save project' },
      { keys: `${MOD}Z`, action: 'Undo' },
      { keys: `${MOD}⇧Z`, action: 'Redo' },
      { keys: `${MOD}F`, action: 'Find device' },
      { keys: '?', action: 'Show keyboard shortcuts' },
    ],
  },
  {
    label: 'Selection & Editing',
    shortcuts: [
      { keys: `${MOD}A`, action: 'Select all' },
      { keys: `${MOD}C`, action: 'Copy selected' },
      { keys: `${MOD}V`, action: 'Paste' },
      { keys: `${MOD}D`, action: 'Duplicate selected' },
      { keys: `${MOD}G`, action: 'Group selected nodes' },
      { keys: 'Delete', action: 'Delete selected' },
      { keys: 'Escape', action: 'Deselect all' },
      { keys: 'Double-click', action: 'Edit node/edge label' },
    ],
  },
  {
    label: 'Canvas',
    shortcuts: [
      { keys: 'Right-click', action: 'Context menu' },
      { keys: 'Scroll', action: 'Zoom in/out' },
      { keys: 'Click + drag', action: 'Pan canvas' },
    ],
  },
]

export default function Toolbar() {
  const {
    projectName,
    setProjectName,
    setMode,
    darkMode,
    setDarkMode,
    undo,
    redo,
    past,
    future,
    saveProject,
    nodes,
    edges,
    isDirty,
    groupSelectedNodes,
    duplicateSelected,
    alignNodes,
    distributeNodes,
    copySelected,
    pasteClipboard,
    selectAll,
    showSignalChainPanel,
    setShowSignalChainPanel,
    runSignalChainAnalysis,
    chainIssues,
    viewMode,
    setViewMode,
  } = useDiagramStore()

  const selectedCount = nodes.filter((n) => n.selected && n.type !== 'group').length
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const focusNode = useDiagramStore((s) => s.focusNode)

  // Total system power draw
  const totalPowerW = useMemo(() => {
    let total = 0
    for (const node of nodes) {
      const pd = node.data.powerDraw
      if (!pd) continue
      const match = pd.match(/(\d+(?:\.\d+)?)\s*[Ww]/)
      if (match) total += parseFloat(match[1])
    }
    return total
  }, [nodes])

  // Node search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return nodes
      .filter((n) => n.type !== 'group' && (
        n.data.label.toLowerCase().includes(q) ||
        n.data.componentType.toLowerCase().includes(q) ||
        (n.data.manufacturer && n.data.manufacturer.toLowerCase().includes(q)) ||
        (n.data.model && n.data.model.toLowerCase().includes(q))
      ))
      .slice(0, 8)
  }, [searchQuery, nodes])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveProject()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        groupSelectedNodes()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        duplicateSelected()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        // Only handle if not in a text input
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault()
          copySelected()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault()
          pasteClipboard()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault()
          selectAll()
        }
      }
      if (e.key === '?' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setShowShortcuts(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
        setSearchQuery('')
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false)
        } else if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          // Deselect all nodes and edges
          const s = useDiagramStore.getState()
          if (s.selectedNodeId || s.selectedEdgeId) {
            s.setSelectedNode(null)
            s.setSelectedEdge(null)
          }
        }
      }
    },
    [undo, redo, saveProject, groupSelectedNodes, duplicateSelected, copySelected, pasteClipboard, selectAll, showSearch]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Auto-save debounced
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      saveProject()
    }, 1000)
    return () => clearTimeout(timer)
  }, [nodes, edges, isDirty, saveProject])

  // Auto-run signal chain analysis when connections change (debounced)
  const edgeFingerprint = useMemo(
    () => edges.map((e) => `${e.source}:${e.sourceHandle}-${e.target}:${e.targetHandle}`).sort().join('|'),
    [edges]
  )
  useEffect(() => {
    if (edges.length === 0 && nodes.length === 0) return
    const timer = setTimeout(() => {
      runSignalChainAnalysis()
    }, 800)
    return () => clearTimeout(timer)
    // Only re-run when the actual connection topology changes, not on every edge/node prop change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeFingerprint, nodes.length])

  // Init dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="relative h-11 border-b border-border bg-card flex items-center px-3 gap-1.5 shrink-0">
      {/* Project name */}
      <Input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="w-44 h-7 text-sm font-medium border-transparent hover:border-input focus:border-input bg-transparent"
      />

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* View selector: Signal Flow | Clean View | 3D */}
      <div className="flex p-0.5 rounded-md bg-muted/60">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setMode('signal-flow'); setViewMode('module') }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-all ${
                viewMode === 'module'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Cable className="w-3 h-3" />
              Signal Flow
            </button>
          </TooltipTrigger>
          <TooltipContent>Detailed wiring diagram with ports</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setViewMode('image')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-all ${
                viewMode === 'image'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Image className="w-3 h-3" />
              Clean View
            </button>
          </TooltipTrigger>
          <TooltipContent>Product images with connections</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-all ${
                viewMode === '3d'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Box className="w-3 h-3" />
              3D
            </button>
          </TooltipTrigger>
          <TooltipContent>Interactive 3D view</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Edit tools — pill group */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted/40">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => groupSelectedNodes()}
              disabled={nodes.filter((n) => n.selected && n.type !== 'group').length < 2}
            >
              <Group className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Group selected (Ctrl+G)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={duplicateSelected}
              disabled={selectedCount < 1}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Duplicate (Ctrl+D)</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={selectedCount < 2}
                >
                  <AlignCenterHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Align & Distribute</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => alignNodes('horizontal')} disabled={selectedCount < 2}>
              <AlignCenterHorizontal className="w-4 h-4" />
              Align horizontally
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alignNodes('vertical')} disabled={selectedCount < 2}>
              <AlignCenterVertical className="w-4 h-4" />
              Align vertically
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => distributeNodes('horizontal')} disabled={selectedCount < 3}>
              <AlignHorizontalSpaceAround className="w-4 h-4" />
              Distribute horizontally
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => distributeNodes('vertical')} disabled={selectedCount < 3}>
              <AlignVerticalSpaceAround className="w-4 h-4" />
              Distribute vertically
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* History — pill group */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted/40">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={undo}
              disabled={past.length === 0}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={redo}
              disabled={future.length === 0}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Validate */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showSignalChainPanel ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              const opening = !showSignalChainPanel
              setShowSignalChainPanel(opening)
              if (opening) runSignalChainAnalysis()
            }}
            className="gap-1.5 relative h-7 text-[11px]"
          >
            <Activity className="w-3.5 h-3.5" />
            Validate
            {chainIssues.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                {chainIssues.length}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Analyze signal chains for issues</TooltipContent>
      </Tooltip>


      <div className="flex-1" />

      {/* Status */}
      <div className="text-[11px] text-muted-foreground hidden md:flex items-center gap-2.5 tabular-nums">
        <span>{nodes.length} nodes</span>
        <span className="text-border">|</span>
        <span>{edges.length} edges</span>
        {totalPowerW > 0 && (
          <>
            <span className="text-border">|</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 cursor-default">
                  <Zap className="w-3 h-3" />
                  {totalPowerW >= 1000 ? `${(totalPowerW / 1000).toFixed(1)} kW` : `${totalPowerW}W`}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="text-xs space-y-0.5">
                  <div className="font-medium">System Power Draw</div>
                  <div>{totalPowerW.toLocaleString()}W total</div>
                  <div>{(totalPowerW / 120).toFixed(1)}A @ 120V</div>
                  <div>{(totalPowerW / 240).toFixed(1)}A @ 240V</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Save */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveProject()}>
            <Save className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save (Ctrl+S)</TooltipContent>
      </Tooltip>

      {/* Project manager */}
      <ProjectManager />

      {/* Export */}
      <ExportMenu />

      {/* Custom component creator */}
      <CustomComponentDialog />

      {/* Keyboard shortcuts help */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowShortcuts(true)}>
            <Keyboard className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
      </Tooltip>
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Keyboard className="w-4 h-4" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.label}>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {group.label}
                </h4>
                <div className="space-y-1">
                  {group.shortcuts.map((s) => (
                    <div key={s.keys} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{s.action}</span>
                      <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                        {s.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{darkMode ? 'Light mode' : 'Dark mode'}</TooltipContent>
      </Tooltip>

      {/* Node search overlay */}
      {showSearch && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)} />
        <div className="absolute right-3 top-full mt-1 z-50 w-72 rounded-md border bg-popover shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowSearch(false)
                if (e.key === 'Enter' && searchResults.length > 0) {
                  focusNode(searchResults[0].id)
                  setShowSearch(false)
                }
              }}
              placeholder="Search devices..."
              className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <button onClick={() => setShowSearch(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {searchQuery && (
            <div className="max-h-48 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted-foreground text-center">No matching devices</div>
              ) : (
                searchResults.map((node) => (
                  <button
                    key={node.id}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center justify-between"
                    onClick={() => { focusNode(node.id); setShowSearch(false) }}
                  >
                    <span className="font-medium truncate">{node.data.label}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {node.data.componentType.replace(/-/g, ' ')}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}
