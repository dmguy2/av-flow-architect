import { create } from 'zustand'
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import type { AVNodeData, AVEdgeData, DiagramMode, AVProject, AVPort, SignalDomain, ProjectPage, ViewMode } from '@/types/av'
import { validateConnection } from '@/lib/connection-validation'
import { traceSignalChains } from '@/lib/signal-chain'
import { analyzeChainsDeterministic, analyzeGraphIssues, type ChainIssue } from '@/lib/signal-chain-rules'
import { analyzeChainWithLLM, type LLMChainIssue } from '@/lib/chain-analysis-api'
import type { SignalChain } from '@/lib/signal-chain'
import { migrateNodes, migrateEdges } from '@/lib/domain-migration'
import type { GroupNodeData } from '@/components/canvas/GroupNode'
import { generateId } from '@/lib/utils'
import { db } from '@/db'
import { log } from '@/lib/logger'

type Model3DStatus = 'pending' | 'generating' | 'ready' | 'failed'

interface HistorySnapshot {
  nodes: Node<AVNodeData>[]
  edges: Edge<AVEdgeData>[]
}

interface DiagramState {
  // Project
  projectId: string
  projectName: string
  preparedBy: string
  mode: DiagramMode
  isDirty: boolean

  // Pages
  pages: ProjectPage[]
  activePageId: string

  // Canvas (active page view)
  nodes: Node<AVNodeData>[]
  edges: Edge<AVEdgeData>[]
  selectedNodeId: string | null

  // History (per-page, resets on page switch)
  past: HistorySnapshot[]
  future: HistorySnapshot[]

  // Theme
  darkMode: boolean

  // Page actions
  addPage: (label?: string) => void
  deletePage: (pageId: string) => void
  renamePage: (pageId: string, label: string) => void
  setActivePage: (pageId: string) => void
  getActivePageIndex: () => number

  // Actions
  onNodesChange: OnNodesChange<Node<AVNodeData>>
  onEdgesChange: OnEdgesChange<Edge<AVEdgeData>>
  onConnect: (connection: Connection) => void
  addNode: (node: Node<AVNodeData>) => void
  deleteSelected: () => void
  setSelectedNode: (id: string | null) => void
  focusNodeId: string | null
  focusNode: (id: string) => void
  updateNodeData: (nodeId: string, data: Partial<AVNodeData>, options?: { silent?: boolean }) => void
  setMode: (mode: DiagramMode) => void
  setProjectName: (name: string) => void
  setPreparedBy: (name: string) => void
  setDarkMode: (dark: boolean) => void

  // History
  undo: () => void
  redo: () => void
  pushHistory: () => void

  // Persistence
  saveProject: () => Promise<void>
  loadProject: (id: string) => Promise<void>
  newProject: (name?: string) => void
  loadProjects: () => Promise<AVProject[]>
  deleteProject: (id: string) => Promise<void>
  setNodesAndEdges: (nodes: Node<AVNodeData>[], edges: Edge<AVEdgeData>[]) => void

  // Grouping
  groupSelectedNodes: (label?: string, color?: string) => void
  ungroupNodes: (groupId: string) => void

  // Edge data
  updateEdgeData: (edgeId: string, data: Partial<AVEdgeData>, options?: { silent?: boolean }) => void
  selectedEdgeId: string | null
  setSelectedEdge: (id: string | null) => void
  editingEdgeId: string | null
  setEditingEdge: (id: string | null) => void

  // Bulk operations
  duplicateSelected: () => void
  alignNodes: (axis: 'horizontal' | 'vertical') => void
  distributeNodes: (axis: 'horizontal' | 'vertical') => void

  // File import/export
  exportProjectFile: () => void
  importProjectFile: (file: File) => Promise<void>

  // Clipboard
  clipboard: { nodes: Node<AVNodeData>[]; edges: Edge<AVEdgeData>[] } | null
  copySelected: () => void
  pasteClipboard: () => void
  selectAll: () => void

  // Layers
  layerVisibility: Record<SignalDomain, boolean>
  focusedLayer: SignalDomain | null
  showEdgeLabels: boolean
  viewMode: ViewMode
  showProductImages: boolean
  setViewMode: (mode: ViewMode) => void
  setShowProductImages: (show: boolean) => void

  // 3D model state
  model3dUrls: Record<string, string>
  model3dStatus: Record<string, Model3DStatus>
  model3dError: Record<string, string>
  reset3DModelStatus: (componentType: string) => void
  generate3DModels: () => Promise<void>
  toggleLayerVisibility: (domain: SignalDomain) => void
  setFocusedLayer: (domain: SignalDomain | null) => void
  setShowEdgeLabels: (show: boolean) => void

