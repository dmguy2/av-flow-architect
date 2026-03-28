import { useRef } from 'react'
import { Download, Image, FileText, FileCode, Upload, FileDown, Printer, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useDiagramStore } from '@/store/diagram-store'
import { exportPng, exportSvg, exportPdf, exportPrintPdf, exportCableScheduleCsv, exportEquipmentListCsv } from '@/lib/export'

export default function ExportMenu() {
  const projectName = useDiagramStore((s) => s.projectName)
  const preparedBy = useDiagramStore((s) => s.preparedBy)
  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const exportProjectFile = useDiagramStore((s) => s.exportProjectFile)
  const importProjectFile = useDiagramStore((s) => s.importProjectFile)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importProjectFile(file)
    } catch {
      alert('Failed to import file. Make sure it is a valid .avd file.')
    }
    // Reset input so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".avd,.json"
        onChange={handleImport}
        className="hidden"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => exportPng(projectName)}>
            <Image className="w-4 h-4" />
            Export as PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportSvg(projectName)}>
            <FileCode className="w-4 h-4" />
            Export as SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportPdf(projectName)}>
            <FileText className="w-4 h-4" />
            Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportPrintPdf({ projectName, nodes, edges, preparedBy: preparedBy || undefined })}>
            <Printer className="w-4 h-4" />
            Print PDF (with cable schedule)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => exportCableScheduleCsv(projectName, nodes, edges)}>
            <Table className="w-4 h-4" />
            Cable Schedule (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportEquipmentListCsv(projectName, nodes)}>
            <Table className="w-4 h-4" />
            Equipment List (CSV)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportProjectFile}>
            <FileDown className="w-4 h-4" />
            Save as .avd file
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            Import .avd file
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
