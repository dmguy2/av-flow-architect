import { toPng, toSvg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import type { Node, Edge } from '@xyflow/react'
import type { AVNodeData, AVEdgeData, SignalDomain, ConnectorType, ConnectorVariant } from '@/types/av'
import { SIGNAL_COLORS, SIGNAL_LABELS } from './signal-colors'
import { VARIANT_LABELS } from './connector-variants'

/** Format connector with variant for cable schedules (e.g., "HDMI Micro", "USB Type-C") */
function formatConnector(connector: ConnectorType, variant?: ConnectorVariant): string {
  if (variant && VARIANT_LABELS[variant]) {
    return `${connector.toUpperCase()} ${VARIANT_LABELS[variant]}`
  }
  return connector.toUpperCase()
}

function getFlowElement(): HTMLElement | null {
  return document.querySelector('.react-flow__viewport') as HTMLElement | null
}

export async function exportPng(projectName: string): Promise<void> {
  const el = getFlowElement()
  if (!el) return

  const dataUrl = await toPng(el, {
    backgroundColor: '#ffffff',
    quality: 1,
    pixelRatio: 2,
  })

  const link = document.createElement('a')
  link.download = `${projectName}.png`
  link.href = dataUrl
  link.click()
}

export async function exportSvg(projectName: string): Promise<void> {
  const el = getFlowElement()
  if (!el) return

  const dataUrl = await toSvg(el, {
    backgroundColor: '#ffffff',
  })

  const link = document.createElement('a')
  link.download = `${projectName}.svg`
  link.href = dataUrl
  link.click()
}

export async function exportPdf(projectName: string): Promise<void> {
  const el = getFlowElement()
  if (!el) return

  const dataUrl = await toPng(el, {
    backgroundColor: '#ffffff',
    quality: 1,
    pixelRatio: 2,
  })

  const img = new Image()
  img.src = dataUrl

  await new Promise((resolve) => {
    img.onload = resolve
  })

  const pdf = new jsPDF({
    orientation: img.width > img.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [img.width / 2, img.height / 2 + 40],
  })

  // Title
  pdf.setFontSize(14)
  pdf.text(projectName, 20, 25)

  // Diagram image
  pdf.addImage(dataUrl, 'PNG', 0, 40, img.width / 2, img.height / 2)

  pdf.save(`${projectName}.pdf`)
}

// ─── Print-optimized export ───

interface PageExportData {
  label: string
  nodes: Node<AVNodeData>[]
  edges: Edge<AVEdgeData>[]
}

interface PrintExportOptions {
  projectName: string
  nodes: Node<AVNodeData>[]
  edges: Edge<AVEdgeData>[]
  preparedBy?: string
  pages?: PageExportData[]
}

export async function exportPrintPdf(options: PrintExportOptions): Promise<void> {
  const { projectName, nodes, edges, preparedBy, pages } = options
  const el = getFlowElement()
  if (!el) return

  // Capture diagram (current visible page)
  const dataUrl = await toPng(el, {
    backgroundColor: '#ffffff',
    quality: 1,
    pixelRatio: 2,
  })

  const img = new Image()
  img.src = dataUrl
  await new Promise((resolve) => { img.onload = resolve })

  // Use landscape letter size
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'letter',
  })

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 36 // 0.5 inch margin
  const contentW = pageW - margin * 2
  const now = new Date()
  const titleBlockH = 80

  // Determine if multi-page project
  const isMultiPage = pages && pages.length > 1
  const pageLabel = isMultiPage ? pages.find((p) => p.nodes === nodes)?.label : undefined

  // ── Page 1: Title block + diagram ──

  const diagramSubtitle = isMultiPage && pageLabel ? `Diagram — ${pageLabel}` : undefined
  drawTitleBlock(pdf, projectName, preparedBy, now, margin, pageW, pageH, diagramSubtitle)

  // Draw diagram below title block
  const diagramTop = margin + titleBlockH + 12
  const diagramAreaH = pageH - diagramTop - margin - 30 // leave room for footer
  const diagramAreaW = contentW

  // Scale image to fit
  const scale = Math.min(diagramAreaW / (img.width / 2), diagramAreaH / (img.height / 2))
  const drawW = (img.width / 2) * scale
  const drawH = (img.height / 2) * scale
  const drawX = margin + (diagramAreaW - drawW) / 2
  const drawY = diagramTop + (diagramAreaH - drawH) / 2

  // Light border around diagram
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.rect(drawX - 2, drawY - 2, drawW + 4, drawH + 4)

  pdf.addImage(dataUrl, 'PNG', drawX, drawY, drawW, drawH)

  // Signal legend at bottom
  drawSignalLegend(pdf, edges, margin, pageH - margin - 18, contentW)

  // Footer
  drawFooter(pdf, 1, margin, pageW, pageH)

  // ── Cable Schedule ── (aggregate all pages)

  const allNodes = isMultiPage ? pages.flatMap((p) => p.nodes) : nodes
  const allEdges = isMultiPage ? pages.flatMap((p) => p.edges) : edges

  if (allEdges.length > 0) {
    pdf.addPage()
    drawTitleBlock(pdf, projectName, preparedBy, now, margin, pageW, pageH, 'Cable Schedule')

    const tableTop = margin + titleBlockH + 16

    drawCableSchedule(pdf, allNodes, allEdges, margin, tableTop, contentW, pageH, preparedBy, projectName, now)
  }

  // ── Equipment List ── (aggregate all pages)

  pdf.addPage()
  drawTitleBlock(pdf, projectName, preparedBy, now, margin, pageW, pageH, 'Equipment List')

  const eqTableTop = margin + titleBlockH + 16
  drawEquipmentList(pdf, allNodes, margin, eqTableTop, contentW, pageH, preparedBy, projectName, now)

  // Final pass: redraw all footers with "Page X of Y" total
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    // Clear the old footer area
    pdf.setFillColor(255, 255, 255)
    pdf.rect(margin - 1, pageH - margin / 2 - 5, pageW - margin * 2 + 2, 10, 'F')
    // Redraw with total page count
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(150, 150, 150)
    pdf.text(`Page ${i} of ${totalPages}`, margin, pageH - margin / 2)
    pdf.text('Generated by AV Diagram Tool', pageW - margin, pageH - margin / 2, { align: 'right' })
  }

  pdf.save(`${projectName} - Print.pdf`)
}

