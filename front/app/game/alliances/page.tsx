'use client';

import { useSession } from 'next-auth/react';
import { redirect, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type Alliance,
  getAllAlliances,
  createAlliance,
  deleteAlliance,
} from '@/app/services/game';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader, Plus, Trash2, Shield } from 'lucide-react';
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

export default function AlliancesPage() {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');

  const fetchAlliances = async () => {
    try {
      const data = await getAllAlliances();
      setAlliances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAlliances();
    }
  }, [status]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tag.trim()) return;

    setCreating(true);
    try {
      await createAlliance(name.trim(), tag.trim(), description.trim() || undefined);
      toast.success(t.game.alliances.createSuccess);
      setName('');
      setTag('');
      setDescription('');
      await fetchAlliances();
    } catch (err) {
      console.error(err);
      toast.error(t.game.alliances.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAlliance(id);
      toast.success(t.game.alliances.deleteSuccess);
      await fetchAlliances();
    } catch (err) {
      console.error(err);
      toast.error(t.game.alliances.deleteError);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
      }).format(new Date(dateString));
    } catch {
      return dateString;
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
        <h1 className="text-2xl font-bold text-gray-900">{t.game.alliances.title}</h1>
        <p className="text-gray-500 mt-1">{t.game.alliances.description}</p>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t.game.alliances.createTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.game.alliances.name}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.game.alliances.namePlaceholder}
                  maxLength={100}
                  required
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">{t.game.alliances.tag}</Label>
                <Input
                  id="tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  placeholder={t.game.alliances.tagPlaceholder}
                  maxLength={10}
                  required
                  disabled={creating}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t.game.alliances.descriptionField}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.game.alliances.descriptionPlaceholder}
                rows={3}
                disabled={creating}
              />
            </div>
            <Button type="submit" disabled={creating || !name.trim() || !tag.trim()}>
              {creating ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  {t.game.alliances.creating}
                </>
              ) : (
                t.game.alliances.createButton
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Alliances list */}
      {alliances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t.game.alliances.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alliances.map((alliance) => (
            <Card key={alliance.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{alliance.name}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                          [{alliance.tag}]
                        </span>
                      </div>
                      {alliance.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{alliance.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(alliance.created_at)}
                      </p>
                    </div>
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
                          {t.game.alliances.deleteConfirm}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(alliance.id)}
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
