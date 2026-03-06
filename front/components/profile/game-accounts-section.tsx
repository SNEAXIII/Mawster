'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type GameAccount,
  getMyGameAccounts,
  createGameAccount,
  updateGameAccount,
  deleteGameAccount,
} from '@/app/services/game';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { CollapsibleSection } from '@/components/collapsible-section';
import { Loader, Plus, Trash2, Gamepad2, Star, Pencil, Check, X, Shield } from 'lucide-react';

export default function GameAccountsSection() {
  const { t } = useI18n();

  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPseudo, setEditPseudo] = useState('');

  // Form state
  const [pseudo, setPseudo] = useState('');

  const fetchAccounts = async () => {
    try {
      const data = await getMyGameAccounts();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim()) return;

    setCreating(true);
    try {
      await createGameAccount(pseudo.trim(), accounts.length === 0);
      toast.success(t.game.accounts.createSuccess);
      setPseudo('');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toast.error(t.game.accounts.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGameAccount(deleteTarget);
      toast.success(t.game.accounts.deleteSuccess);
      setDeleteTarget(null);
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toast.error(t.game.accounts.deleteError);
    }
  };

  const startEditing = (account: GameAccount) => {
    setEditingId(account.id);
    setEditPseudo(account.game_pseudo);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditPseudo('');
  };

  const handleEdit = async (account: GameAccount) => {
    if (!editPseudo.trim()) return;
    try {
      await updateGameAccount(account.id, editPseudo.trim(), account.is_primary);
      toast.success(t.game.accounts.editSuccess);
      setEditingId(null);
      setEditPseudo('');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toast.error(t.game.accounts.editError);
    }
  };

  const handleSetPrimary = async (account: GameAccount) => {
    if (account.is_primary) return;
    try {
      await updateGameAccount(account.id, account.game_pseudo, true);
      toast.success(t.game.accounts.primarySet ?? 'Primary account updated');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toast.error(t.game.accounts.editError);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          <Loader className="h-5 w-5 animate-spin mx-auto mb-2" />
          {t.common.loading}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-blue-500" />
            {t.game.accounts.title}
          </CardTitle>
          <p className="text-sm text-gray-400">
            {t.game.accounts.accountCount.replace('{count}', String(accounts.length))}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create form */}
          <CollapsibleSection
            title={t.game.accounts.createTitle}
            defaultOpen={accounts.length === 0}
          >
            {accounts.length >= 10 ? (
              <p className="text-sm text-amber-600 font-medium">
                {t.game.accounts.accountLimitReached}
              </p>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pseudo">{t.game.accounts.pseudo}</Label>
                  <Input
                    id="pseudo"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    placeholder={t.game.accounts.pseudoPlaceholder}
                    maxLength={50}
                    required
                    disabled={creating}
                  />
                </div>
                <Button type="submit" disabled={creating || !pseudo.trim()}>
                  {creating ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      {t.game.accounts.creating}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      {t.game.accounts.createButton}
                    </>
                  )}
                </Button>
              </form>
            )}
          </CollapsibleSection>

          {/* Accounts list */}
          {accounts.length === 0 ? (
            <div className="py-6 text-center text-gray-500">
              <Gamepad2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>{t.game.accounts.empty}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Gamepad2 className="h-4 w-4 text-blue-500 shrink-0" />
                    {editingId === account.id ? (
                      <form
                        className="flex items-center gap-2 flex-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleEdit(account);
                        }}
                      >
                        <Input
                          value={editPseudo}
                          onChange={(e) => setEditPseudo(e.target.value)}
                          maxLength={50}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="text-green-600 hover:text-green-800 hover:bg-green-50 shrink-0"
                          disabled={!editPseudo.trim()}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-gray-500 hover:text-gray-700 shrink-0"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <p className="font-medium text-sm text-gray-900">
                          {account.game_pseudo}
                        </p>
                        {account.is_primary && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Star className="h-3 w-3" />
                            {t.game.accounts.primary}
                          </span>
                        )}
                        {account.alliance_tag && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            title={account.alliance_name ?? ''}
                          >
                            <Shield className="h-3 w-3" />
                            [{account.alliance_tag}]
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {editingId !== account.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={account.is_primary
                          ? 'text-yellow-500 cursor-default'
                          : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'
                        }
                        onClick={() => handleSetPrimary(account)}
                        title={account.is_primary ? t.game.accounts.primary : (t.game.accounts.setAsPrimary ?? 'Set as primary')}
                        disabled={account.is_primary}
                      >
                        <Star className={`h-4 w-4 ${account.is_primary ? 'fill-yellow-500' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => startEditing(account)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTarget(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t.common.confirm}
        description={t.game.accounts.deleteConfirm}
        onConfirm={handleDelete}
        variant="destructive"
        confirmText={t.common.delete}
      />
    </>
  );
}
