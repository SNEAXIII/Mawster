'use client';

import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MasteryEntry, MasteryUpsertItem } from '@/app/services/masteries';

interface MasteryTabProps {
  masteries: MasteryEntry[];
  masteryForm: MasteryUpsertItem[];
  loading: boolean;
  saving: boolean;
  isOwner: boolean;
  onFormChange: (form: MasteryUpsertItem[]) => void;
  onSave: () => void;
}

export default function MasteryTab({
  masteries,
  masteryForm,
  loading,
  saving,
  isOwner,
  onFormChange,
  onSave,
}: MasteryTabProps) {
  const { t } = useI18n();

  if (loading) {
    return <p className='text-muted-foreground'>{t.common.loading}</p>;
  }

  if (masteries.length === 0) {
    return <p className='text-muted-foreground'>{t.mastery.noMasteries}</p>;
  }

  const updateField = (
    masteryId: string,
    field: 'unlocked' | 'attack' | 'defense',
    value: number
  ) => {
    onFormChange(
      masteryForm.map((item) =>
        item.mastery_id === masteryId ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <div>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4'>
        {masteries.map((mastery) => {
          const formItem = masteryForm.find((f) => f.mastery_id === mastery.mastery_id);
          if (!formItem) return null;
          return (
            <Card key={mastery.mastery_id} data-cy={`mastery-card-${mastery.mastery_name.toLowerCase()}`}>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm uppercase tracking-wide'>
                  {mastery.mastery_name}
                  <span className='text-muted-foreground font-normal normal-case ml-1'>
                    / {mastery.mastery_max_value}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-3 gap-2'>
                  {(['unlocked', 'attack', 'defense'] as const).map((field) => (
                    <div key={field} className='text-center'>
                      <p className='text-xs text-muted-foreground mb-1'>{t.mastery[field]}</p>
                      <Input
                        type='number'
                        min={0}
                        max={field === 'unlocked' ? mastery.mastery_max_value : formItem.unlocked}
                        value={formItem[field]}
                        onChange={(e) =>
                          updateField(mastery.mastery_id, field, Number(e.target.value))
                        }
                        disabled={!isOwner}
                        className='text-center'
                        data-cy={`mastery-${mastery.mastery_name.toLowerCase()}-${field}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isOwner && (
        <Button
          onClick={onSave}
          disabled={saving}
          data-cy='mastery-save-button'
        >
          {saving ? t.common.loading : t.mastery.save}
        </Button>
      )}
    </div>
  );
}
