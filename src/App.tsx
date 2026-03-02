import { useState, useEffect, useMemo } from 'react'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import Toolbar from '@/components/toolbar/Toolbar'
import ComponentLibrary from '@/components/panels/ComponentLibrary'
import PropertiesPanel from '@/components/panels/PropertiesPanel'
import SignalChainPanel from '@/components/panels/SignalChainPanel'
import AVCanvas from '@/components/canvas/AVCanvas'
import TemplatePickerDialog from '@/components/toolbar/TemplatePickerDialog'
import { useDiagramStore } from '@/store/diagram-store'
import { db } from '@/db'
import { componentDefinitions } from '@/data/component-definitions'
import type { AVComponentDef } from '@/types/av'
import { migrateDomain } from '@/lib/domain-migration'
import { cn } from '@/lib/utils'

function App() {
  const nodes = useDiagramStore((s) => s.nodes)
  const showSignalChainPanel = useDiagramStore((s) => s.showSignalChainPanel)
  const setShowSignalChainPanel = useDiagramStore((s) => s.setShowSignalChainPanel)
  const loadProject = useDiagramStore((s) => s.loadProject)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [startupDone, setStartupDone] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  // Load custom components + most recent project on startup
  useEffect(() => {
    async function startup() {
      // Load custom component definitions from IndexedDB
      const records = await db.customComponents.toArray()
      for (const rec of records) {
        const def = rec as AVComponentDef
        def.defaultPorts = def.defaultPorts.map((p) => ({
          ...p,
          domain: migrateDomain(p.domain, p.connector),
        }))
        if (!componentDefinitions.find((c) => c.type === def.type)) {
          componentDefinitions.push(def)
        }
      }
      window.dispatchEvent(new Event('av-components-changed'))

      // Auto-load the most recently saved project
      const projects = await db.projects.orderBy('updatedAt').reverse().first()
      if (projects) {
        await loadProject(projects.id)
      } else {
        setShowTemplatePicker(true)
      }
      setStartupDone(true)
    }
    startup()
  }, [loadProject])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        {/* Left panel — collapsible */}
        <div className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
          leftPanelOpen ? "w-64" : "w-0"
        )}>
          <div className="w-64 h-full">
            <ComponentLibrary />
          </div>
        </div>

        {/* Left toggle tab */}
        <button
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className="shrink-0 w-5 flex items-center justify-center border-r border-border bg-sidebar hover:bg-accent transition-colors"
          title={leftPanelOpen ? 'Collapse left panel' : 'Expand left panel'}
        >
          {leftPanelOpen ? (
            <PanelLeftClose className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <PanelLeftOpen className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        <AVCanvas />

        {/* Right toggle tab */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="shrink-0 w-5 flex items-center justify-center border-l border-border bg-sidebar hover:bg-accent transition-colors"
          title={rightPanelOpen ? 'Collapse right panel' : 'Expand right panel'}
        >
          {rightPanelOpen ? (
            <PanelRightClose className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Right panel — collapsible */}
        <div className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
          rightPanelOpen ? "w-72" : "w-0"
        )}>
          <div className="w-72 h-full">
            <PropertiesPanel />
          </div>
        </div>

        {showSignalChainPanel && (
          <SignalChainPanel onClose={() => setShowSignalChainPanel(false)} />
        )}
      </div>
      <StatusBar />
      {startupDone && nodes.length === 0 && (
        <TemplatePickerDialog
          open={showTemplatePicker}
          onOpenChange={setShowTemplatePicker}
        />
      )}
    </div>
  )
}

function StatusBar() {
  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const mode = useDiagramStore((s) => s.mode)
  const pages = useDiagramStore((s) => s.pages)
  const activePageId = useDiagramStore((s) => s.activePageId)
  const chainIssues = useDiagramStore((s) => s.chainIssues)

  const activePage = pages.find((p) => p.id === activePageId)

  // Total power draw
  const totalPower = useMemo(() => {
    let watts = 0
    for (const node of nodes) {
      const pd = node.data.powerDraw
      if (!pd) continue
      const match = pd.match(/(\d+)\s*w/i)
      if (match) watts += parseInt(match[1])
    }
    return watts
  }, [nodes])

  const errorCount = chainIssues.filter((i) => i.severity === 'error').length
  const warnCount = chainIssues.filter((i) => i.severity === 'warning').length

  return (
    <div className="h-6 border-t border-border bg-card flex items-center px-3 text-[10px] text-muted-foreground gap-3 shrink-0 tabular-nums">
      {pages.length > 1 && activePage && (
        <>
          <span className="font-medium">{activePage.label}</span>
          <span className="text-border">|</span>
        </>
      )}
      <span>{nodes.length} components</span>
      <span className="text-border">|</span>
      <span>{edges.length} connections</span>
      <span className="text-border">|</span>
      <span className="capitalize">{mode.replace('-', ' ')}</span>
      {totalPower > 0 && (
        <>
          <span className="text-border">|</span>
          <span>{totalPower}W total</span>
        </>
      )}
      <div className="flex-1" />
      {/* Signal chain health */}
      {chainIssues.length > 0 ? (
        <div className="flex items-center gap-1.5">
          {errorCount > 0 && (
            <span className="flex items-center gap-0.5 text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-0.5 text-amber-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              {warnCount} warning{warnCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      ) : chainIssues.length === 0 && nodes.length > 0 ? (
        <span className="flex items-center gap-0.5 text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block" />
          No issues
        </span>
      ) : null}
    </div>
  )
}

export default App
