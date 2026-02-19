'use client';

import { useSession } from 'next-auth/react';
import { redirect, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type GameAccount,
  getMyGameAccounts,
  createGameAccount,
  deleteGameAccount,
} from '@/app/services/game';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, Plus, Trash2, Gamepad2, Star } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function GameAccountsPage() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [pseudo, setPseudo] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

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
    if (status === 'authenticated') {
      fetchAccounts();
    }
  }, [status]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim()) return;

    setCreating(true);
    try {
      await createGameAccount(pseudo.trim(), isPrimary);
      toast.success(t.game.accounts.createSuccess);
      setPseudo('');
      setIsPrimary(false);
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toast.error(t.game.accounts.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteGameAccount(id);
      toast.success(t.game.accounts.deleteSuccess);
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toast.error(t.game.accounts.deleteError);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.game.accounts.title}</h1>
        <p className="text-gray-500 mt-1">{t.game.accounts.description}</p>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t.game.accounts.createTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                disabled={creating}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                {t.game.accounts.isPrimary}
              </Label>
            </div>
            <Button type="submit" disabled={creating || !pseudo.trim()}>
              {creating ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  {t.game.accounts.creating}
                </>
              ) : (
                t.game.accounts.createButton
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Gamepad2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t.game.accounts.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gamepad2 className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">{account.game_pseudo}</p>
                      <p className="text-xs text-gray-500">
                        ID: {account.id}
                      </p>
                    </div>
                    {account.is_primary && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Star className="h-3 w-3" />
                        {t.game.accounts.primary}
                      </span>
                    )}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.common.confirm}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.game.accounts.deleteConfirm}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(account.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {t.common.delete}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