function drawTitleBlock(
  pdf: jsPDF,
  projectName: string,
  preparedBy: string | undefined,
  date: Date,
  margin: number,
  pageW: number,
  _pageH: number,
  subtitle?: string
) {
  const contentW = pageW - margin * 2
  const blockH = 70

  // Background
  pdf.setFillColor(24, 24, 27) // zinc-900
  pdf.rect(margin, margin, contentW, blockH, 'F')

  // Project name
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(255, 255, 255)
  pdf.text(projectName, margin + 16, margin + 28)

  // Subtitle
  if (subtitle) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(180, 180, 180)
    pdf.text(subtitle, margin + 16, margin + 46)
  }

  // Right side info
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(180, 180, 180)

  const rightX = margin + contentW - 16
  pdf.text(`Date: ${date.toLocaleDateString()}`, rightX, margin + 20, { align: 'right' })
  if (preparedBy) {
    pdf.text(`Prepared by: ${preparedBy}`, rightX, margin + 33, { align: 'right' })
  }
  pdf.text(`AV Signal Flow Diagram`, rightX, margin + 46, { align: 'right' })

  // Bottom accent line
  pdf.setFillColor(59, 130, 246) // blue-500
  pdf.rect(margin, margin + blockH, contentW, 3, 'F')

  // Reset text color
  pdf.setTextColor(0, 0, 0)
}

function drawSignalLegend(
  pdf: jsPDF,
  edges: Edge<AVEdgeData>[],
  x: number,
  y: number,
  _contentW: number
) {
  // Determine which domains are actually used
  const usedDomains = new Set<SignalDomain>()
  edges.forEach((e) => {
    if (e.data?.domain) usedDomains.add(e.data.domain)
  })

  if (usedDomains.size === 0) return

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(100, 100, 100)
  pdf.text('SIGNAL LEGEND:', x, y + 3)

  let curX = x + 75
  const domains = Object.entries(SIGNAL_COLORS) as [SignalDomain, string][]
  for (const [domain, hex] of domains) {
    if (!usedDomains.has(domain)) continue

    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)

    pdf.setFillColor(r, g, b)
    pdf.circle(curX, y, 4, 'F')

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(60, 60, 60)
    pdf.text(SIGNAL_LABELS[domain], curX + 7, y + 3)

    curX += pdf.getTextWidth(SIGNAL_LABELS[domain]) + 22
  }

  pdf.setTextColor(0, 0, 0)
}

function drawFooter(pdf: jsPDF, pageNum: number, margin: number, pageW: number, pageH: number) {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(150, 150, 150)
  pdf.text(`Page ${pageNum}`, margin, pageH - margin / 2)
  pdf.text('Generated by AV Diagram Tool', pageW - margin, pageH - margin / 2, { align: 'right' })
  pdf.setTextColor(0, 0, 0)
}

