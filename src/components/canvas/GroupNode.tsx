import { memo, useState, useRef, useEffect } from 'react'
import { type NodeProps, type Node, NodeResizer } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { Ungroup } from 'lucide-react'
import { useDiagramStore } from '@/store/diagram-store'

export interface GroupNodeData {
  label: string
  color?: string
  [key: string]: unknown
}

type GroupNodeType = Node<GroupNodeData, 'group'>

const GROUP_COLORS = [
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#22C55E' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Gray', value: '#6B7280' },
]

function GroupNode({ id, data, selected }: NodeProps<GroupNodeType>) {
  const color = data.color || GROUP_COLORS[0].value
  const [editing, setEditing] = useState(false)
  const [labelText, setLabelText] = useState(data.label)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateNodeData = useDiagramStore((s) => s.updateNodeData)
  const ungroupNodes = useDiagramStore((s) => s.ungroupNodes)

  useEffect(() => {
    setLabelText(data.label)
  }, [data.label])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitLabel = () => {
    setEditing(false)
    if (labelText.trim() && labelText !== data.label) {
      updateNodeData(id, { label: labelText.trim() } as never)
    } else {
      setLabelText(data.label)
    }
  }

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="!border-ring"
        handleClassName="!w-2.5 !h-2.5 !bg-ring !border-background !border-2 !rounded-sm"
      />
      <div
        className={cn(
          'w-full h-full rounded-xl border-2 border-dashed transition-shadow',
          selected ? 'shadow-lg' : ''
        )}
        style={{
          borderColor: color,
          backgroundColor: color + '08',
        }}
      >
        {/* Label bar */}
        <div
          className="absolute -top-0 left-0 right-0 flex items-center gap-1 px-2 py-1 rounded-t-[10px]"
          style={{ backgroundColor: color + '18' }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') {
                  setLabelText(data.label)
                  setEditing(false)
                }
              }}
              className="bg-transparent text-[11px] font-semibold outline-none border-none flex-1 min-w-0"
              style={{ color }}
            />
          ) : (
            <span
              className="text-[11px] font-semibold flex-1 cursor-text truncate"
              style={{ color }}
              onDoubleClick={() => setEditing(true)}
            >
              {data.label}
            </span>
          )}
          {selected && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                ungroupNodes(id)
              }}
              className="p-0.5 rounded hover:bg-black/10 transition-colors"
              title="Ungroup"
            >
              <Ungroup className="w-3 h-3" style={{ color }} />
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default memo(GroupNode)
export { GROUP_COLORS }
