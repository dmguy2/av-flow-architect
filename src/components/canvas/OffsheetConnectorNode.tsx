import { memo, useEffect } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps, type Node } from '@xyflow/react'
import type { AVNodeData, AVPort } from '@/types/av'
import { getSignalColor } from '@/lib/signal-colors'
import { FileOutput } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDiagramStore } from '@/store/diagram-store'

type OffsheetConnectorNodeType = Node<AVNodeData, 'offsheetConnector'>

function OffsheetConnectorNode({ data, selected, id }: NodeProps<OffsheetConnectorNodeType>) {
  const updateNodeInternals = useUpdateNodeInternals()
  const pages = useDiagramStore((s) => s.pages)

  useEffect(() => {
    const timer = setTimeout(() => updateNodeInternals(id), 250)
    return () => clearTimeout(timer)
  }, [id, updateNodeInternals])
  const setActivePage = useDiagramStore((s) => s.setActivePage)

  const inputPorts = data.ports.filter((p: AVPort) => p.direction === 'input' || p.direction === 'bidirectional' || p.direction === 'undefined')
  const outputPorts = data.ports.filter((p: AVPort) => p.direction === 'output' || p.direction === 'bidirectional' || p.direction === 'undefined')

  const targetPageId = (data as AVNodeData & { targetPageId?: string }).targetPageId
  const targetPage = targetPageId ? pages.find((p) => p.id === targetPageId) : undefined
  const targetLabel = (data as AVNodeData & { targetLabel?: string }).targetLabel

  const handleNavigate = (e: React.MouseEvent) => {
    if (targetPageId && e.detail === 2) {
      setActivePage(targetPageId)
    }
  }

  return (
    <div
      className={cn(
        'bg-card border-2 border-dashed rounded-lg shadow-md min-w-[160px] transition-shadow',
        selected ? 'border-ring shadow-lg ring-2 ring-ring/20' : 'border-amber-500/60'
      )}
      onClick={handleNavigate}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dashed border-border bg-amber-500/10 rounded-t-md">
        <FileOutput className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{data.label}</div>
          {targetPage && (
            <div className="text-[10px] text-muted-foreground truncate">
              TO: {targetPage.label}{targetLabel ? ` / ${targetLabel}` : ''}
            </div>
          )}
          {!targetPage && (
            <div className="text-[10px] text-muted-foreground/50 truncate italic">
              No target page
            </div>
          )}
        </div>
      </div>

      {/* Ports */}
      <div className="relative px-1 py-1" style={{ minHeight: Math.max(inputPorts.length, outputPorts.length, 1) * 24 }}>
        {inputPorts.map((port: AVPort, idx: number) => {
          const topOffset = 12 + idx * 24
          return (
            <div key={port.id}>
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                style={{
                  top: topOffset,
                  background: getSignalColor(port.domain),
                  width: 10,
                  height: 10,
                  border: '2px solid white',
                }}
              />
              <div
                className="absolute left-3 text-[10px] text-muted-foreground whitespace-nowrap"
                style={{ top: topOffset - 7 }}
              >
                {port.label}
              </div>
            </div>
          )
        })}

        {outputPorts.map((port: AVPort, idx: number) => {
          const topOffset = 12 + idx * 24
          return (
            <div key={port.id}>
              <Handle
                type="source"
                position={Position.Right}
                id={port.id}
                style={{
                  top: topOffset,
                  background: getSignalColor(port.domain),
                  width: 10,
                  height: 10,
                  border: '2px solid white',
                }}
              />
              <div
                className="absolute right-3 text-[10px] text-muted-foreground whitespace-nowrap text-right"
                style={{ top: topOffset - 7 }}
              >
                {port.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(OffsheetConnectorNode)
