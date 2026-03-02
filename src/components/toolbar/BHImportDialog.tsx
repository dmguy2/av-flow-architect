import { useState, useMemo } from 'react'
import { Download, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { checkBackendHealth } from '@/lib/bh-api'

const BH_URL_PATTERN = /bhphotovideo\.com\/c\/product\//

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartImport: (urls: string[]) => void
}

export default function BHImportDialog({ open, onOpenChange, onStartImport }: Props) {
  const [rawText, setRawText] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const parsed = useMemo(() => {
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    const seen = new Set<string>()
    return lines.map((line) => {
      const valid = BH_URL_PATTERN.test(line)
      const duplicate = seen.has(line)
      if (valid) seen.add(line)
      return { line, valid, duplicate }
    })
  }, [rawText])

  const validUrls = useMemo(
    () => parsed.filter((p) => p.valid && !p.duplicate).map((p) => p.line),
    [parsed]
  )

  const hasInvalid = parsed.some((p) => !p.valid)
  const hasDuplicates = parsed.some((p) => p.duplicate)

  const resetDialog = () => {
    setRawText('')
    setChecking(false)
    setError('')
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetDialog()
    onOpenChange(isOpen)
  }

  const handleSubmit = async () => {
    if (validUrls.length === 0) return
    setError('')
    setChecking(true)

    try {
      const healthy = await checkBackendHealth()
      if (!healthy) {
        setError('Backend server not running. Start it with: cd backend && uvicorn server:app --port 8420')
        setChecking(false)
        return
      }

      onStartImport(validUrls)
      handleOpenChange(false)
    } catch {
      setError('Failed to connect to backend')
      setChecking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Import from B&H Photo</DialogTitle>
          <DialogDescription>
            Paste one or more B&H product URLs, one per line.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">B&H Product URLs</Label>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value)
                setError('')
              }}
              placeholder={"https://www.bhphotovideo.com/c/product/...\nhttps://www.bhphotovideo.com/c/product/..."}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[80px]"
            />
            <div className="flex items-center gap-2 text-[11px]">
              {parsed.length > 0 && (
                <span className="text-muted-foreground">
                  {validUrls.length} valid{validUrls.length !== 1 ? ' URLs' : ' URL'}
                </span>
              )}
              {hasInvalid && (
                <span className="text-destructive">
                  {parsed.filter((p) => !p.valid).length} invalid
                </span>
              )}
              {hasDuplicates && (
                <span className="text-amber-500">
                  {parsed.filter((p) => p.duplicate).length} duplicate
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={validUrls.length === 0 || checking}
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {validUrls.length === 0
                  ? 'Import Products'
                  : validUrls.length === 1
                    ? 'Import 1 Product'
                    : `Import ${validUrls.length} Products`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
