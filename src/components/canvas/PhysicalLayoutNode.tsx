import { memo } from 'react'
import { type NodeProps, type Node } from '@xyflow/react'
import type { AVNodeData, AVPort } from '@/types/av'
import { getIcon } from '@/lib/icons'
import { getComponentDef } from '@/data/component-definitions'
import { cn } from '@/lib/utils'
import { useDiagramStore } from '@/store/diagram-store'

type PhysicalLayoutNodeType = Node<AVNodeData, 'physicalLayout'>

function PhysicalLayoutNode({ data, selected }: NodeProps<PhysicalLayoutNodeType>) {
  const def = getComponentDef(data.componentType)
  const Icon = getIcon(def?.icon ?? 'BoxSelect')
  const rotation = data.rotation ?? 0
  const layerVisibility = useDiagramStore((s) => s.layerVisibility)
  const focusedLayer = useDiagramStore((s) => s.focusedLayer)

  // Determine if node should be dimmed
  const allPortDomains = data.ports.map((p: AVPort) => p.domain)
  const allPortsHidden = allPortDomains.length > 0 && allPortDomains.every((d) => !layerVisibility[d])
  const noPortMatchesFocus = focusedLayer !== null && allPortDomains.length > 0 && !allPortDomains.includes(focusedLayer)
  const isDimmed = allPortsHidden || noPortMatchesFocus

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center bg-card border-2 rounded-xl shadow-md p-3 min-w-[80px] min-h-[80px] transition-shadow',
        selected ? 'border-ring shadow-lg ring-2 ring-ring/20' : 'border-border'
      )}
      style={{
        transform: `rotate(${rotation}deg)`,
        opacity: isDimmed ? 0.2 : 1,
        pointerEvents: isDimmed ? 'none' : undefined,
        transition: 'opacity 0.2s ease',
      }}
    >
      <Icon className="w-8 h-8 text-foreground mb-1" />
      <div className="text-[10px] font-semibold text-center leading-tight">{data.label}</div>
      {data.model && (
        <div className="text-[9px] text-muted-foreground text-center">{data.model}</div>
      )}
    </div>
  )
}

export default memo(PhysicalLayoutNode)
