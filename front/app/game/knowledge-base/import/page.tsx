'use client'
import { useI18n } from '@/app/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageContainer } from '@/components/page-container'
import CsvImportForm from './_components/csv-import-form'

export default function ImportPage() {
  const { t } = useI18n()
  return (
    <PageContainer>
      <Card className='max-w-2xl'>
        <CardHeader>
          <CardTitle>{t.game.knowledgeBase.importTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <CsvImportForm />
        </CardContent>
      </Card>
    </PageContainer>
  )
}
