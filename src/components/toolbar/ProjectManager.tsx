import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { useDiagramStore } from '@/store/diagram-store'
import type { AVProject } from '@/types/av'

export default function ProjectManager() {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<AVProject[]>([])
  const [newName, setNewName] = useState('')

  const { loadProjects, loadProject, newProject, deleteProject, saveProject } = useDiagramStore()

  useEffect(() => {
    if (open) {
      loadProjects().then(setProjects)
    }
  }, [open, loadProjects])

  const handleNew = async () => {
    await saveProject() // save current work before switching
    newProject(newName || undefined)
    setNewName('')
    setOpen(false)
  }

  const handleLoad = async (id: string) => {
    await saveProject() // save current work before switching
    await loadProject(id)
    setOpen(false)
  }

  const handleDelete = async (id: string) => {
    await deleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  const handleSave = async () => {
    await saveProject()
    loadProjects().then(setProjects)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FolderOpen className="w-3.5 h-3.5" />
          Projects
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Projects</DialogTitle>
          <DialogDescription>Create, open, or manage your saved diagrams.</DialogDescription>
        </DialogHeader>

        {/* New project */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New diagram name..."
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleNew()}
          />
          <Button onClick={handleNew} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        <Button variant="secondary" size="sm" onClick={handleSave} className="w-full">
          Save Current Project
        </Button>

        {/* Project list */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {projects.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No saved projects yet
            </div>
          )}
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent group cursor-pointer"
              onClick={() => handleLoad(proj.id)}
            >
              <div>
                <div className="text-sm font-medium">{proj.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(proj.updatedAt).toLocaleDateString()} &middot;{' '}
                  {(proj.pages && proj.pages.length > 0
                    ? proj.pages.reduce((sum, p) => sum + p.nodes.length, 0)
                    : proj.nodes.length)} nodes
                  {proj.pages && proj.pages.length > 1 && ` · ${proj.pages.length} pages`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(proj.id)
                }}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