function drawCableSchedule(
  pdf: jsPDF,
  nodes: Node<AVNodeData>[],
  edges: Edge<AVEdgeData>[],
  margin: number,
  startY: number,
  contentW: number,
  pageH: number,
  preparedBy: string | undefined,
  projectName: string,
  date: Date
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Column widths
  const cols = {
    num: 30,
    label: contentW * 0.13,
    source: contentW * 0.20,
    sourcePort: contentW * 0.12,
    dest: contentW * 0.20,
    destPort: contentW * 0.12,
    signal: contentW * 0.08,
    connector: contentW * 0.10,
  }

  // Adjust so columns fill contentW
  const totalCols = cols.num + cols.label + cols.source + cols.sourcePort + cols.dest + cols.destPort + cols.signal + cols.connector
  const scale = contentW / totalCols
  const sCols = {
    num: cols.num * scale,
    label: cols.label * scale,
    source: cols.source * scale,
    sourcePort: cols.sourcePort * scale,
    dest: cols.dest * scale,
    destPort: cols.destPort * scale,
    signal: cols.signal * scale,
    connector: cols.connector * scale,
  }

  const rowH = 18
  let y = startY
  let pageNum = 2

  // Header
  const drawHeader = () => {
    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, y, contentW, rowH, 'F')
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.5)
    pdf.rect(margin, y, contentW, rowH, 'S')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(60, 60, 60)

    let cx = margin + 4
    const texts = ['#', 'CABLE ID', 'SOURCE', 'SRC PORT', 'DESTINATION', 'DST PORT', 'SIGNAL', 'CONNECTOR']
    const widths = [sCols.num, sCols.label, sCols.source, sCols.sourcePort, sCols.dest, sCols.destPort, sCols.signal, sCols.connector]

    texts.forEach((t, i) => {
      pdf.text(t, cx, y + 12)
      cx += widths[i]
    })

    y += rowH
  }

  drawHeader()

  edges.forEach((edge, idx) => {
    // Check if we need a new page
    if (y + rowH > pageH - margin - 20) {
      drawFooter(pdf, pageNum, margin, margin * 2 + contentW, pageH)
      pdf.addPage()
      pageNum++
      y = margin + 20
      drawTitleBlock(pdf, projectName, preparedBy, date, margin, margin * 2 + contentW, pageH, 'Cable Schedule (cont.)')
      y = margin + 90
      drawHeader()
    }

    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)
    const sourcePort = sourceNode?.data.ports.find((p) => p.id === edge.sourceHandle)
    const targetPort = targetNode?.data.ports.find((p) => p.id === edge.targetHandle)

    // Alternating row colors
    if (idx % 2 === 0) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(margin, y, contentW, rowH, 'F')
    }

    // Row border
    pdf.setDrawColor(230, 230, 230)
    pdf.setLineWidth(0.25)
    pdf.line(margin, y + rowH, margin + contentW, y + rowH)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(30, 30, 30)

    let cx = margin + 4
    const values = [
      `${idx + 1}`,
      edge.data?.label || `C-${String(idx + 1).padStart(2, '0')}`,
      sourceNode?.data.label ?? '—',
      sourcePort?.label ?? '—',
      targetNode?.data.label ?? '—',
      targetPort?.label ?? '—',
      SIGNAL_LABELS[edge.data?.domain ?? 'audio'],
      formatConnector(edge.data?.connector ?? 'xlr', edge.data?.variant),
    ]
    const widths = [sCols.num, sCols.label, sCols.source, sCols.sourcePort, sCols.dest, sCols.destPort, sCols.signal, sCols.connector]

    // Signal domain color indicator
    const domainColor = SIGNAL_COLORS[edge.data?.domain ?? 'audio']
    const r = parseInt(domainColor.slice(1, 3), 16)
    const g = parseInt(domainColor.slice(3, 5), 16)
    const b = parseInt(domainColor.slice(5, 7), 16)

    values.forEach((v, i) => {
      // Color dot for signal column
      if (i === 6) {
        pdf.setFillColor(r, g, b)
        pdf.circle(cx - 1, y + rowH / 2, 2.5, 'F')
        pdf.text(v, cx + 5, y + 12)
      } else {
        // Truncate text to fit column
        const maxW = widths[i] - 6
        let text = v
        while (pdf.getTextWidth(text) > maxW && text.length > 1) {
          text = text.slice(0, -1)
        }
        if (text !== v) text += '...'
        pdf.text(text, cx, y + 12)
      }
      cx += widths[i]
    })

    y += rowH
  })

  // Bottom border
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, margin + contentW, y)

  // Summary
  y += 14
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Total connections: ${edges.length}`, margin, y)

  drawFooter(pdf, pageNum, margin, margin * 2 + contentW, pageH)
}

function drawEquipmentList(
  pdf: jsPDF,
  nodes: Node<AVNodeData>[],
  margin: number,
  startY: number,
  contentW: number,
  pageH: number,
  preparedBy: string | undefined,
  projectName: string,
  date: Date
) {
  // Filter out group nodes
  const equipment = nodes.filter((n) => n.type !== 'group')

  const cols = {
    num: 30,
    label: contentW * 0.25,
    type: contentW * 0.20,
    model: contentW * 0.25,
    notes: contentW * 0.25,
  }

  const totalCols = cols.num + cols.label + cols.type + cols.model + cols.notes
  const scale = contentW / totalCols
  const sCols = {
    num: cols.num * scale,
    label: cols.label * scale,
    type: cols.type * scale,
    model: cols.model * scale,
    notes: cols.notes * scale,
  }

  const rowH = 18
  let y = startY
  let pageNum = pdf.getNumberOfPages()

  const drawHeader = () => {
    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, y, contentW, rowH, 'F')
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.5)
    pdf.rect(margin, y, contentW, rowH, 'S')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(60, 60, 60)

    let cx = margin + 4
    const texts = ['#', 'LABEL', 'TYPE', 'MODEL / MAKE', 'NOTES']
    const widths = [sCols.num, sCols.label, sCols.type, sCols.model, sCols.notes]
    texts.forEach((t, i) => {
      pdf.text(t, cx, y + 12)
      cx += widths[i]
    })

    y += rowH
  }

  drawHeader()

  equipment.forEach((node, idx) => {
    if (y + rowH > pageH - margin - 20) {
      drawFooter(pdf, pageNum, margin, margin * 2 + contentW, pageH)
      pdf.addPage()
      pageNum++
      y = margin + 20
      drawTitleBlock(pdf, projectName, preparedBy, date, margin, margin * 2 + contentW, pageH, 'Equipment List (cont.)')
      y = margin + 90
      drawHeader()
    }

    if (idx % 2 === 0) {
      pdf.setFillColor(250, 250, 250)
      pdf.rect(margin, y, contentW, rowH, 'F')
    }

    pdf.setDrawColor(230, 230, 230)
    pdf.setLineWidth(0.25)
    pdf.line(margin, y + rowH, margin + contentW, y + rowH)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(30, 30, 30)

    let cx = margin + 4
    const values = [
      `${idx + 1}`,
      node.data.label,
      node.data.componentType.replace(/-/g, ' '),
      node.data.model ?? '—',
      node.data.notes ?? '—',
    ]
    const widths = [sCols.num, sCols.label, sCols.type, sCols.model, sCols.notes]

    values.forEach((v, i) => {
      const maxW = widths[i] - 6
      let text = v
      while (pdf.getTextWidth(text) > maxW && text.length > 1) {
        text = text.slice(0, -1)
      }
      if (text !== v) text += '...'
      pdf.text(text, cx, y + 12)
      cx += widths[i]
    })

    y += rowH
  })

  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, margin + contentW, y)

  y += 14
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Total equipment: ${equipment.length}`, margin, y)

  drawFooter(pdf, pageNum, margin, margin * 2 + contentW, pageH)
}

