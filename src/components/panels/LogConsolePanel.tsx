import { useMemo, useRef, useEffect, useCallback } from 'react'
import { Terminal, Copy, Trash2, ChevronDown } from 'lucide-react'
import { useLogStore, type LogCategory, type LogEntry } from '@/store/log-store'
import { useDiagramStore } from '@/store/diagram-store'
import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<LogCategory, string> = {
  CANVAS: 'text-sky-400',
  CONNECTION: 'text-blue-400',
  STORE: 'text-slate-400',
  SCRAPE: 'text-emerald-400',
  LLM: 'text-purple-400',
  PROJECT: 'text-orange-400',
  VIEW: 'text-teal-400',
  SYSTEM: 'text-slate-500',
}

const LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-400',
  warn: 'text-amber-400',
}

const ALL_CATEGORIES: LogCategory[] = ['CANVAS', 'CONNECTION', 'STORE', 'SCRAPE', 'LLM', 'PROJECT', 'VIEW', 'SYSTEM']

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function formatEntryForCopy(entry: LogEntry): string {
  const time = formatTime(entry.timestamp)
  const line = `${time}  ${entry.category.padEnd(12)} ${entry.message}`
  return entry.detail ? `${line}\n${''.padEnd(26)}${entry.detail}` : line
}

export default function LogConsolePanel() {
  const entries = useLogStore((s) => s.entries)
  const isOpen = useLogStore((s) => s.isOpen)
  const filter = useLogStore((s) => s.filter)
  const toggleOpen = useLogStore((s) => s.toggleOpen)
  const setFilter = useLogStore((s) => s.setFilter)
  const clear = useLogStore((s) => s.clear)

  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const mode = useDiagramStore((s) => s.mode)
  const pages = useDiagramStore((s) => s.pages)
  const activePageId = useDiagramStore((s) => s.activePageId)
  const chainIssues = useDiagramStore((s) => s.chainIssues)

  const activePage = pages.find((p) => p.id === activePageId)

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

  const filtered = useMemo(
    () => (filter ? entries.filter((e) => e.category === filter) : entries),
    [entries, filter]
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (!isOpen || !autoScrollRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [filtered, isOpen])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    autoScrollRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
  }, [])

  const handleCopyAll = useCallback(() => {
    const text = filtered.map(formatEntryForCopy).join('\n')
    navigator.clipboard.writeText(text)
  }, [filtered])

  return (
    <div
      className={cn(
        'shrink-0 border-t border-border bg-card flex flex-col transition-[height] duration-200 ease-in-out',
        isOpen ? 'h-[240px]' : 'h-6'
      )}
    >
      {/* Status bar row — always visible */}
      <div className="h-6 flex items-center px-3 text-[10px] text-muted-foreground gap-3 shrink-0 tabular-nums">
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
        <span className="text-border">|</span>
        {/* Log toggle */}
        <button
          onClick={toggleOpen}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Terminal className="w-3 h-3" />
          Log
          {entries.length > 0 && (
            <span className="text-[9px] bg-muted px-1 rounded-full tabular-nums">
              {entries.length}
            </span>
          )}
        </button>
      </div>

      {/* Expanded log area */}
      {isOpen && (
        <>
          {/* Toolbar */}
          <div className="h-6 flex items-center px-3 gap-2 border-t border-border shrink-0 text-[10px] text-muted-foreground">
            <span className="text-[10px]">Filter:</span>
            <select
              value={filter ?? ''}
              onChange={(e) => setFilter((e.target.value || null) as LogCategory | null)}
              className="h-4 bg-transparent border border-border rounded px-1 text-[10px] text-muted-foreground outline-none cursor-pointer"
            >
              <option value="">All</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex-1" />
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-0.5 hover:text-foreground transition-colors"
              title="Copy all logs"
            >
              <Copy className="w-3 h-3" />
              Copy All
            </button>
            <button
              onClick={clear}
              className="flex items-center gap-0.5 hover:text-foreground transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>

          {/* Log entries */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto font-mono text-[11px] leading-[18px] px-3 py-1"
          >
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs">
                No log entries yet
              </div>
            ) : (
              filtered.map((entry) => (
                <div key={entry.id} className="flex gap-2 hover:bg-muted/30">
                  <span className="text-muted-foreground/60 shrink-0 select-none">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className={cn('shrink-0 w-[84px]', CATEGORY_COLORS[entry.category])}>
                    {entry.category}
                  </span>
                  <span className={cn(
                    'min-w-0',
                    LEVEL_COLORS[entry.level] ?? 'text-foreground/80'
                  )}>
                    {entry.message}
                    {entry.detail && (
                      <span className="text-muted-foreground/50 ml-2">{entry.detail}</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Scroll-to-bottom indicator */}
          {!autoScrollRef.current && filtered.length > 0 && (
            <button
              onClick={() => {
                const el = scrollRef.current
                if (el) {
                  el.scrollTop = el.scrollHeight
                  autoScrollRef.current = true
                }
              }}
              className="absolute bottom-[214px] right-6 bg-muted/80 rounded-full p-1 hover:bg-muted transition-colors"
              title="Scroll to bottom"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
