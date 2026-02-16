'use client';

import { useSession, signOut } from 'next-auth/react';
import { redirect, usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteAccount } from '@/app/services/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
import { Input } from '@/components/ui/input';
import { Loader } from 'lucide-react';
import { LuLogOut, LuTrash2, LuShield, LuMail, LuUser, LuCalendar, LuHash } from 'react-icons/lu';
import { FaDiscord } from 'react-icons/fa';

const CONFIRMATION_TEXT = 'SUPPRIMER';

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Non disponible';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(dateString));
  } catch {
    return 'Date invalide';
  }
}

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(/[\s_-]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [error, setError] = useState('');

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const handleDeleteAccount = async () => {
    if (confirmationInput !== CONFIRMATION_TEXT) return;

    setIsDeleting(true);
    setError('');

    try {
      await deleteAccount(confirmationInput);
      await signOut({ redirect: false });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Erreur lors de la suppression du compte:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la suppression du compte'
      );
      setIsDeleting(false);
    }
  };

  const handleSignOut = () => {
    signOut({
      callbackUrl: '/',
      redirect: true,
    });
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* En-tête profil avec avatar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="h-24 w-24 ring-2 ring-offset-2 ring-blue-200">
              <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.name ?? 'Avatar'} />
              <AvatarFallback className="text-2xl font-bold bg-blue-100 text-blue-700">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">{user?.name ?? 'Utilisateur'}</h1>
              <p className="text-gray-500">{user?.email ?? ''}</p>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <LuShield className="h-3 w-3" />
                {user?.role?.toLowerCase() ?? 'utilisateur'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informations du compte */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations du compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow icon={<LuUser className="h-4 w-4" />} label="Nom d'utilisateur" value={user?.name} />
            <InfoRow icon={<LuMail className="h-4 w-4" />} label="Email" value={user?.email} />
            <InfoRow icon={<FaDiscord className="h-4 w-4" />} label="Discord ID" value={user?.discord_id} />
            <InfoRow icon={<LuCalendar className="h-4 w-4" />} label="Membre depuis" value={formatDate(user?.created_at)} />
          </div>
        </CardContent>
      </Card>

      {/* Connexion Discord */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connexion Discord</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
            <FaDiscord className="h-6 w-6 text-[#5865F2]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Compte Discord connecte</p>
              <p className="text-xs text-gray-500">
                ID: {user?.discord_id ?? 'Non disponible'}
              </p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Actif
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bouton deconnexion */}
      <Button variant="outline" className="w-full" onClick={handleSignOut}>
        <LuLogOut className="mr-2 h-4 w-4" />
        Se deconnecter
      </Button>

      {/* Zone de danger */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-lg text-red-700">Zone de danger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h3 className="font-medium text-red-800">Supprimer mon compte</h3>
            <p className="text-sm text-red-600 mt-1 mb-4">
              Cette action est irreversible. Toutes vos donnees seront definitivement supprimees.
            </p>

            <AlertDialog
              open={isDeleteDialogOpen}
              onOpenChange={(open) => {
                if (!isDeleting) {
                  setIsDeleteDialogOpen(open);
                  if (!open) {
                    setError('');
                    setConfirmationInput('');
                  }
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="whitespace-normal text-left min-h-[2.5rem] h-auto py-2"
                >
                  <LuTrash2 className="flex-shrink-0 -ml-1 mr-2 h-4 w-4" />
                  <span className="break-words">Supprimer mon compte</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-lg font-semibold text-gray-900">
                    Etes-vous absolument sur ?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="text-gray-600 space-y-3">
                      <p>
                        Cette action est irreversible. Toutes vos donnees seront definitivement supprimees.
                      </p>
                      <p className="text-sm font-medium text-gray-700">
                        Tapez <span className="font-mono font-bold text-red-600">{CONFIRMATION_TEXT}</span> pour confirmer :
                      </p>
                      <Input
                        value={confirmationInput}
                        onChange={(e) => setConfirmationInput(e.target.value)}
                        placeholder={CONFIRMATION_TEXT}
                        className="font-mono"
                        disabled={isDeleting}
                        autoComplete="off"
                      />
                      {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                  <AlertDialogCancel
                    disabled={isDeleting}
                    className="w-full mt-0 sm:w-auto bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                    onClick={() => {
                      setError('');
                      setConfirmationInput('');
                    }}
                  >
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClickCapture={handleDeleteAccount}
                    disabled={isDeleting || confirmationInput !== CONFIRMATION_TEXT}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-white disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      'Supprimer definitivement'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 text-sm text-gray-900 truncate">{value ?? 'Non disponible'}</p>
      </div>
    </div>
  );
}
  