  // Signal chain analysis
  signalChains: SignalChain[]
  chainIssues: ChainIssue[]
  llmIssues: LLMChainIssue[]
  isAnalyzing: boolean
  llmAnalysisSummary: string | null
  showSignalChainPanel: boolean
  setShowSignalChainPanel: (show: boolean) => void
  runSignalChainAnalysis: () => void
  runLLMAnalysis: (chainId: string) => Promise<void>
  clearChainAnalysis: () => void
}

const MAX_HISTORY = 50

const defaultPageId = generateId()

export const useDiagramStore = create<DiagramState>((set, get) => ({
  projectId: generateId(),
  projectName: 'Untitled Diagram',
  preparedBy: '',
  mode: 'signal-flow',
  isDirty: false,

  pages: [{ id: defaultPageId, label: 'Page 1', nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }],
  activePageId: defaultPageId,

  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  editingEdgeId: null,
  focusNodeId: null,

  past: [],
  future: [],

  clipboard: null,
  darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,

  layerVisibility: { audio: true, video: true, network: true, power: true, 'av-over-ip': true },
  focusedLayer: null,
  showEdgeLabels: false,
  viewMode: 'module',
  showProductImages: false,

  // 3D model state
  model3dUrls: {},
  model3dStatus: {},
  model3dError: {},

  // Signal chain analysis
  signalChains: [],
  chainIssues: [],
  llmIssues: [],
  isAnalyzing: false,
  llmAnalysisSummary: null,
  showSignalChainPanel: false,
  setShowSignalChainPanel: (show) => set({ showSignalChainPanel: show }),

  onNodesChange: (changes) => {
    // Log non-position/dimension changes to avoid per-pixel drag spam
    for (const c of changes) {
      if (c.type !== 'position' && c.type !== 'dimensions') {
        log('CANVAS', `Node change: ${c.type}`, 'id' in c ? c.id : undefined, 'debug')
      }
    }
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }))
  },

  onEdgesChange: (changes) => {
    for (const c of changes) {
      if (c.type === 'remove') {
        log('CANVAS', `Edge removed`, 'id' in c ? c.id : undefined)
      }
    }
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }))
  },

  onConnect: (connection: Connection) => {
    const { nodes, edges, pushHistory } = get()

    const sourcePortId = connection.sourceHandle?.replace(/-(?:target|source)$/, '') ?? connection.sourceHandle
    const targetPortId = connection.targetHandle?.replace(/-(?:target|source)$/, '') ?? connection.targetHandle

    // Enforce one connection per physical port — reject if either port is already wired
    const portInUse = edges.some((e) => {
      const eSrc = e.sourceHandle?.replace(/-(?:target|source)$/, '') ?? e.sourceHandle
      const eTgt = e.targetHandle?.replace(/-(?:target|source)$/, '') ?? e.targetHandle
      return (
        (e.source === connection.source && eSrc === sourcePortId) ||
        (e.target === connection.source && eTgt === sourcePortId) ||
        (e.source === connection.target && eSrc === targetPortId) ||
        (e.target === connection.target && eTgt === targetPortId)
      )
    })
    if (portInUse) {
      log('CONNECTION', 'Connection rejected: port already in use', `${connection.source}:${sourcePortId} → ${connection.target}:${targetPortId}`, 'warn')
      return
    }

    pushHistory()
    const sourceNode = nodes.find((n) => n.id === connection.source)
    const sourcePort = sourceNode?.data.ports.find(
      (p: AVPort) => p.id === sourcePortId
    )
    const targetNode = nodes.find((n) => n.id === connection.target)
    const targetPort = targetNode?.data.ports.find(
      (p: AVPort) => p.id === targetPortId
    )

    // Auto-assign cable ID
    let maxCableNum = 0
    for (const e of edges) {
      const m = e.data?.label?.match(/^C-(\d+)$/)
      if (m) maxCableNum = Math.max(maxCableNum, parseInt(m[1], 10))
    }
    const cableLabel = `C-${String(maxCableNum + 1).padStart(2, '0')}`

    const edgeData: AVEdgeData = {
      domain: sourcePort?.domain ?? 'audio',
      connector: sourcePort?.connector ?? 'xlr',
      ...(sourcePort?.variant && { variant: sourcePort.variant }),
      label: cableLabel,
    }

    // Attach warning if validation produces a warn-tier result
    if (sourcePort && targetPort) {
      const result = validateConnection(sourcePort, targetPort)
      if (result.tier === 'warn' && result.message) {
        edgeData.warning = result.message
      }
    }

    const srcLabel = sourceNode?.data.label ?? connection.source
    const tgtLabel = targetNode?.data.label ?? connection.target
    const srcPortLabel = sourcePort?.label ?? sourcePortId
    const tgtPortLabel = targetPort?.label ?? targetPortId
    log('CONNECTION', `${cableLabel}: ${srcLabel}:${srcPortLabel} → ${tgtLabel}:${tgtPortLabel}`, edgeData.connector)

    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: 'avEdge',
          data: edgeData,
        },
        state.edges
      ),
      isDirty: true,
    }))
  },

  addNode: (node) => {
    const { pushHistory } = get()
    pushHistory()
    log('STORE', `Added node: "${node.data.label}"`, node.id)
    set((state) => ({
      nodes: [...state.nodes, node],
      isDirty: true,
    }))
  },

  deleteSelected: () => {
    const { pushHistory, selectedNodeId, selectedEdgeId, nodes: currentNodes } = get()
    pushHistory()
    if (selectedEdgeId) {
      log('STORE', `Deleted edge`, selectedEdgeId)
    } else {
      const selected = currentNodes.filter((n) => n.selected)
      if (selected.length > 0) {
        log('STORE', `Deleted ${selected.length} node(s)`, selected.map((n) => n.data.label).join(', '))
      }
    }
    set((state) => {
      // If an edge is selected, delete it
      if (selectedEdgeId) {
        return {
          edges: state.edges.filter((e) => e.id !== selectedEdgeId),
          selectedEdgeId: null,
          isDirty: true,
        }
      }
      // Otherwise delete selected nodes + their connected edges
      return {
        nodes: state.nodes.filter((n) => !n.selected),
        edges: state.edges.filter(
          (e) =>
            !state.nodes.some((n) => n.selected && (e.source === n.id || e.target === n.id))
        ),
        selectedNodeId: state.nodes.find((n) => n.selected)?.id === selectedNodeId ? null : selectedNodeId,
        isDirty: true,
      }
    })
  },

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  focusNode: (id) => set({ focusNodeId: id, selectedNodeId: id, selectedEdgeId: null }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setEditingEdge: (id) => set({ editingEdgeId: id }),

  updateNodeData: (nodeId, data, options?) => {
    if (!options?.silent) {
      const { pushHistory } = get()
      pushHistory()
    }
    const node = get().nodes.find((n) => n.id === nodeId)
    log('STORE', `Updated node data: "${node?.data.label ?? nodeId}"`, Object.keys(data).join(', '), 'debug')
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    }))
  },

  setMode: (mode) => {
    log('VIEW', `Mode changed to: ${mode}`)
    const nodeType = mode === 'signal-flow' ? 'signalFlow' : 'physicalLayout'
    set((state) => ({
      mode,
      nodes: state.nodes.map((n) =>
        n.type === 'group' || n.type === 'offsheetConnector' ? n : { ...n, type: nodeType }
      ),
    }))
  },
  setProjectName: (name) => set({ projectName: name, isDirty: true }),
  setPreparedBy: (name: string) => set({ preparedBy: name, isDirty: true }),
  setDarkMode: (dark) => {
    document.documentElement.classList.toggle('dark', dark)
    set({ darkMode: dark })
  },

  // ── Page management ──

  addPage: (label?: string) => {
    const { pages, nodes, edges, activePageId } = get()
    const newPageId = generateId()
    const newLabel = label ?? `Page ${pages.length + 1}`
    log('PROJECT', `Added page: "${newLabel}"`)


    // Save current page state before switching
    const updatedPages = pages.map((p) =>
      p.id === activePageId ? { ...p, nodes, edges } : p
    )

    const newPage: ProjectPage = {
      id: newPageId,
      label: newLabel,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }

    set({
      pages: [...updatedPages, newPage],
      activePageId: newPageId,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      past: [],
      future: [],
      isDirty: true,
    })
  },

  deletePage: (pageId: string) => {
    const { pages, activePageId } = get()
    if (pages.length <= 1) return // Can't delete last page
    const page = pages.find((p) => p.id === pageId)
    log('PROJECT', `Deleted page: "${page?.label ?? pageId}"`)


    const remaining = pages.filter((p) => p.id !== pageId)
    if (activePageId === pageId) {
      // Switch to first remaining page
      const target = remaining[0]
      set({
        pages: remaining,
        activePageId: target.id,
        nodes: target.nodes,
        edges: target.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        past: [],
        future: [],
        isDirty: true,
      })
    } else {
      set({ pages: remaining, isDirty: true })
    }
  },

  renamePage: (pageId: string, label: string) => {
    set((state) => ({
      pages: state.pages.map((p) => (p.id === pageId ? { ...p, label } : p)),
      isDirty: true,
    }))
  },

  setActivePage: (pageId: string) => {
    const { pages, activePageId, nodes, edges } = get()
    if (pageId === activePageId) return
    const target = pages.find((p) => p.id === pageId)
    log('PROJECT', `Switched to page: "${target?.label ?? pageId}"`)


    // Save current page state
    const updatedPages = pages.map((p) =>
      p.id === activePageId ? { ...p, nodes, edges } : p
    )

    // Load target page
    const targetPage = updatedPages.find((p) => p.id === pageId)
    if (!targetPage) return

    set({
      pages: updatedPages,
      activePageId: pageId,
      nodes: targetPage.nodes,
      edges: targetPage.edges,
      selectedNodeId: null,
      selectedEdgeId: null,
      past: [],
      future: [],
    })
  },

  getActivePageIndex: () => {
    const { pages, activePageId } = get()
    return pages.findIndex((p) => p.id === activePageId)
  },

  pushHistory: () => {
    set((state) => ({
      past: [...state.past.slice(-MAX_HISTORY), { nodes: state.nodes, edges: state.edges }],
      future: [],
    }))
  },

  undo: () => {
    const { past, nodes, edges } = get()
    if (past.length === 0) return
    log('STORE', 'Undo', `${past.length} step(s) remaining`)

    const prev = past[past.length - 1]
    set({
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...get().future],
      nodes: prev.nodes,
      edges: prev.edges,
      isDirty: true,
    })
  },

  redo: () => {
    const { future, nodes, edges } = get()
    if (future.length === 0) return
    log('STORE', 'Redo', `${future.length} step(s) remaining`)

    const next = future[0]
    set({
      future: future.slice(1),
      past: [...get().past, { nodes, edges }],
      nodes: next.nodes,
      edges: next.edges,
      isDirty: true,
    })
  },

  saveProject: async () => {
    const state = get()
    log('PROJECT', `Saving project: "${state.projectName}"`)

    // Sync current page state into pages array
    const syncedPages = state.pages.map((p) =>
      p.id === state.activePageId ? { ...p, nodes: state.nodes, edges: state.edges } : p
    )
    const project: AVProject = {
      id: state.projectId,
      name: state.projectName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: state.mode,
      nodes: state.nodes,
      edges: state.edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      layerVisibility: state.layerVisibility,
      focusedLayer: state.focusedLayer,
      showEdgeLabels: state.showEdgeLabels,
      pages: syncedPages,
      activePageId: state.activePageId,
      viewMode: state.viewMode,
      preparedBy: state.preparedBy || undefined,
    }
    await db.projects.put(project)
    set({ pages: syncedPages, isDirty: false })
  },

  loadProject: async (id: string) => {
    const project = await db.projects.get(id)
    if (!project) return
    log('PROJECT', `Loading project: "${project.name}"`, `${project.pages?.length ?? 1} page(s)`)


    // Migrate old single-page projects to pages format
    let pages: ProjectPage[]
    let activePageId: string
    if (project.pages && project.pages.length > 0) {
      pages = project.pages.map((p) => ({
        ...p,
        nodes: migrateNodes(p.nodes),
        edges: migrateEdges(p.edges),
      }))
      activePageId = project.activePageId ?? pages[0].id
    } else {
      // Old format: wrap flat nodes/edges in a single page
      const pageId = generateId()
      pages = [{
        id: pageId,
        label: 'Page 1',
        nodes: migrateNodes(project.nodes),
        edges: migrateEdges(project.edges),
        viewport: project.viewport ?? { x: 0, y: 0, zoom: 1 },
      }]
      activePageId = pageId
    }

    const activePage = pages.find((p) => p.id === activePageId) ?? pages[0]

    set({
      projectId: project.id,
      projectName: project.name,
      mode: project.mode,
      pages,
      activePageId: activePage.id,
      nodes: activePage.nodes,
      edges: activePage.edges,
      layerVisibility: project.layerVisibility ?? { audio: true, video: true, network: true, power: true, 'av-over-ip': true },
      focusedLayer: project.focusedLayer ?? null,
      showEdgeLabels: project.showEdgeLabels ?? false,
      viewMode: project.viewMode ?? 'module',
      showProductImages: (project.viewMode ?? 'module') === 'image',
      preparedBy: project.preparedBy ?? '',
      isDirty: false,
      past: [],
      future: [],
      selectedNodeId: null,
    })
  },

  newProject: (name?: string) => {
    log('PROJECT', `New project: "${name ?? 'Untitled Diagram'}"`)
    const pageId = generateId()
    set({
      projectId: generateId(),
      projectName: name ?? 'Untitled Diagram',
      preparedBy: '',
      mode: 'signal-flow',
      pages: [{ id: pageId, label: 'Page 1', nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }],
      activePageId: pageId,
      nodes: [],
      edges: [],
      isDirty: false,
      past: [],
      future: [],
      selectedNodeId: null,
      layerVisibility: { audio: true, video: true, network: true, power: true, 'av-over-ip': true },
      focusedLayer: null,
      showEdgeLabels: false,
    })
  },

  loadProjects: async () => {
    return db.projects.orderBy('updatedAt').reverse().toArray()
  },

  deleteProject: async (id: string) => {
    log('PROJECT', `Deleted project`, id)
    await db.projects.delete(id)
  },

  duplicateSelected: () => {
    const { nodes, edges, pushHistory } = get()
    const selected = nodes.filter((n) => n.selected)
    if (selected.length === 0) return

    pushHistory()
    log('STORE', `Duplicated ${selected.length} node(s)`, selected.map((n) => n.data.label).join(', '))

    const OFFSET = 40
    const idMap = new Map<string, string>()

    const newNodes = selected.map((n) => {
      const newId = generateId()
      idMap.set(n.id, newId)
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
        selected: true,
        data: { ...n.data },
      }
    })

    // Duplicate internal edges (both source and target in selection)
    const selectedIds = new Set(selected.map((n) => n.id))
    const newEdges = edges
      .filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
      .map((e) => ({
        ...e,
        id: generateId(),
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
        data: e.data ? { ...e.data } : undefined,
      }))

    set((state) => ({
      nodes: [
        ...state.nodes.map((n) => ({ ...n, selected: false })),
        ...newNodes,
      ],
      edges: [...state.edges, ...newEdges],
      isDirty: true,
    }))
  },

  alignNodes: (axis) => {
    const { nodes, pushHistory } = get()
    const selected = nodes.filter((n) => n.selected && n.type !== 'group')
    if (selected.length < 2) return

    pushHistory()
    log('STORE', `Aligned ${selected.length} nodes ${axis}ly`)


    if (axis === 'horizontal') {
      // Align to average Y
      const avgY = selected.reduce((sum, n) => sum + n.position.y, 0) / selected.length
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.selected && n.type !== 'group' ? { ...n, position: { ...n.position, y: avgY } } : n
        ),
        isDirty: true,
      }))
    } else {
      // Align to average X
      const avgX = selected.reduce((sum, n) => sum + n.position.x, 0) / selected.length
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.selected && n.type !== 'group' ? { ...n, position: { ...n.position, x: avgX } } : n
        ),
        isDirty: true,
      }))
    }
  },

  distributeNodes: (axis) => {
    const { nodes, pushHistory } = get()
    const selected = nodes.filter((n) => n.selected && n.type !== 'group')
    if (selected.length < 3) return

    pushHistory()
    log('STORE', `Distributed ${selected.length} nodes ${axis}ly`)


    const sorted = [...selected].sort((a, b) =>
      axis === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
    )

    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const totalSpan = axis === 'horizontal'
      ? last.position.x - first.position.x
      : last.position.y - first.position.y
    const step = totalSpan / (sorted.length - 1)

    const posMap = new Map<string, number>()
    sorted.forEach((n, i) => {
      const base = axis === 'horizontal' ? first.position.x : first.position.y
      posMap.set(n.id, base + i * step)
    })

    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (!posMap.has(n.id)) return n
        const val = posMap.get(n.id)!
        return {
          ...n,
          position: axis === 'horizontal'
            ? { ...n.position, x: val }
            : { ...n.position, y: val },
        }
      }),
      isDirty: true,
    }))
  },

  updateEdgeData: (edgeId, data, options?) => {
    if (!options?.silent) {
      const { pushHistory } = get()
      pushHistory()
    }
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...data } as AVEdgeData } : e
      ),
      isDirty: true,
    }))
  },

  copySelected: () => {
    const { nodes, edges } = get()
    const selected = nodes.filter((n) => n.selected)
    if (selected.length === 0) return
    log('STORE', `Copied ${selected.length} node(s)`)

    const selectedIds = new Set(selected.map((n) => n.id))
    const relatedEdges = edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    )
    set({
      clipboard: {
        nodes: selected.map((n) => ({ ...n, data: { ...n.data } })),
        edges: relatedEdges.map((e) => ({ ...e, data: e.data ? { ...e.data } : undefined })),
      },
    })
  },

  pasteClipboard: () => {
    const { clipboard, pushHistory } = get()
    if (!clipboard || clipboard.nodes.length === 0) return

    pushHistory()
    log('STORE', `Pasted ${clipboard.nodes.length} node(s)`)

    const OFFSET = 50
    const idMap = new Map<string, string>()

    const newNodes = clipboard.nodes.map((n) => {
      const newId = generateId()
      idMap.set(n.id, newId)
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
        selected: true,
        data: { ...n.data },
      }
    })

    const newEdges = clipboard.edges.map((e) => ({
      ...e,
      id: generateId(),
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
      data: e.data ? { ...e.data } : undefined,
    }))

    set((state) => ({
      nodes: [
        ...state.nodes.map((n) => ({ ...n, selected: false })),
        ...newNodes,
      ],
      edges: [...state.edges, ...newEdges],
      isDirty: true,
      // Update clipboard positions so next paste offsets further
      clipboard: {
        nodes: clipboard.nodes.map((n) => ({
          ...n,
          position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
        })),
        edges: clipboard.edges,
      },
    }))
  },

  selectAll: () => {
    set((state) => ({
      nodes: state.nodes.map((n) => ({ ...n, selected: true })),
    }))
  },

  exportProjectFile: () => {
    const state = get()
    log('PROJECT', `Exporting project file: "${state.projectName}"`)

    // Sync current page into pages array
    const syncedPages = state.pages.map((p) =>
      p.id === state.activePageId ? { ...p, nodes: state.nodes, edges: state.edges } : p
    )
    const projectData = {
      version: 2,
      name: state.projectName,
      mode: state.mode,
      nodes: state.nodes,
      edges: state.edges,
      pages: syncedPages,
      activePageId: state.activePageId,
      layerVisibility: state.layerVisibility,
      focusedLayer: state.focusedLayer,
      showEdgeLabels: state.showEdgeLabels,
      exportedAt: Date.now(),
    }
    const json = JSON.stringify(projectData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${state.projectName.replace(/[^a-zA-Z0-9-_ ]/g, '')}.avd`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  },

  importProjectFile: async (file: File) => {
    log('PROJECT', `Importing project file: "${file.name}"`)
    const text = await file.text()
    const data = JSON.parse(text)
    if (!data.nodes && !data.pages) {
      throw new Error('Invalid .avd file format')
    }

    let pages: ProjectPage[]
    let activePageId: string
    if (data.pages && data.pages.length > 0) {
      pages = data.pages.map((p: ProjectPage) => ({
        ...p,
        nodes: migrateNodes(p.nodes),
        edges: migrateEdges(p.edges),
      }))
      activePageId = data.activePageId ?? pages[0].id
    } else {
      const pageId = generateId()
      pages = [{
        id: pageId,
        label: 'Page 1',
        nodes: migrateNodes(data.nodes ?? []),
        edges: migrateEdges(data.edges ?? []),
        viewport: { x: 0, y: 0, zoom: 1 },
      }]
      activePageId = pageId
    }

    const activePage = pages.find((p) => p.id === activePageId) ?? pages[0]

    set({
      projectId: generateId(),
      projectName: data.name ?? 'Imported Diagram',
      mode: data.mode ?? 'signal-flow',
      pages,
      activePageId: activePage.id,
      nodes: activePage.nodes,
      edges: activePage.edges,
      isDirty: true,
      past: [],
      future: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    })
  },

  setNodesAndEdges: (nodes, edges) => {
    const { pushHistory } = get()
    pushHistory()
    set({ nodes, edges, isDirty: true })
  },

  groupSelectedNodes: (label = 'Group', color) => {
    const { nodes, pushHistory } = get()
    const selected = nodes.filter((n) => n.selected && n.type !== 'group')
    if (selected.length < 2) return

    pushHistory()
    log('STORE', `Grouped ${selected.length} nodes as "${label}"`)


    const PADDING = 30
    const HEADER = 28

    const minX = Math.min(...selected.map((n) => n.position.x)) - PADDING
    const minY = Math.min(...selected.map((n) => n.position.y)) - HEADER - PADDING
    const maxX = Math.max(...selected.map((n) => n.position.x + (n.measured?.width ?? 160))) + PADDING
    const maxY = Math.max(...selected.map((n) => n.position.y + (n.measured?.height ?? 80))) + PADDING

    const groupId = generateId()
    const groupNode: Node<GroupNodeData> = {
      id: groupId,
      type: 'group',
      position: { x: minX, y: minY },
      style: { width: maxX - minX, height: maxY - minY },
      data: { label, color },
    }

    // Make selected nodes children of the group by setting parentId and adjusting positions
    const updatedNodes = nodes.map((n) => {
      if (n.selected && n.type !== 'group') {
        return {
          ...n,
          parentId: groupId,
          position: {
            x: n.position.x - minX,
            y: n.position.y - minY,
          },
          selected: false,
          expandParent: true,
        }
      }
      return n
    })

    set({
      nodes: [groupNode, ...updatedNodes] as Node<AVNodeData>[],
      isDirty: true,
    })
  },

  ungroupNodes: (groupId: string) => {
    const { nodes, pushHistory } = get()
    const groupNode = nodes.find((n) => n.id === groupId)
    if (!groupNode) return

    pushHistory()
    log('STORE', `Ungrouped: "${(groupNode.data as any).label ?? groupId}"`)


    const updatedNodes = nodes
      .filter((n) => n.id !== groupId)
      .map((n) => {
        if (n.parentId === groupId) {
          return {
            ...n,
            parentId: undefined,
            position: {
              x: n.position.x + groupNode.position.x,
              y: n.position.y + groupNode.position.y,
            },
            expandParent: undefined,
          }
        }
        return n
      })

    set({
      nodes: updatedNodes,
      isDirty: true,
    })
  },

  toggleLayerVisibility: (domain: SignalDomain) => {
    const current = get().layerVisibility[domain]
    log('VIEW', `Layer ${domain}: ${current ? 'hidden' : 'visible'}`)
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [domain]: !state.layerVisibility[domain],
      },
    }))
  },

  setFocusedLayer: (domain: SignalDomain | null) => {
    log('VIEW', domain ? `Focused layer: ${domain}` : 'Cleared layer focus')
    set({ focusedLayer: domain })
  },

  setShowEdgeLabels: (show: boolean) => {
    log('VIEW', `Edge labels: ${show ? 'shown' : 'hidden'}`)
    set({ showEdgeLabels: show })
  },

  setViewMode: (mode: ViewMode) => {
    const prev = get().viewMode
    if (prev === mode) return
    log('VIEW', `View mode: ${mode}`)

    // Handle position scaling when switching between module and image
    if ((prev === 'module' && mode === 'image') || (prev === 'image' && mode === 'module')) {
      // setShowProductImages handles both the position scaling and the state update
      get().setShowProductImages(mode === 'image')
      set({ viewMode: mode, isDirty: true })
    } else {
      // Switching to/from 3D — no position scaling needed
      set({ viewMode: mode, showProductImages: mode === 'image', isDirty: true })
    }
  },

  reset3DModelStatus: (componentType) => {
    set((s) => ({
      model3dStatus: { ...s.model3dStatus, [componentType]: 'pending' },
      model3dUrls: { ...s.model3dUrls, [componentType]: '' },
      model3dError: { ...s.model3dError, [componentType]: '' },
    }))
  },

  generate3DModels: async () => {
    const { nodes } = get()

    // Check if 3D AI Studio API is available (has key configured)
    const { check3DAvailable } = await import('@/lib/threedai-api')
    const apiAvailable = await check3DAvailable()

    if (!apiAvailable) {
      log('3D', 'Using procedural 3D shapes (no THREEDAI_API_KEY configured)')
      // Procedural shapes render automatically — no generation needed
      return
    }

    const { getComponentDef } = await import('@/data/component-definitions')
    const uniqueTypes = new Map<string, { image: string; prompt: string }>()

    for (const n of nodes) {
      if ((n.type === 'signalFlow' || n.type === 'physicalLayout') && !uniqueTypes.has(n.data.componentType)) {
        const image = n.data.image || getComponentDef(n.data.componentType)?.images?.[0]
        if (image) {
          // Construct a guiding prompt based on the component's role and label
          let prompt = n.data.label
          const role = n.data.deviceRole
          const label = n.data.label.toLowerCase()

          if (label.includes('tv') || label.includes('display') || label.includes('monitor') || label.includes('oled')) {
            prompt = `A flat screen television monitor, ${n.data.label}`
          } else if (label.includes('laptop') || label.includes('macbook')) {
            prompt = `A laptop computer, ${n.data.label}`
          } else if (label.includes('camera') || label.includes('owl')) {
            prompt = `A digital camera device, ${n.data.label}`
          } else if (label.includes('adapter') || label.includes('hub') || label.includes('satechi')) {
            prompt = `A small USB-C hub adapter with a cable, ${n.data.label}`
          } else if (role === 'destination' && (label.includes('speaker') || label.includes('sub'))) {
            prompt = `A speaker cabinet, ${n.data.label}`
          }

          uniqueTypes.set(n.data.componentType, { image, prompt })
        }
      }
    }

    if (uniqueTypes.size === 0) {
      log('3D', 'No components with images for AI generation')
      return
    }

    log('3D', `Generating AI 3D models for ${uniqueTypes.size} component type(s)`)

    const { getOrGenerate3DModel } = await import('@/lib/model3d-manager')

    const entries = Array.from(uniqueTypes.entries())
    const RATE_LIMIT_MS = 20_000
    let lastSubmitTime = 0

    for (let i = 0; i < entries.length; i++) {
      const [compType, { image, prompt }] = entries[i]
      const currentStatus = get().model3dStatus[compType]
      if (currentStatus === 'ready' || currentStatus === 'generating' || currentStatus === 'failed') continue

      // Respect rate limit: ensure at least 20s between submission starts
      if (lastSubmitTime > 0) {
        const elapsed = Date.now() - lastSubmitTime
        if (elapsed < RATE_LIMIT_MS) {
          await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed))
        }
      }

      lastSubmitTime = Date.now()

      set((s) => ({
        model3dStatus: { ...s.model3dStatus, [compType]: 'generating' },
        model3dError: { ...s.model3dError, [compType]: '' },
      }))

      try {
        const url = await getOrGenerate3DModel(compType, image, prompt, (status) => {
          log('3D', `${compType}: ${status}`, undefined, 'debug')
        })
        set((s) => ({
          model3dUrls: { ...s.model3dUrls, [compType]: url },
          model3dStatus: { ...s.model3dStatus, [compType]: 'ready' },
        }))
        log('3D', `AI model ready: ${compType}`)
      } catch (err) {
        const msg = String(err).replace(/^Error:\s*/, '')
        set((s) => ({
          model3dStatus: { ...s.model3dStatus, [compType]: 'failed' },
          model3dError: { ...s.model3dError, [compType]: msg },
        }))
        log('3D', `AI model failed: ${compType} — using procedural shape`, msg, 'warn')
      }
    }
  },

  setShowProductImages: (show) => {
    log('VIEW', `Product images: ${show ? 'shown' : 'hidden'}`)
    const { nodes } = get()

    const IMAGE_W = 180
    const IMAGE_H = 170

    const estimateModuleHeight = (n: Node<AVNodeData>) => {
      const enabled = n.data.ports.filter((p: AVPort) => p.enabled !== false)
      const inputs = enabled.filter((p: AVPort) => p.direction === 'input').length
      const outputs = enabled.filter((p: AVPort) => p.direction === 'output').length
      const bidi = enabled.filter((p: AVPort) => p.direction === 'bidirectional').length
      const undef = enabled.filter((p: AVPort) => p.direction === 'undefined').length
      const rows = Math.max(inputs, outputs) + bidi + undef
      return Math.max(44 + rows * 24 + 12, 80)
    }

    const MODULE_W = 280

    // Only scale positions for root-level AV nodes (not groups, offsheet, or grouped children)
    const scalable = nodes.filter(
      (n) => !n.parentId && n.type !== 'group' && n.type !== 'offsheetConnector'
    )

    if (scalable.length < 2) {
      set({ showProductImages: show })
      return
    }

    // Compute average old/new dimensions
    let avgOldW = 0, avgOldH = 0, avgNewW = 0, avgNewH = 0
    for (const n of scalable) {
      const mh = estimateModuleHeight(n)
      if (show) {
        // Switching TO image mode: old = module, new = image
        avgOldW += MODULE_W; avgOldH += mh
        avgNewW += IMAGE_W;  avgNewH += IMAGE_H
      } else {
        // Switching TO module mode: old = image, new = module
        avgOldW += IMAGE_W;  avgOldH += IMAGE_H
        avgNewW += MODULE_W; avgNewH += mh
      }
    }
    avgOldW /= scalable.length; avgOldH /= scalable.length
    avgNewW /= scalable.length; avgNewH /= scalable.length

    const scaleX = avgNewW / avgOldW
    const scaleY = avgNewH / avgOldH

    // Scale positions relative to the centroid
    const cx = scalable.reduce((s, n) => s + n.position.x, 0) / scalable.length
    const cy = scalable.reduce((s, n) => s + n.position.y, 0) / scalable.length

    const updatedNodes = nodes.map((n) => {
      if (n.parentId || n.type === 'group' || n.type === 'offsheetConnector') return n
      return {
        ...n,
        position: {
          x: Math.round((cx + (n.position.x - cx) * scaleX) / 16) * 16,
          y: Math.round((cy + (n.position.y - cy) * scaleY) / 16) * 16,
        },
      }
    })

    set({ showProductImages: show, nodes: updatedNodes })
  },

  // Signal chain analysis
  runSignalChainAnalysis: () => {
    const { nodes, edges } = get()
    const chains = traceSignalChains(nodes, edges)
    const chainIssues = analyzeChainsDeterministic(chains)
    const graphIssues = analyzeGraphIssues(nodes, edges)
    set({ signalChains: chains, chainIssues: [...chainIssues, ...graphIssues], llmIssues: [], llmAnalysisSummary: null })
  },

  runLLMAnalysis: async (chainId: string) => {
    const { signalChains } = get()
    const chain = signalChains.find((c) => c.id === chainId)
    if (!chain) return

    set({ isAnalyzing: true })
    try {
      const result = await analyzeChainWithLLM(chain)
      set({
        llmIssues: result.issues.map((i) => ({
          ...i,
          severity: i.severity as 'error' | 'warning' | 'info',
        })),
        llmAnalysisSummary: result.summary,
        isAnalyzing: false,
      })
    } catch {
      set({
        llmAnalysisSummary: 'LLM analysis failed — is the backend running?',
        isAnalyzing: false,
      })
    }
  },

  clearChainAnalysis: () => {
    set({ signalChains: [], chainIssues: [], llmIssues: [], isAnalyzing: false, llmAnalysisSummary: null })
  },
}))
