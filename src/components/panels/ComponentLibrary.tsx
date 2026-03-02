import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Search, Boxes, Layers, FileStack, Download, Package, Library, Loader2, Check, X, Ban } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import ComponentCard from './ComponentCard'
import LayerPanel from './LayerPanel'
import PagePanel from './PagePanel'
import BHImportDialog from '@/components/toolbar/BHImportDialog'
import EditComponentDialog from '@/components/toolbar/EditComponentDialog'
import { componentDefinitions } from '@/data/component-definitions'
import { scrapeProduct, inferCategory, inferIcon, shutdownDriver } from '@/lib/bh-api'
import { db } from '@/db'
import type { ComponentCategory, AVPort, SignalDomain, ConnectorType, ConnectorVariant, PortDirection, AVComponentDef, DeviceRole } from '@/types/av'
import { cn } from '@/lib/utils'

const CATEGORY_ORDER: { key: ComponentCategory; label: string }[] = [
  { key: 'audio', label: 'Audio' },
  { key: 'video', label: 'Video' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'corporate', label: 'Corporate' },
  { key: 'software', label: 'Software' },
]

function inferDeviceRole(name: string): DeviceRole | undefined {
  const n = name.toLowerCase()
  const sourceKw = ['microphone', 'mic ', 'camera', 'player', 'laptop', 'deck', 'blu-ray', 'dvd', 'turntable', 'console']
  const destKw = ['speaker', 'subwoofer', 'monitor', 'display', 'tv ', 'television', 'projector', 'headphone', 'iem']
  const processorKw = ['mixer', 'amplifier', 'amp ', 'dsp', 'processor', 'equalizer', 'compressor', 'switcher', 'scaler', 'converter', 'capture', 'recorder']
  const infraKw = ['switch', 'hub', 'router', 'interface', 'stage box', 'stagebox', 'splitter', 'distribution', 'patch', 'power dist', 'rack']
  if (sourceKw.some((kw) => n.includes(kw))) return 'source'
  if (destKw.some((kw) => n.includes(kw))) return 'destination'
  if (processorKw.some((kw) => n.includes(kw))) return 'processor'
  if (infraKw.some((kw) => n.includes(kw))) return 'infrastructure'
  return undefined
}

interface ImportJob {
  url: string
  status: 'pending' | 'scraping' | 'done' | 'error'
  name?: string
  error?: string
}

type SidebarTab = 'components' | 'layers' | 'pages'
type ComponentView = 'library' | 'my-gear'

