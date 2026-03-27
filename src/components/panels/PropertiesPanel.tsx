import { useMemo, useState, useCallback } from 'react'
import { Trash2, Plus, Minus, Cable, TriangleAlert, ToggleLeft, ToggleRight, Zap, ExternalLink, ChevronDown, ChevronRight, Image, Box, RefreshCw, Loader2, LayoutDashboard, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDiagramStore } from '@/store/diagram-store'
import { getSignalColor, SIGNAL_LABELS } from '@/lib/signal-colors'
import { getComponentDef } from '@/data/component-definitions'
import { getIcon } from '@/lib/icons'
import { generateId } from '@/lib/utils'
import type { AVNodeData, AVPort, AVComponentDef, SignalDomain, ConnectorType, ConnectorVariant, PortDirection, DeviceRole, ConferenceRole } from '@/types/av'
import { CONNECTOR_VARIANTS, VARIANT_LABELS } from '@/lib/connector-variants'
import { ALL_CONFERENCE_ROLES, CONFERENCE_ROLE_LABELS, CONFERENCE_ROLE_COLORS } from '@/lib/conference-roles'

export default function PropertiesPanel() {
  const { nodes, edges, selectedNodeId, selectedEdgeId, updateNodeData, updateEdgeData, deleteSelected } = useDiagramStore()
  const viewMode = useDiagramStore((s) => s.viewMode)
  const model3dStatus = useDiagramStore((s) => s.model3dStatus)
  const chainIssuesFromStore = useDiagramStore((s) => s.chainIssues)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  )

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId),
    [edges, selectedEdgeId]
  )

  // Edge properties view
  if (!selectedNode && selectedEdge) {
    const edgeData = selectedEdge.data
    const sourceNode = nodes.find((n) => n.id === selectedEdge.source)
    const targetNode = nodes.find((n) => n.id === selectedEdge.target)
    const color = edgeData ? getSignalColor(edgeData.domain) : '#888'

    return (
      <div className="border-l border-border bg-sidebar flex flex-col h-full animate-panel-slide-in">
        <div className="p-3 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Cable className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Connection
            </h2>
          </div>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Cable Label */}
            <div className="space-y-1">
              <Label className="text-xs">Cable Label</Label>
              <Input
                value={edgeData?.label ?? ''}
                onChange={(e) => updateEdgeData(selectedEdge.id, { label: e.target.value || undefined })}
                placeholder="e.g. C-01, Snake 1"
                className="h-7 text-xs"
              />
            </div>

            {/* Signal Domain */}
            <div className="space-y-1">
              <Label className="text-xs">Signal Domain</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <select
                  value={edgeData?.domain ?? 'audio'}
                  onChange={(e) => updateEdgeData(selectedEdge.id, { domain: e.target.value as SignalDomain })}
                  className="h-7 text-xs border border-input rounded px-2 bg-transparent flex-1"
                >
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="network">Network</option>
                  <option value="power">Power</option>
                  <option value="av-over-ip">AV-over-IP</option>
                </select>
              </div>
            </div>

            {/* Connector Type */}
            <div className="space-y-1">
              <Label className="text-xs">Connector</Label>
              <select
                value={edgeData?.connector ?? 'xlr'}
                onChange={(e) => updateEdgeData(selectedEdge.id, { connector: e.target.value as ConnectorType })}
                className="h-7 text-xs border border-input rounded px-2 bg-transparent w-full"
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
              </select>
            </div>

            <Separator />

            {/* Connection info */}
            <div className="space-y-2">
              <Label className="text-xs">Route</Label>
              {(() => {
                const srcPortId = selectedEdge.sourceHandle?.replace(/-(?:target|source)$/, '')
                const tgtPortId = selectedEdge.targetHandle?.replace(/-(?:target|source)$/, '')
                const srcPort = sourceNode?.data.ports.find((p: AVPort) => p.id === srcPortId)
                const tgtPort = targetNode?.data.ports.find((p: AVPort) => p.id === tgtPortId)
                return (
                  <div className="text-[11px] space-y-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground shrink-0">From:</span>
                        <span className="font-medium truncate">{sourceNode?.data.label ?? 'Unknown'}</span>
                      </div>
                      {srcPort && (
                        <div className="text-[10px] text-muted-foreground pl-[38px]">
                          {srcPort.label}
                          <span className="text-muted-foreground/50 ml-1">({(edgeData?.connector ?? srcPort.connector).toUpperCase()})</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground shrink-0">To:</span>
                        <span className="font-medium truncate">{targetNode?.data.label ?? 'Unknown'}</span>
                      </div>
                      {tgtPort && (
                        <div className="text-[10px] text-muted-foreground pl-[38px]">
                          {tgtPort.label}
                          <span className="text-muted-foreground/50 ml-1">({tgtPort.connector.toUpperCase()})</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Connection warning */}
            {edgeData?.warning && (
              <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
                <TriangleAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-[11px] text-amber-600 dark:text-amber-400 leading-tight">
                  {edgeData.warning}
                </span>
              </div>
            )}

            <Separator />

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={deleteSelected}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete Connection
            </Button>
          </div>
        </ScrollArea>
      </div>
    )
  }

  // No selection — show system summary
  if (!selectedNode) {
    const equipment = nodes.filter((n) => n.type !== 'group')
    const sources = equipment.filter((n) => n.data.deviceRole === 'source').length
    const processors = equipment.filter((n) => n.data.deviceRole === 'processor').length
    const destinations = equipment.filter((n) => n.data.deviceRole === 'destination').length
    const infra = equipment.filter((n) => n.data.deviceRole === 'infrastructure').length
    const unassigned = equipment.length - sources - processors - destinations - infra

    const audioCables = edges.filter((e) => e.data?.domain === 'audio').length
    const videoCables = edges.filter((e) => e.data?.domain === 'video').length
    const networkCables = edges.filter((e) => e.data?.domain === 'network' || e.data?.domain === 'av-over-ip').length
    const powerCables = edges.filter((e) => e.data?.domain === 'power').length

    const errors = chainIssuesFromStore.filter((i) => i.severity === 'error').length
    const warnings = chainIssuesFromStore.filter((i) => i.severity === 'warning').length

    let totalW = 0
    for (const n of equipment) {
      const m = n.data.powerDraw?.match(/(\d+(?:\.\d+)?)\s*[Ww]/)
      if (m) totalW += parseFloat(m[1])
    }

    if (equipment.length === 0 && edges.length === 0) {
      return (
        <div className="border-l border-border bg-sidebar flex flex-col items-center justify-center p-6 text-center">
          <div className="text-xs text-muted-foreground leading-relaxed">
            Drag equipment from the library to start designing
          </div>
        </div>
      )
    }

    return (
      <div className="border-l border-border bg-sidebar flex flex-col h-full">
        <div className="p-3 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              System Summary
            </h2>
          </div>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Equipment */}
            <div className="space-y-1.5">
              <Label className="text-xs">Equipment ({equipment.length})</Label>
              <div className="grid grid-cols-2 gap-1">
                {sources > 0 && <div className="text-[10px] text-muted-foreground">{sources} source{sources !== 1 ? 's' : ''}</div>}
                {processors > 0 && <div className="text-[10px] text-muted-foreground">{processors} processor{processors !== 1 ? 's' : ''}</div>}
                {destinations > 0 && <div className="text-[10px] text-muted-foreground">{destinations} destination{destinations !== 1 ? 's' : ''}</div>}
                {infra > 0 && <div className="text-[10px] text-muted-foreground">{infra} infrastructure</div>}
                {unassigned > 0 && <div className="text-[10px] text-muted-foreground/60">{unassigned} unassigned</div>}
              </div>
            </div>

            {/* Cables */}
            {edges.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cables ({edges.length})</Label>
                <div className="grid grid-cols-2 gap-1">
                  {audioCables > 0 && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3B82F6]" />{audioCables} audio</div>}
                  {videoCables > 0 && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22C55E]" />{videoCables} video</div>}
                  {networkCables > 0 && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EAB308]" />{networkCables} network</div>}
                  {powerCables > 0 && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EF4444]" />{powerCables} power</div>}
                </div>
              </div>
            )}

            {/* Power */}
            {totalW > 0 && (
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Zap className="w-3 h-3" /> Power Draw</Label>
                <div className="text-[10px] text-muted-foreground">
                  {totalW >= 1000 ? `${(totalW / 1000).toFixed(1)} kW` : `${totalW}W`}
                  <span className="text-muted-foreground/50 ml-1">({(totalW / 120).toFixed(1)}A @ 120V)</span>
                </div>
              </div>
            )}

            {/* Validation */}
            {chainIssuesFromStore.length > 0 ? (
              <div className="space-y-1">
                <Label className="text-xs">Validation</Label>
                <div className="flex items-center gap-2 text-[10px]">
                  {errors > 0 && <span className="text-red-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{errors} error{errors !== 1 ? 's' : ''}</span>}
                  {warnings > 0 && <span className="text-amber-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{warnings} warning{warnings !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            ) : equipment.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                No issues detected
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // Node properties view
  const data: AVNodeData = selectedNode.data
  const def = getComponentDef(data.componentType)
  const Icon = getIcon(def?.icon ?? 'BoxSelect')

  const isGeneric = data.isGenericInstance !== false
  const isConfigurable = !!data.configurableIO
  const isRealGearFixed = !isGeneric && !isConfigurable

  const CONNECTOR_LABELS: Record<string, string> = {
    xlr: 'XLR', trs: 'TRS', rca: 'RCA', hdmi: 'HDMI', sdi: 'SDI',
    ethernet: 'Ethernet', dante: 'Dante', usb: 'USB', speakon: 'Speakon',
    powercon: 'powerCON', dmx: 'DMX', fiber: 'Fiber', aes50: 'AES50', ndi: 'NDI',
    wifi: 'Wi-Fi', thunderbolt: 'Thunderbolt', db9: 'DB-9', bnc: 'BNC',
    displayport: 'DisplayPort', sd: 'SD Card',
  }

  const addPort = (direction: PortDirection) => {
    const newPort: AVPort = {
      id: generateId(),
      label: direction === 'input' ? `In ${data.ports.length + 1}` : `Out ${data.ports.length + 1}`,
      domain: 'audio' as SignalDomain,
      connector: 'xlr' as ConnectorType,
      direction,
    }
    updateNodeData(selectedNode.id, { ports: [...data.ports, newPort] })
  }

  const removePort = (portId: string) => {
    updateNodeData(selectedNode.id, {
      ports: data.ports.filter((p: AVPort) => p.id !== portId),
    })
  }

  const updatePort = (portId: string, updates: Partial<AVPort>) => {
    updateNodeData(selectedNode.id, {
      ports: data.ports.map((p: AVPort) => (p.id === portId ? { ...p, ...updates } : p)),
    })
  }

  const togglePortEnabled = (portId: string) => {
    updateNodeData(selectedNode.id, {
      ports: data.ports.map((p: AVPort) =>
        p.id === portId ? { ...p, enabled: !(p.enabled ?? true) } : p
      ),
    })
  }

  return (
    <div className="border-l border-border bg-sidebar flex flex-col h-full animate-panel-slide-in">
      <div className="p-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Properties
          </h2>
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Label */}
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              value={data.label}
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
              className="h-7 text-xs"
            />
          </div>

          {/* Manufacturer (read-only for real gear) */}
          {data.manufacturer && (
            <div className="space-y-1">
              <Label className="text-xs">Manufacturer</Label>
              <div className="text-xs text-foreground px-3 py-1.5 bg-muted/50 rounded-md border border-border">
                {data.manufacturer}
              </div>
            </div>
          )}

          {/* Model */}
          <div className="space-y-1">
            <Label className="text-xs">Model</Label>
            {isGeneric ? (
              <Input
                value={data.model ?? ''}
                onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                placeholder="e.g. Yamaha CL5"
                className="h-7 text-xs"
              />
            ) : (
              <div className="text-xs text-foreground px-3 py-1.5 bg-muted/50 rounded-md border border-border">
                {data.model ?? '—'}
              </div>
            )}
          </div>

          {/* Power Draw (when present) */}
          {data.powerDraw && (
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Power Draw
              </Label>
              <div className="text-xs text-foreground px-3 py-1.5 bg-muted/50 rounded-md border border-border">
                {data.powerDraw}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <textarea
              value={data.notes ?? ''}
              onChange={(e) => updateNodeData(selectedNode.id, { notes: e.target.value })}
              placeholder="Additional notes..."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              rows={2}
            />
          </div>

          {/* Device Role */}
          <div className="space-y-1">
            <Label className="text-xs">Device Role</Label>
            <select
              value={data.deviceRole ?? ''}
              onChange={(e) => updateNodeData(selectedNode.id, { deviceRole: (e.target.value || undefined) as DeviceRole | undefined })}
              className="h-7 text-xs border border-input rounded px-2 bg-transparent w-full"
            >
              <option value="">Not set</option>
              <option value="source">Source</option>
              <option value="destination">Destination</option>
              <option value="processor">Processor</option>
              <option value="infrastructure">Infrastructure</option>
            </select>
          </div>

          <Separator />

          {/* Ports — Mode 1: Generic (free edit) */}
          {isGeneric && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ports</Label>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => addPort('input')} title="Add input port">
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => addPort('output')} title="Add output port">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                {data.ports.map((port: AVPort) => {
                  const variants = CONNECTOR_VARIANTS[port.connector] ?? []
                  return (
                    <div key={port.id} className="space-y-1 group">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getSignalColor(port.domain) }}
                          title={SIGNAL_LABELS[port.domain]}
                        />
                        <Input
                          value={port.label}
                          onChange={(e) => updatePort(port.id, { label: e.target.value })}
                          className="h-6 text-[10px] flex-1"
                        />
                        <select
                          value={port.domain}
                          onChange={(e) => updatePort(port.id, { domain: e.target.value as SignalDomain })}
                          className="h-6 text-[10px] border border-input rounded px-1 bg-transparent"
                        >
                          <option value="audio">Audio</option>
                          <option value="video">Video</option>
                          <option value="network">Network</option>
                          <option value="power">Power</option>
                          <option value="av-over-ip">AV-over-IP</option>
                        </select>
                        <select
                          value={port.direction}
                          onChange={(e) => updatePort(port.id, { direction: e.target.value as PortDirection })}
                          className="h-6 text-[10px] border border-input rounded px-1 bg-transparent"
                        >
                          <option value="input">In</option>
                          <option value="output">Out</option>
                          <option value="bidirectional">Bi</option>
                          <option value="undefined">?</option>
                        </select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={() => removePort(port.id)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                      </div>
                      {variants.length > 0 && (
                        <div className="flex items-center gap-1.5 pl-3.5">
                          <select
                            value={port.variant ?? ''}
                            onChange={(e) => updatePort(port.id, {
                              variant: (e.target.value || undefined) as ConnectorVariant | undefined,
                            })}
                            className="h-5 text-[9px] border border-input rounded px-1 bg-transparent flex-1 text-muted-foreground"
                          >
                            <option value="">No variant</option>
                            {variants.map((v) => (
                              <option key={v} value={v}>{VARIANT_LABELS[v]}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 pl-3.5">
                        {port.conferenceRole && (
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: CONFERENCE_ROLE_COLORS[port.conferenceRole] }}
                          />
                        )}
                        <select
                          value={port.conferenceRole ?? ''}
                          onChange={(e) => updatePort(port.id, {
                            conferenceRole: (e.target.value || undefined) as ConferenceRole | undefined,
                          })}
                          className="h-5 text-[9px] border border-input rounded px-1 bg-transparent flex-1 text-muted-foreground"
                        >
                          <option value="">No conference role</option>
                          {ALL_CONFERENCE_ROLES.map((r) => (
                            <option key={r} value={r}>{CONFERENCE_ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Ports — Mode 2: Real gear, fixed I/O (read-only) */}
          {isRealGearFixed && (
            <div className="space-y-2">
              <Label className="text-xs">Ports (Fixed I/O)</Label>
              <div className="space-y-1">
                {data.ports.map((port: AVPort) => (
                  <div key={port.id} className="space-y-0.5">
                    <div className="flex items-center gap-1.5 px-1 py-0.5">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getSignalColor(port.domain) }}
                        title={SIGNAL_LABELS[port.domain]}
                      />
                      <span className="text-[10px] flex-1 truncate">{port.label}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {CONNECTOR_LABELS[port.connector] ?? port.connector}
                        {port.variant && ` (${VARIANT_LABELS[port.variant]})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-1">
                      {port.conferenceRole && (
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: CONFERENCE_ROLE_COLORS[port.conferenceRole] }}
                        />
                      )}
                      <select
                        value={port.conferenceRole ?? ''}
                        onChange={(e) => updatePort(port.id, {
                          conferenceRole: (e.target.value || undefined) as ConferenceRole | undefined,
                        })}
                        className="h-5 text-[9px] border border-input rounded px-1 bg-transparent flex-1 text-muted-foreground"
                      >
                        <option value="">No conference role</option>
                        {ALL_CONFERENCE_ROLES.map((r) => (
                          <option key={r} value={r}>{CONFERENCE_ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ports — Mode 3: Configurable I/O (toggle switches) */}
          {isConfigurable && (
            <div className="space-y-2">
              <Label className="text-xs">Ports (Configurable I/O)</Label>
              <div className="space-y-1">
                {data.ports.map((port: AVPort) => {
                  const enabled = port.enabled ?? true
                  return (
                    <div
                      key={port.id}
                      className="space-y-0.5"
                      style={{ opacity: enabled ? 1 : 0.5 }}
                    >
                      <div className="flex items-center gap-1.5 px-1 py-0.5">
                        <button
                          onClick={() => togglePortEnabled(port.id)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          title={enabled ? 'Disable port' : 'Enable port'}
                        >
                          {enabled ? (
                            <ToggleRight className="w-4 h-4 text-primary" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getSignalColor(port.domain) }}
                          title={SIGNAL_LABELS[port.domain]}
                        />
                        <span className="text-[10px] flex-1 truncate">{port.label}</span>
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {CONNECTOR_LABELS[port.connector] ?? port.connector}
                          {port.variant && ` (${VARIANT_LABELS[port.variant]})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-1 pl-6">
                        {port.conferenceRole && (
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: CONFERENCE_ROLE_COLORS[port.conferenceRole] }}
                          />
                        )}
                        <select
                          value={port.conferenceRole ?? ''}
                          onChange={(e) => updatePort(port.id, {
                            conferenceRole: (e.target.value || undefined) as ConferenceRole | undefined,
                          })}
                          className="h-5 text-[9px] border border-input rounded px-1 bg-transparent flex-1 text-muted-foreground"
                        >
                          <option value="">No conference role</option>
                          {ALL_CONFERENCE_ROLES.map((r) => (
                            <option key={r} value={r}>{CONFERENCE_ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Product Info & Specs */}
          {!!(def?.images?.length || def?.specs || def?.bhUrl || data.images || data.specs || data.bhUrl) && (
            <>
              <Separator />
              <ProductInfo
                def={def}
                image={data.image as string | undefined}
                nodeImages={data.images as string[] | undefined}
                nodeSpecs={data.specs as Record<string, Record<string, string>> | undefined}
                nodeBhUrl={data.bhUrl as string | undefined}
              />
            </>
          )}

          <Separator />

          {/* 3D Model section — only in 3D view */}
          {viewMode === '3d' && (
            <>
              <Separator />
              <Model3DSection
                componentType={data.componentType}
                status={model3dStatus[data.componentType]}
                hasImage={!!data.image}
              />
            </>
          )}

          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={deleteSelected}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Delete Component
          </Button>
        </div>
      </ScrollArea>
    </div>
  )
}

/* ── Product Info sub-component ── */

function SpecSection({ title, entries }: { title: string; entries: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  const keys = Object.keys(entries)
  if (keys.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors py-1"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
        <span className="font-normal text-[9px] ml-auto tabular-nums">{keys.length}</span>
      </button>
      {open && (
        <div className="space-y-0.5 ml-4 mb-2">
          {keys.map((key) => (
            <div key={key} className="grid grid-cols-[1fr_1fr] gap-1 text-[10px] leading-snug">
              <span className="text-muted-foreground truncate" title={key}>{key}</span>
              <span className="text-foreground break-words">{entries[key]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductInfo({ def, image, nodeImages, nodeSpecs, nodeBhUrl }: {
  def?: AVComponentDef
  image?: string
  nodeImages?: string[]
  nodeSpecs?: Record<string, Record<string, string>>
  nodeBhUrl?: string
}) {
  const [imgIdx, setImgIdx] = useState(0)
  const images = def?.images ?? nodeImages ?? []
  const displayImage = image || images[imgIdx]
  const specs = def?.specs ?? nodeSpecs
  const bhUrl = def?.bhUrl ?? nodeBhUrl
  const label = def?.label ?? 'Product'

  return (
    <div className="space-y-3">
      {/* Product image */}
      {(displayImage || images.length > 0) && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Image className="w-3 h-3" />
            Product Image
          </Label>
          {displayImage && (
            <div className="rounded-md border border-border overflow-hidden bg-white">
              <img
                src={displayImage}
                alt={label}
                className="w-full h-auto object-contain max-h-48"
              />
            </div>
          )}
          {images.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`shrink-0 w-10 h-10 rounded border overflow-hidden bg-white ${
                    i === imgIdx ? 'border-primary ring-1 ring-primary' : 'border-border'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Specs */}
      {specs && Object.keys(specs).length > 0 && (
        <div className="space-y-0.5">
          <Label className="text-xs">Specifications</Label>
          <div className="rounded-md border border-border bg-muted/30 p-2 space-y-0.5">
            {Object.entries(specs).map(([category, entries]) => (
              <SpecSection key={category} title={category} entries={entries} />
            ))}
          </div>
        </div>
      )}

      {/* B&H Link */}
      {bhUrl && (
        <a
          href={bhUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          View on B&H Photo
        </a>
      )}
    </div>
  )
}

/* ── 3D Model sub-component ── */

function Model3DSection({ componentType, status, hasImage }: {
  componentType: string
  status?: string
  hasImage: boolean
}) {
  const [regenerating, setRegenerating] = useState(false)

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      const { deleteCachedModel } = await import('@/lib/model3d-manager')
      await deleteCachedModel(componentType)
      // Re-trigger generation via store
      const store = useDiagramStore.getState()
      store.generate3DModels()
    } finally {
      setRegenerating(false)
    }
  }, [componentType])

  const statusLabel = !hasImage ? 'No Image' : status === 'ready' ? 'Ready' : status === 'generating' ? 'Generating...' : status === 'failed' ? 'Failed' : 'Pending'
  const statusColor = status === 'ready' ? 'text-green-500' : status === 'generating' ? 'text-blue-500' : status === 'failed' ? 'text-red-500' : 'text-muted-foreground'

  return (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1">
        <Box className="w-3 h-3" />
        3D Model
      </Label>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-medium ${statusColor}`}>
          {status === 'generating' && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}
          {statusLabel}
        </span>
        <div className="flex-1" />
        {hasImage && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={handleRegenerate}
            disabled={regenerating || status === 'generating'}
          >
            <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        )}
      </div>
    </div>
  )
}
