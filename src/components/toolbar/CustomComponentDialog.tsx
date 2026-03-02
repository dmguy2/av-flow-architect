import { useState, useEffect } from 'react'
import { Plus, Minus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { db } from '@/db'
import { componentDefinitions } from '@/data/component-definitions'
import type { AVComponentDef, AVPort, ComponentCategory, SignalDomain, ConnectorType, PortDirection, DeviceRole } from '@/types/av'
import { generateId } from '@/lib/utils'
import { getIcon } from '@/lib/icons'

const AVAILABLE_ICONS = [
  'SlidersHorizontal', 'Speaker', 'Mic', 'Radio', 'BoxSelect', 'Zap', 'Cpu',
  'LayoutGrid', 'Headphones', 'Camera', 'Monitor', 'Projector', 'Merge',
  'Play', 'HardDrive', 'Lightbulb', 'Sun', 'Sparkles', 'Split', 'Network',
  'Wifi', 'Plug', 'Laptop', 'Tablet', 'Gauge', 'BarChart3', 'TriangleRight',
]

const CATEGORIES: { key: ComponentCategory; label: string }[] = [
  { key: 'audio', label: 'Audio' },
  { key: 'video', label: 'Video' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'corporate', label: 'Corporate' },
]

interface Props {
  onComponentCreated?: () => void
}

export default function CustomComponentDialog({ onComponentCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<ComponentCategory>('audio')
  const [icon, setIcon] = useState('BoxSelect')
  const [ports, setPorts] = useState<AVPort[]>([])
  const [deviceRole, setDeviceRole] = useState<DeviceRole | undefined>(undefined)
  const [customDefs, setCustomDefs] = useState<AVComponentDef[]>([])

  // Load custom components
  useEffect(() => {
    if (open) {
      db.customComponents.toArray().then((records) => {
        setCustomDefs(records as AVComponentDef[])
      })
    }
  }, [open])

  const addPort = () => {
    setPorts([
      ...ports,
      {
        id: generateId(),
        label: `Port ${ports.length + 1}`,
        domain: 'audio' as SignalDomain,
        connector: 'xlr' as ConnectorType,
        direction: 'input' as PortDirection,
      },
    ])
  }

  const removePort = (idx: number) => {
    setPorts(ports.filter((_, i) => i !== idx))
  }

  const updatePort = (idx: number, updates: Partial<AVPort>) => {
    setPorts(ports.map((p, i) => (i === idx ? { ...p, ...updates } : p)))
  }

  const handleCreate = async () => {
    if (!label.trim()) return

    const typeSlug = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`

    const newDef: AVComponentDef = {
      type: typeSlug,
      label: label.trim(),
      category,
      icon,
      defaultPorts: ports.map((p, i) => ({
        ...p,
        id: `port-${i + 1}`,
      })),
      ...(deviceRole && { deviceRole }),
    }

    // Save to IndexedDB
    await db.customComponents.add(newDef as never)

    // Add to runtime definitions
    componentDefinitions.push(newDef)

    // Reset form
    setLabel('')
    setCategory('audio')
    setIcon('BoxSelect')
    setPorts([])
    setDeviceRole(undefined)

    // Reload list
    const records = await db.customComponents.toArray()
    setCustomDefs(records as AVComponentDef[])

    window.dispatchEvent(new Event('av-components-changed'))
    onComponentCreated?.()
  }

  const handleDelete = async (type: string) => {
    await db.customComponents.where('type').equals(type).delete()
    // Remove from runtime
    const idx = componentDefinitions.findIndex((c) => c.type === type)
    if (idx >= 0) componentDefinitions.splice(idx, 1)

    const records = await db.customComponents.toArray()
    setCustomDefs(records as AVComponentDef[])
    window.dispatchEvent(new Event('av-components-changed'))
    onComponentCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Wrench className="w-4 h-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Create custom component</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom Component Creator</DialogTitle>
          <DialogDescription>
            Define a new AV component with custom ports to use in your diagrams.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs">Component Name</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Custom Matrix Switcher"
              className="h-8 text-sm"
            />
          </div>

          {/* Category + Icon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComponentCategory)}
                className="h-8 text-sm border border-input rounded-md px-2 bg-transparent w-full"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Icon</Label>
              <div className="flex flex-wrap gap-1 p-1 border border-input rounded-md max-h-24 overflow-y-auto">
                {AVAILABLE_ICONS.map((name) => {
                  const IconComp = getIcon(name)
                  return (
                    <button
                      key={name}
                      onClick={() => setIcon(name)}
                      className={`p-1 rounded ${icon === name ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                      title={name}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Device Role */}
          <div className="space-y-1">
            <Label className="text-xs">Device Role</Label>
            <select
              value={deviceRole ?? ''}
              onChange={(e) => setDeviceRole((e.target.value || undefined) as DeviceRole | undefined)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-transparent w-full"
            >
              <option value="">Not set</option>
              <option value="source">Source</option>
              <option value="destination">Destination</option>
              <option value="processor">Processor</option>
              <option value="infrastructure">Infrastructure</option>
            </select>
          </div>

          <Separator />

          {/* Ports */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Ports</Label>
              <Button size="sm" variant="outline" onClick={addPort} className="h-6 text-xs gap-1">
                <Plus className="w-3 h-3" />
                Add Port
              </Button>
            </div>
            {ports.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                No ports defined. Add inputs and outputs for this component.
              </div>
            )}
            <div className="space-y-2">
              {ports.map((port, idx) => (
                <div key={port.id} className="flex items-center gap-1.5 text-xs">
                  <Input
                    value={port.label}
                    onChange={(e) => updatePort(idx, { label: e.target.value })}
                    placeholder="Port name"
                    className="h-6 text-[11px] flex-1"
                  />
                  <select
                    value={port.direction}
                    onChange={(e) => updatePort(idx, { direction: e.target.value as PortDirection })}
                    className="h-6 text-[11px] border border-input rounded px-1 bg-transparent"
                  >
                    <option value="input">In</option>
                    <option value="output">Out</option>
                    <option value="bidirectional">Bi</option>
                    <option value="undefined">?</option>
                  </select>
                  <select
                    value={port.domain}
                    onChange={(e) => updatePort(idx, { domain: e.target.value as SignalDomain })}
                    className="h-6 text-[11px] border border-input rounded px-1 bg-transparent"
                  >
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                    <option value="network">Network</option>
                    <option value="power">Power</option>
                    <option value="av-over-ip">AV-over-IP</option>
                  </select>
                  <select
                    value={port.connector}
                    onChange={(e) => updatePort(idx, { connector: e.target.value as ConnectorType })}
                    className="h-6 text-[11px] border border-input rounded px-1 bg-transparent"
                  >
                    <option value="xlr">XLR</option>
                    <option value="trs">TRS</option>
                    <option value="rca">RCA</option>
                    <option value="hdmi">HDMI</option>
                    <option value="sdi">SDI</option>
                    <option value="ethernet">Ethernet</option>
                    <option value="dante">Dante</option>
                    <option value="usb">USB</option>
                    <option value="speakon">Speakon</option>
                    <option value="powercon">powerCON</option>
                    <option value="dmx">DMX</option>
                    <option value="fiber">Fiber</option>
                  </select>
                  <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => removePort(idx)}>
                    <Minus className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleCreate} className="w-full" disabled={!label.trim()}>
            Create Component
          </Button>

          {/* Existing custom components */}
          {customDefs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Your Custom Components</Label>
                {customDefs.map((def) => {
                  const IconComp = getIcon(def.icon)
                  return (
                    <div key={def.type} className="flex items-center justify-between px-2 py-1.5 rounded-md border border-border">
                      <div className="flex items-center gap-2">
                        <IconComp className="w-3.5 h-3.5 text-muted-foreground" />
                        <div>
                          <div className="text-xs font-medium">{def.label}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {def.category} &middot; {def.defaultPorts.length} ports
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleDelete(def.type)}
                      >
                        <Minus className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