export default function ComponentLibrary() {
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [activeTab, setActiveTab] = useState<SidebarTab>('components')
  const [componentView, setComponentView] = useState<ComponentView>('library')
  const [bhImportOpen, setBhImportOpen] = useState(false)
  const [importQueue, setImportQueue] = useState<ImportJob[]>([])
  const [editDef, setEditDef] = useState<AVComponentDef | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const cancelledRef = useRef(false)
  const processingRef = useRef(false)

  const isImporting = importQueue.some((j) => j.status === 'pending' || j.status === 'scraping')
  const currentIndex = importQueue.findIndex((j) => j.status === 'scraping')
  const doneCount = importQueue.filter((j) => j.status === 'done').length
  const errorCount = importQueue.filter((j) => j.status === 'error').length
  const totalCount = importQueue.length

  const handleStartImport = useCallback((urls: string[]) => {
    cancelledRef.current = false
    processingRef.current = false
    setImportQueue(urls.map((url) => ({ url, status: 'pending' })))
    setBhImportOpen(false)
    setComponentView('my-gear')
    setShowSummary(false)
  }, [])

  // Sequential queue processor
  useEffect(() => {
    if (importQueue.length === 0) return
    if (processingRef.current) return
    if (cancelledRef.current) return

    const nextPending = importQueue.findIndex((j) => j.status === 'pending')
    if (nextPending === -1) {
      // All done — shut down Chrome and show summary then auto-dismiss
      if (importQueue.some((j) => j.status === 'done' || j.status === 'error')) {
        shutdownDriver()
        setShowSummary(true)
        const timer = setTimeout(() => {
          setImportQueue([])
          setShowSummary(false)
        }, 4000)
        return () => clearTimeout(timer)
      }
      return
    }

    processingRef.current = true

    // Mark this job as scraping
    setImportQueue((q) =>
      q.map((j, i) => (i === nextPending ? { ...j, status: 'scraping' } : j))
    )

    const url = importQueue[nextPending].url

    const processJob = async () => {
      try {
        const result = await scrapeProduct(url)

        if (cancelledRef.current) {
          processingRef.current = false
          return
        }

        // Expand qty > 1 into individual port rows
        const expanded: AVPort[] = []
        let portIdx = 1
        for (const p of result.ports) {
          const qty = Math.max(1, p.qty)
          for (let i = 0; i < qty; i++) {
            const port: AVPort = {
              id: `port-${portIdx}`,
              label: qty > 1 ? `${p.label} ${i + 1}` : p.label,
              domain: (p.domain || 'network') as SignalDomain,
              connector: (p.connector || 'ethernet') as ConnectorType,
              direction: (p.direction || 'bidirectional') as PortDirection,
            }
            if (p.variant) {
              port.variant = p.variant as ConnectorVariant
            }
            expanded.push(port)
            portIdx++
          }
        }

        const cat = inferCategory(result.name)
        const icon = inferIcon(cat)
        const typeSlug = `bh-${result.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`

        const role = inferDeviceRole(result.name)
        const newDef: AVComponentDef = {
          type: typeSlug,
          label: result.name.trim(),
          category: cat,
          icon,
          defaultPorts: expanded,
          bhUrl: url,
          images: result.images,
          specs: Object.keys(result.specs || {}).length > 0 ? result.specs : undefined,
          ...(role && { deviceRole: role }),
          importSource: 'bh',
          importedAt: Date.now(),
        }

        await db.customComponents.add(newDef as never)

        if (result.images.length > 0) {
          const blobs = await Promise.all(
            result.images.map(async (dataUri) => {
              const res = await fetch(dataUri)
              return res.blob()
            })
          )
          await db.componentImages.put({ typeSlug, images: blobs })
        }

        componentDefinitions.push(newDef)
        window.dispatchEvent(new Event('av-components-changed'))

        setImportQueue((q) =>
          q.map((j, i) =>
            i === nextPending ? { ...j, status: 'done', name: result.name.trim() } : j
          )
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Scraping failed'
        setImportQueue((q) =>
          q.map((j, i) =>
            i === nextPending ? { ...j, status: 'error', error: msg } : j
          )
        )
      } finally {
        processingRef.current = false
      }
    }

    processJob()
  }, [importQueue])

  const handleCancelRemaining = useCallback(() => {
    cancelledRef.current = true
    setImportQueue((q) => {
      // If nothing is currently scraping, shut down Chrome immediately
      if (!q.some((j) => j.status === 'scraping')) shutdownDriver()
      return q.map((j) => (j.status === 'pending' ? { ...j, status: 'error', error: 'Cancelled' } : j))
    })
  }, [])

  // Listen for custom component changes
  const mountedRef = useRef(false)
  useEffect(() => {
    requestAnimationFrame(() => { mountedRef.current = true })
    const handler = () => {
      setRefresh((n) => n + 1)
      if (mountedRef.current) {
        setComponentView('my-gear')
      }
    }
    window.addEventListener('av-components-changed', handler)
    return () => window.removeEventListener('av-components-changed', handler)
  }, [])

  // Split definitions into built-in vs imported/custom
  const builtInDefs = useMemo(
    () => componentDefinitions.filter((c) => !c.type.startsWith('custom-') && !c.type.startsWith('bh-')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, refresh]
  )
  const myGearDefs = useMemo(
    () => componentDefinitions.filter((c) => c.type.startsWith('custom-') || c.type.startsWith('bh-')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, refresh]
  )

  const activeDefs = componentView === 'library' ? builtInDefs : myGearDefs

  const filtered = useMemo(() => {
    if (!search.trim()) return activeDefs
    const q = search.toLowerCase()
    return activeDefs.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.manufacturer && c.manufacturer.toLowerCase().includes(q)) ||
        (c.model && c.model.toLowerCase().includes(q))
    )
  }, [search, activeDefs])

  // Progress card component
  const renderProgressCard = () => {
    if (importQueue.length === 0) return null

    const allFinished = !importQueue.some((j) => j.status === 'pending' || j.status === 'scraping')

    if (allFinished && !showSummary) return null

    const scrapingJob = importQueue.find((j) => j.status === 'scraping')
    const scrapingIndex = importQueue.findIndex((j) => j.status === 'scraping')

    return (
      <div className="p-2.5 mb-2 rounded-lg border border-border bg-card space-y-2">
        {/* Header */}
        {!allFinished && (
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">
                Importing {scrapingIndex + 1} of {totalCount}...
              </p>
              {scrapingJob?.name && (
                <p className="text-[10px] text-muted-foreground truncate">{scrapingJob.name}</p>
              )}
            </div>
          </div>
        )}
        {allFinished && (
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xs font-medium">
              Import complete — {doneCount} of {totalCount} succeeded
            </p>
          </div>
        )}

        {/* Progress bar */}
        {!allFinished && (
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((doneCount + errorCount) / totalCount) * 100}%` }}
            />
          </div>
        )}

        {/* Per-item status list */}
        {importQueue.some((j) => j.status !== 'pending' && j.status !== 'scraping') && (
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {importQueue.map((job, i) => {
              if (job.status === 'pending') return null
              return (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  {job.status === 'done' && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                  {job.status === 'error' && <X className="w-3 h-3 text-destructive shrink-0" />}
                  {job.status === 'scraping' && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                  <span className={cn(
                    'truncate',
                    job.status === 'done' && 'text-muted-foreground',
                    job.status === 'error' && 'text-destructive'
                  )}>
                    {job.name || job.url.replace(/^https?:\/\/(www\.)?bhphotovideo\.com\/c\/product\//, '').slice(0, 40)}
                    {job.status === 'error' && job.error && ` — ${job.error}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Cancel button */}
        {!allFinished && importQueue.some((j) => j.status === 'pending') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground hover:text-destructive w-full gap-1"
            onClick={handleCancelRemaining}
          >
            <Ban className="w-3 h-3" />
            Cancel remaining
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="border-r border-border bg-sidebar flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('components')}
          className={cn(
            'flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium transition-colors',
            activeTab === 'components'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Boxes className="w-3.5 h-3.5" />
          Components
        </button>
        <button
          onClick={() => setActiveTab('layers')}
          className={cn(
            'flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium transition-colors',
            activeTab === 'layers'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          Layers
        </button>
        <button
          onClick={() => setActiveTab('pages')}
          className={cn(
            'flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium transition-colors',
            activeTab === 'pages'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileStack className="w-3.5 h-3.5" />
          Pages
        </button>
      </div>

      {activeTab === 'components' && (
        <>
          {/* Sub-view toggle: Library / My Gear */}
          <div className="flex mx-3 mt-2 p-0.5 rounded-md bg-muted">
            <button
              onClick={() => setComponentView('library')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-medium rounded transition-colors',
                componentView === 'library'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Library className="w-3 h-3" />
              Library
            </button>
            <button
              onClick={() => setComponentView('my-gear')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-medium rounded transition-colors',
                componentView === 'my-gear'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Package className="w-3 h-3" />
              My Gear
              {myGearDefs.length > 0 && (
                <span className="ml-0.5 text-[9px] bg-primary/20 text-primary px-1 rounded-full">
                  {myGearDefs.length}
                </span>
              )}
            </button>
          </div>

          {/* Search + Import */}
          <div className="p-3 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={componentView === 'library' ? 'Search library...' : 'Search my gear...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-7 text-xs"
                />
              </div>
              {componentView === 'my-gear' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setBhImportOpen(true)}
                      disabled={isImporting}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Import from B&H</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <EditComponentDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            def={editDef}
          />
          <BHImportDialog
            open={bhImportOpen}
            onOpenChange={setBhImportOpen}
            onStartImport={handleStartImport}
          />
          <Separator />

          <ScrollArea className="flex-1">
            {/* Library view: grouped by category */}
            {componentView === 'library' && (
              <div className="p-2 space-y-3">
                {CATEGORY_ORDER.map(({ key, label }) => {
                  const items = filtered.filter((c) => c.category === key)
                  if (items.length === 0) return null
                  return (
                    <div key={key}>
                      <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                        {label}
                        <span className="text-[9px] font-normal bg-muted px-1 py-px rounded tabular-nums">
                          {items.length}
                        </span>
                      </h3>
                      <div className="space-y-1">
                        {items.map((def) => (
                          <ComponentCard key={def.type} def={def} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* My Gear view: imported + custom components */}
            {componentView === 'my-gear' && (
              <div className="p-2">
                {/* Inline import progress card */}
                {renderProgressCard()}
                {filtered.length === 0 && !search && !isImporting && importQueue.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">No gear imported yet</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Import real devices from B&H Photo or create custom components
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setBhImportOpen(true)}
                    >
                      <Download className="w-3 h-3" />
                      Import from B&H
                    </Button>
                  </div>
                )}
                {filtered.length === 0 && search && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No matching gear found
                  </div>
                )}
                {filtered.length > 0 && (
                  <div className="space-y-3">
                    {/* B&H imported gear */}
                    {(() => {
                      const bhItems = filtered.filter((c) => c.type.startsWith('bh-'))
                      if (bhItems.length === 0) return null
                      return (
                        <div>
                          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                            Imported
                          </h3>
                          <div className="space-y-1">
                            {bhItems.map((def) => (
                              <ComponentCard key={def.type} def={def} showImage deletable onEdit={(d) => { setEditDef(d); setEditDialogOpen(true) }} />
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                    {/* User-created custom gear */}
                    {(() => {
                      const customItems = filtered.filter((c) => c.type.startsWith('custom-'))
                      if (customItems.length === 0) return null
                      return (
                        <div>
                          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                            Custom
                          </h3>
                          <div className="space-y-1">
                            {customItems.map((def) => (
                              <ComponentCard key={def.type} def={def} deletable onEdit={(d) => { setEditDef(d); setEditDialogOpen(true) }} />
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </>
      )}
      {activeTab === 'layers' && (
        <ScrollArea className="flex-1">
          <LayerPanel />
        </ScrollArea>
      )}
      {activeTab === 'pages' && (
        <ScrollArea className="flex-1">
          <PagePanel />
        </ScrollArea>
      )}
    </div>
  )
}
