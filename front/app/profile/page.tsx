'use client';

import { useSession, signOut } from 'next-auth/react';
import { redirect, usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteAccount } from '@/app/services/users';
import { Button } from '@/components/ui/button';
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
import { Loader } from 'lucide-react';
import { LuLogOut, LuTrash2 } from 'react-icons/lu';

export default function ProfilePage() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState('');

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setError('');

    try {
      await deleteAccount(session?.accessToken);
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
      redirect: true
    });
  };

  if (status === 'loading') {
    return <div className='flex justify-center items-center h-full'>Chargement...</div>;
  }

  return (
    <div className='max-w-4xl mx-auto p-6'>
      <div className='bg-white rounded-lg shadow-md p-6'>
        <h1 className='text-2xl font-bold mb-6 text-gray-800'>Mon Profil</h1>

        <div className='space-y-6'>
          <div className='border-b pb-6'>
            <h2 className='text-lg font-semibold mb-4 text-gray-700'>Informations du compte</h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <p className='text-sm font-medium text-gray-500'>Nom d'utilisateur</p>
                <p className='mt-1 text-gray-800'>{session?.user?.name || 'Non défini'}</p>
              </div>
              <div>
                <p className='text-sm font-medium text-gray-500'>Email</p>
                <p className='mt-1 text-gray-800'>{session?.user?.email || 'Non défini'}</p>
              </div>
              <div>
                <p className='text-sm font-medium text-gray-500'>Rôle</p>
                <p className='mt-1 text-gray-800 capitalize'>
                  {session?.user?.role ? (
                    <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                      {session.user.role.toLowerCase()}
                    </span>
                  ) : (
                    'Non défini'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className='flex justify-end'>
            <Button
              variant="destructive"
              className="w-full mt-4"
              onClick={handleSignOut}
            >
              <LuLogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </Button>
          </div>

          {/* Section de suppression de compte */}
          <div className='border-t border-red-200 pt-6'>
            <h2 className='text-lg font-semibold mb-4 text-red-700'>Zone de danger</h2>
            <div className='bg-red-50 p-4 rounded-md border border-red-200'>
              <h3 className='font-medium text-red-800'>Supprimer mon compte</h3>
              <p className='text-sm text-red-600 mt-1 mb-3'>
                Cette action est irréversible. Toutes vos données seront définitivement supprimées.
              </p>

              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                  if (!isDeleting) {
                    setIsDeleteDialogOpen(open);
                    if (!open) {
                      setError('');
                    }
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant='destructive'
                    className='whitespace-normal text-left min-h-[2.5rem] h-auto py-2'
                  >
                    <LuTrash2 className='flex-shrink-0 -ml-1 mr-2 h-4 w-4' />
                    <span className='break-words'>Supprimer mon compte</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className='max-w-md'>
                  <AlertDialogHeader>
                    <AlertDialogTitle className='text-lg font-semibold text-gray-900'>
                      Êtes-vous absolument sûr ?
                    </AlertDialogTitle>
                    <AlertDialogDescription className='text-gray-600'>
                      Cette action est irréversible. Toutes vos données seront définitivement supprimées.
                      {error && <p className='mt-2 text-sm text-red-600'>{error}</p>}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className='flex flex-col-reverse sm:flex-row sm:justify-between gap-2'>
                    <AlertDialogCancel
                      disabled={isDeleting}
                      className='w-full mt-0 sm:w-auto bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                      onClick={() => {
                        setError('');
                      }}
                    >
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClickCapture={handleDeleteAccount}
                      disabled={isDeleting}
                      className='w-full sm:w-auto bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-white'
                    >
                      {isDeleting ? (
                        <>
                          <Loader className='w-4 h-4 mr-2 animate-spin' />
                          Suppression...
                        </>
                      ) : (
                        'Supprimer définitivement'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
  