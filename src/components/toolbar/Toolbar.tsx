import { useCallback, useEffect } from 'react'
import { Undo2, Redo2, Moon, Sun, Cable, Save, Group, Copy, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, AlignCenterHorizontal, AlignCenterVertical, Activity, Image, Box } from 'lucide-react'
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
import ExportMenu from './ExportMenu'
import CustomComponentDialog from './CustomComponentDialog'
import ProjectManager from './ProjectManager'
import { useDiagramStore } from '@/store/diagram-store'

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
    },
    [undo, redo, saveProject, groupSelectedNodes, duplicateSelected, copySelected, pasteClipboard, selectAll]
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

  // Init dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="h-11 border-b border-border bg-card flex items-center px-3 gap-1.5 shrink-0">
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
      <div className="text-[11px] text-muted-foreground hidden md:flex gap-2.5 tabular-nums">
        <span>{nodes.length} nodes</span>
        <span className="text-border">|</span>
        <span>{edges.length} edges</span>
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

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{darkMode ? 'Light mode' : 'Dark mode'}</TooltipContent>
      </Tooltip>
    </div>
  )
}
