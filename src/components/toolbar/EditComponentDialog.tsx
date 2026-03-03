import { useState, useEffect } from 'react'
import { Plus, Minus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { db } from '@/db'
import { componentDefinitions } from '@/data/component-definitions'
import { getIcon } from '@/lib/icons'
import type {
  AVComponentDef,
  AVPort,
  ComponentCategory,
  SignalDomain,
  ConnectorType,
  PortDirection,
  DeviceRole,
} from '@/types/av'

const CATEGORIES: { key: ComponentCategory; label: string }[] = [
  { key: 'audio', label: 'Audio' },
  { key: 'video', label: 'Video' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'corporate', label: 'Corporate' },
]

const AVAILABLE_ICONS = [
  'SlidersHorizontal', 'Speaker', 'Mic', 'Radio', 'BoxSelect', 'Zap', 'Cpu',
  'LayoutGrid', 'Headphones', 'Camera', 'Monitor', 'Projector', 'Merge',
  'Play', 'HardDrive', 'Lightbulb', 'Sun', 'Sparkles', 'Split', 'Network',
  'Wifi', 'Plug', 'Laptop', 'Tablet', 'Gauge', 'BarChart3', 'TriangleRight',
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  def: AVComponentDef | null
}

export default function EditComponentDialog({ open, onOpenChange, def }: Props) {
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState<ComponentCategory>('video')
  const [icon, setIcon] = useState('BoxSelect')
  const [ports, setPorts] = useState<AVPort[]>([])
  const [deviceRole, setDeviceRole] = useState<DeviceRole | undefined>(undefined)

  // Sync state when def changes
  useEffect(() => {
    if (def) {
      setProductName(def.label)
      setCategory(def.category)
      setIcon(def.icon)
      setPorts(def.defaultPorts.map((p) => ({ ...p })))
      setDeviceRole(def.deviceRole)
    }
  }, [def])

  const addPort = () => {
    setPorts([
      ...ports,
      {
        id: `port-${Date.now()}`,
        label: 'New Port',
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

  const handleSave = async () => {
    if (!def || !productName.trim()) return

    const cleanPorts: AVPort[] = ports.map((p, i) => ({
      id: `port-${i + 1}`,
      label: p.label,
      domain: p.domain,
      connector: p.connector,
      direction: p.direction,
    }))

    const updated: Partial<AVComponentDef> = {
      label: productName.trim(),
      category,
      icon,
      defaultPorts: cleanPorts,
      deviceRole,
    }

    // Update in-memory definition
    const memIdx = componentDefinitions.findIndex((c) => c.type === def.type)
    if (memIdx !== -1) {
      Object.assign(componentDefinitions[memIdx], updated)
    }

    // Update in IndexedDB
    await db.customComponents.where('type').equals(def.type).modify(updated)

    // Notify sidebar
    window.dispatchEvent(new Event('av-components-changed'))

    onOpenChange(false)
  }

  if (!def) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Component</DialogTitle>
          <DialogDescription>
            Modify the component name, category, icon, and ports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product images */}
          {def.images && def.images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {def.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`Product ${i + 1}`}
                  className="w-20 h-20 object-contain rounded border border-border bg-white shrink-0"
                />
              ))}
            </div>
          )}

          {/* Product name */}
          <div className="space-y-1">
            <Label className="text-xs">Product Name</Label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
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
              <Label className="text-xs">Ports ({ports.length})</Label>
              <Button size="sm" variant="outline" onClick={addPort} className="h-6 text-xs gap-1">
                <Plus className="w-3 h-3" />
                Add Port
              </Button>
            </div>

            {ports.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                No ports configured. Add them manually.
              </div>
            )}

            <div className="space-y-2">
              {ports.map((port, idx) => (
                <div key={port.id} className="flex items-center gap-1.5 text-xs">
                  <Input
                    value={port.label}
                    onChange={(e) => updatePort(idx, { label: e.target.value })}
                    placeholder="Port name"
                    className="h-6 text-[11px] flex-1 min-w-0"
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
                    <option value="aes50">AES50</option>
                    <option value="ndi">NDI</option>
                    <option value="wifi">Wi-Fi</option>
                    <option value="thunderbolt">Thunderbolt</option>
                    <option value="db9">DB-9</option>
                    <option value="bnc">BNC</option>
                    <option value="displayport">DisplayPort</option>
                    <option value="sd">SD Card</option>
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 shrink-0"
                    onClick={() => removePort(idx)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={!productName.trim()}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
