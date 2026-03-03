import { useState, useEffect } from 'react'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import Toolbar from '@/components/toolbar/Toolbar'
import ComponentLibrary from '@/components/panels/ComponentLibrary'
import PropertiesPanel from '@/components/panels/PropertiesPanel'
import SignalChainPanel from '@/components/panels/SignalChainPanel'
import AVCanvas from '@/components/canvas/AVCanvas'
import TemplatePickerDialog from '@/components/toolbar/TemplatePickerDialog'
import LogConsolePanel from '@/components/panels/LogConsolePanel'
import { useDiagramStore } from '@/store/diagram-store'
import { db } from '@/db'
import { componentDefinitions } from '@/data/component-definitions'
import type { AVComponentDef } from '@/types/av'
import { migrateDomain } from '@/lib/domain-migration'
import { cn } from '@/lib/utils'
import { log } from '@/lib/logger'

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
      log('SYSTEM', 'AV Flow Architect starting up')

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
      if (records.length > 0) {
        log('SYSTEM', `Loaded ${records.length} custom component(s) from IndexedDB`)
      }

      // Auto-load the most recently saved project
      const projects = await db.projects.orderBy('updatedAt').reverse().first()
      if (projects) {
        await loadProject(projects.id)
        log('SYSTEM', `Auto-loaded project: "${projects.name}"`)
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
      <LogConsolePanel />
      {startupDone && nodes.length === 0 && (
        <TemplatePickerDialog
          open={showTemplatePicker}
          onOpenChange={setShowTemplatePicker}
        />
      )}
    </div>
  )
}

export default App
