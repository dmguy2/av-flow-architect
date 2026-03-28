import { FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { templates } from '@/data/templates'
import { useDiagramStore } from '@/store/diagram-store'
import { getIcon } from '@/lib/icons'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function TemplatePickerDialog({ open, onOpenChange }: Props) {
  const { setNodesAndEdges, setProjectName } = useDiagramStore()

  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    setProjectName(template.name)
    setNodesAndEdges(
      template.nodes.map((n) => ({ ...n })),
      template.edges.map((e) => ({ ...e }))
    )
    onOpenChange(false)
    // Zoom to fit the new template content after a brief render delay
    setTimeout(() => window.dispatchEvent(new Event('av-fit-view')), 100)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start a New Diagram</DialogTitle>
          <DialogDescription>
            Choose a template to get started quickly, or start with a blank canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {/* Blank canvas */}
          <button
            onClick={() => onOpenChange(false)}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-ring hover:bg-accent transition-colors text-left"
          >
            <FileText className="w-8 h-8 text-muted-foreground" />
            <div className="text-sm font-medium">Blank Canvas</div>
            <div className="text-xs text-muted-foreground text-center">
              Start from scratch
            </div>
          </button>

          {/* Templates */}
          {templates.map((template) => {
            const Icon = getIcon(template.icon)
            return (
              <button
                key={template.id}
                onClick={() => loadTemplate(template.id)}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-border hover:border-ring hover:bg-accent transition-colors text-left"
              >
                <Icon className="w-8 h-8 text-muted-foreground" />
                <div className="text-sm font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground text-center">
                  {template.description}
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
