'use client'

import { type ChangeEvent, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/app/i18n'
import { exportAllChampions, loadChampions } from '@/app/services/champions'

interface ChampionsIoButtonsProps {
  onImported: () => void
  onError: (message: string) => void
}

interface ChampionImportEntry {
  name: string
  champion_class: string
  image_url?: string | null
  alias?: string | null
  is_7_stars_available?: boolean
  is_ascendable?: boolean
  has_prefight?: boolean
}

export default function ChampionsIoButtons({
  onImported,
  onError,
}: Readonly<ChampionsIoButtonsProps>) {
  const { t } = useI18n()
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    try {
      const data = await exportAllChampions()
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
      await loadChampions(
        data.map((c) => ({
          name: c.name,
          champion_class: c.champion_class,
          image_url: c.image_url ?? null,
          alias: c.alias ?? null,
          is_7_stars_available: c.is_7_stars_available,
          is_ascendable: c.is_ascendable,
          has_prefight: c.has_prefight,
        }))
      )
      onImported()
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