// ─── CSV Cable Schedule Export ───

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportCableScheduleCsv(
  projectName: string,
  nodes: Node<AVNodeData>[],
  edges: Edge<AVEdgeData>[]
): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const headers = ['#', 'Cable ID', 'Source', 'Source Port', 'Destination', 'Dest Port', 'Signal', 'Connector']
  const rows = edges.map((edge, idx) => {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)
    const sourcePort = sourceNode?.data.ports.find((p) => p.id === edge.sourceHandle)
    const targetPort = targetNode?.data.ports.find((p) => p.id === edge.targetHandle)

    return [
      `${idx + 1}`,
      edge.data?.label || `C-${String(idx + 1).padStart(2, '0')}`,
      sourceNode?.data.label ?? '',
      sourcePort?.label ?? '',
      targetNode?.data.label ?? '',
      targetPort?.label ?? '',
      SIGNAL_LABELS[edge.data?.domain ?? 'audio'],
      formatConnector(edge.data?.connector ?? 'xlr', edge.data?.variant),
    ]
  })

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${projectName} - Cable Schedule.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function exportEquipmentListCsv(
  projectName: string,
  nodes: Node<AVNodeData>[]
): void {
  const equipment = nodes.filter((n) => n.type !== 'group')

  const headers = ['#', 'Label', 'Type', 'Manufacturer', 'Model', 'Power Draw', 'Notes']
  const rows = equipment.map((node, idx) => [
    `${idx + 1}`,
    node.data.label,
    node.data.componentType.replace(/-/g, ' '),
    node.data.manufacturer ?? '',
    node.data.model ?? '',
    node.data.powerDraw ?? '',
    node.data.notes ?? '',
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${projectName} - Equipment List.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
