'use client'

import { type ChangeEvent, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'
import type { ChampionImportEntry } from '../../_viewmodels/use-champion-actions'

interface ChampionsIoButtonsProps {
  onExport: () => Promise<unknown>
  onImport: (entries: ChampionImportEntry[]) => Promise<void>
  onError: (message: string) => void
}

export default function ChampionsIoButtons({
  onExport,
  onImport,
  onError,
}: Readonly<ChampionsIoButtonsProps>) {
  const { t } = useI18n()
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    try {
      const data = await onExport()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `champions_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      onError(t.champions.errors.exportError)
    }
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const data = JSON.parse(await file.text()) as ChampionImportEntry[]
      if (!Array.isArray(data)) throw new Error('Invalid JSON: expected an array')
      await onImport(data)
    } catch {
      onError(t.champions.errors.importError)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        onClick={handleExport}
        data-cy='export-champions-btn'
      >
        <Download className='mr-1 size-4' /> {t.champions.exportJson}
      </Button>
      <Button
        variant='outline'
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        data-cy='import-champions-btn'
      >
        <Upload className='mr-1 size-4' />
        {importing ? t.common.loading : t.champions.importJson}
      </Button>
      <input
        ref={fileInputRef}
        type='file'
        accept='.json'
        className='hidden'
        onChange={handleImport}
      />
    </div>
  )
}
