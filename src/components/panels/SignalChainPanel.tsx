import { useMemo } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Info, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useDiagramStore } from '@/store/diagram-store'

const SEVERITY_STYLES = {
  error: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    icon: AlertTriangle,
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
  },
  info: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    icon: Info,
  },
}

export default function SignalChainPanel({ onClose }: { onClose: () => void }) {
  const {
    signalChains,
    chainIssues,
    llmIssues,
    isAnalyzing,
    llmAnalysisSummary,
    runSignalChainAnalysis,
    runLLMAnalysis,
    clearChainAnalysis,
    focusNode,
  } = useDiagramStore()

  const hasResults = signalChains.length > 0 || chainIssues.length > 0
  const allIssues = useMemo(
    () => [
      ...chainIssues.map((i) => ({ ...i, source: 'deterministic' as const })),
      ...llmIssues.map((i) => ({
        severity: i.severity,
        category: i.category,
        message: i.message,
        suggestion: i.suggestion,
        source: 'llm' as const,
      })),
    ],
    [chainIssues, llmIssues]
  )

  return (
    <div className="w-72 border-l border-border bg-sidebar flex flex-col h-full animate-panel-slide-in">
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Signal Chain Analysis
            </h2>
          </div>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Run Analysis */}
          <Button
            size="sm"
            className="w-full"
            onClick={() => runSignalChainAnalysis()}
          >
            <Activity className="w-3.5 h-3.5 mr-1.5" />
            Analyze Signal Chains
          </Button>

          {!hasResults && (
            <p className="text-[11px] text-muted-foreground text-center py-4">
              Click above to trace signal paths and check for issues
            </p>
          )}

          {/* Chain summary */}
          {signalChains.length > 0 && (
            <>
              <div className="text-[11px] text-muted-foreground">
                Found {signalChains.length} signal chain{signalChains.length !== 1 ? 's' : ''}
              </div>

              {signalChains.map((chain) => (
                <div
                  key={chain.id}
                  className="rounded-md border border-border bg-muted/30 p-2 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">
                      {chain.domain}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {chain.path.length} devices
                    </span>
                  </div>
                  <div className="text-[11px] font-medium truncate">
                    {chain.sourceLabel} → {chain.destLabel}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex flex-wrap gap-0.5 items-center">
                    {chain.path.map((n, i) => (
                      <span key={n.nodeId}>
                        {i > 0 && <span className="mx-0.5">→</span>}
                        <button
                          className="hover:text-foreground hover:underline transition-colors"
                          onClick={(e) => { e.stopPropagation(); focusNode(n.nodeId) }}
                        >
                          {n.label}
                        </button>
                      </span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-6 text-[10px] mt-1"
                    onClick={() => runLLMAnalysis(chain.id)}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Deep Analysis (LLM)
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </>
          )}

          {/* LLM Summary */}
          {llmAnalysisSummary && (
            <div className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <Sparkles className="w-3 h-3 text-purple-500" />
                <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                  LLM Analysis
                </span>
              </div>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 leading-tight">
                {llmAnalysisSummary}
              </span>
            </div>
          )}

          {/* Issues */}
          {allIssues.length > 0 && (
            <>
              <Separator />
              <div className="text-[11px] font-medium">
                {allIssues.length} issue{allIssues.length !== 1 ? 's' : ''} found
              </div>
              {allIssues.map((issue, idx) => {
                const style = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info
                const Icon = style.icon
                const clickableNodeId = 'affectedNodes' in issue && (issue as { affectedNodes?: string[] }).affectedNodes?.[0]
                return (
                  <div
                    key={idx}
                    className={`rounded-md border ${style.border} ${style.bg} px-2 py-1.5 space-y-0.5 ${clickableNodeId ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
                    onClick={() => clickableNodeId && focusNode(clickableNodeId)}
                  >
                    <div className="flex items-start gap-1.5">
                      <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${style.text}`} />
                      <span className={`text-[11px] leading-tight ${style.text}`}>
                        {issue.message}
                      </span>
                    </div>
                    {issue.suggestion && (
                      <p className="text-[10px] text-muted-foreground pl-5 leading-tight">
                        {issue.suggestion}
                      </p>
                    )}
                    {issue.source === 'llm' && (
                      <div className="flex items-center gap-1 pl-5">
                        <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                        <span className="text-[9px] text-purple-400">LLM</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {/* No issues */}
          {hasResults && allIssues.length === 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-green-600 dark:text-green-400 py-2">
              <CheckCircle2 className="w-4 h-4" />
              No issues detected
            </div>
          )}

          {/* Clear */}
          {hasResults && (
            <>
              <Separator />
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-[11px]"
                onClick={clearChainAnalysis}
              >
                Clear Results
              </Button>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
