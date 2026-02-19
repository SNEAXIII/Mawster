import { Translations } from './en';

const fr: Translations = {
  // Common
  common: {
    appName: 'Mawster',
    loading: 'Chargement...',
    error: 'Erreur',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    back: 'Retour',
    notAvailable: 'Non disponible',
    invalidDate: 'Date invalide',
    never: 'Jamais',
    active: 'Actif',
    page: 'Page',
  },

  // Navigation
  nav: {
    home: 'Accueil',
    profile: 'Mon Profil',
    administration: 'Administration',
    signIn: 'Se connecter',
    signOut: 'Se déconnecter',
  },

  // Landing page
  landing: {
    wip: '🚧 Work in Progress',
    wipDescription: "L'application est en cours de développement. Revenez bientôt !",
  },

  // Login page
  login: {
    title: 'Connexion',
    subtitle: 'Connectez-vous avec votre compte Discord',
    discordButton: 'Se connecter avec Discord',
    signingIn: 'Connexion en cours...',
    errorGeneric: 'Une erreur est survenue lors de la connexion',
  },

  // Register page
  register: {
    title: 'Créer un compte',
    subtitle: 'Connectez-vous avec Discord pour créer automatiquement votre compte',
    discordButton: "S'inscrire avec Discord",
  },

  // Profile page
  profile: {
    title: 'Profil',
    user: 'Utilisateur',
    accountInfo: 'Informations du compte',
    username: "Nom d'utilisateur",
    email: 'Email',
    discordId: 'Discord ID',
    memberSince: 'Membre depuis',
    discordConnection: 'Connexion Discord',
    discordConnected: 'Compte Discord connecté',
    signOut: 'Se déconnecter',
    dangerZone: 'Zone de danger',
    deleteAccount: 'Supprimer mon compte',
    deleteWarning:
      'Cette action est irréversible. Toutes vos données seront définitivement supprimées.',
    deleteConfirmation: 'SUPPRIMER',
    deleteError: 'Une erreur est survenue lors de la suppression du compte',
  },

  // Dashboard / Admin
  dashboard: {
    tableHeaders: {
      login: 'Login',
      email: 'Email',
      role: 'Rôle',
      creation: 'Création',
      lastLogin: 'Dernière connexion',
      status: 'Status',
      actions: 'Actions',
    },
    status: {
      all: 'Tous',
      enabled: 'Activé',
      disabled: 'Désactivé',
      deleted: 'Supprimé',
    },
    roles: {
      all: 'Tous',
      user: 'user',
      admin: 'admin',
    },
    pagination: {
      perPage: '{count} par page',
      usersPerPage: "Nombre d'utilisateurs par page",
      selectRole: 'Sélectionnez un rôle',
      default: '(Défaut)',
      resetFilters: 'Réinitialiser les filtres',
    },
    actions: {
      promote: 'Promouvoir administrateur',
      enable: 'Activer',
      disable: 'Désactiver',
      delete: 'Supprimer',
      isAdmin: 'Cet utilisateur est un administrateur',
      isDeleted: 'Cet utilisateur est supprimé',
    },
    dialogs: {
      enableUser: "Activer l'utilisateur",
      enableUserDesc: 'Êtes-vous sûr de vouloir réactiver cet utilisateur ?',
      disableUser: "Désactiver l'utilisateur",
      disableUserDesc: 'Êtes-vous sûr de vouloir désactiver cet utilisateur ?',
      deleteUser: "Supprimer l'utilisateur",
      deleteUserDesc:
        'Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.',
      promoteUser: 'Promouvoir en administrateur',
      promoteUserDesc:
        'Êtes-vous sûr de vouloir promouvoir cet utilisateur en administrateur ?',
    },
    errors: {
      unauthorized: 'Non autorisé',
      loadError: 'Une erreur est survenue lors du chargement des utilisateurs',
    },
  },
} as const;

export default fr;
