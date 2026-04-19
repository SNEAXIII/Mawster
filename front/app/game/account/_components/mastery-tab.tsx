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
}: Readonly<MasteryTabProps>) {
  const { t } = useI18n();

  if (loading) {
    return <p className='text-muted-foreground'>{t.common.loading}</p>;
  }

  if (!loading && masteries.length === 0) {
    return <p className='text-muted-foreground'>{t.mastery.noMasteries}</p>;
  }

  const toCyKey = (name: string) => name.toLowerCase().replaceAll(/\s+/g, '-');

  const updateField = (
    masteryId: string,
    field: 'unlocked' | 'attack' | 'defense',
    value: number,
    maxValue: number
  ) => {
    if (value < 0 || value > maxValue) return; // Basic validation to prevent invalid values
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
            <Card
              key={mastery.mastery_id}
              data-cy={`mastery-card-${toCyKey(mastery.mastery_name)}`}
            >
              <CardHeader className='px-4 p-4'>
                <CardTitle className='text-sm uppercase tracking-wide'>
                  {t.mastery.names[mastery.mastery_order as keyof typeof t.mastery.names] ??
                    mastery.mastery_name}
                </CardTitle>
              </CardHeader>
              <CardContent className='p-0 px-4 pb-4'>
                <div className='grid grid-cols-3'>
                  {(['unlocked', 'attack', 'defense'] as const).map((field) => {
                    const actualMaxValue =
                      field === 'unlocked' ? mastery.mastery_max_value : formItem.unlocked;
                    return (
                      <div
                        key={field}
                        className='text-center'
                      >
                        <p className='text-xs text-muted-foreground mb-1'>{t.mastery[field]}</p>
                        <div className='flex items-center justify-center w-fit mx-auto'>
                          <Input
                            type='number'
                            value={formItem[field]}
                            onChange={(e) =>
                              updateField(
                                mastery.mastery_id,
                                field,
                                Number(e.target.value),
                                actualMaxValue
                              )
                            }
                            disabled={!isOwner}
                            className='text-center w-10 text-foreground font-normal normal-case focus-visible:ring-0'
                            data-cy={`mastery-${toCyKey(mastery.mastery_name)}-${field}`}
                          />
                          <span className='text-foreground font-normal normal-case ml-1'>
                            / {actualMaxValue}
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
