const en = {
  // Common
  common: {
    appName: 'Mawster',
    loading: 'Loading...',
    error: 'Error',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    notAvailable: 'Not available',
    invalidDate: 'Invalid date',
    never: 'Never',
    active: 'Active',
    page: 'Page',
  },

  // Navigation
  nav: {
    home: 'Home',
    profile: 'My Profile',
    gameAccounts: 'Game Accounts',
    alliances: 'Alliances',
    administration: 'Administration',
    signIn: 'Sign in',
    signOut: 'Sign out',
  },

  // Landing page
  landing: {
    wip: '🚧 Work in Progress',
    wipDescription: 'The application is under development. Come back soon!',
  },

  // Login page
  login: {
    title: 'Sign In',
    subtitle: 'Sign in with your Discord account',
    discordButton: 'Sign in with Discord',
    signingIn: 'Signing in...',
    errorGeneric: 'An error occurred during sign in',
  },

  // Register page
  register: {
    title: 'Create an account',
    subtitle: 'Sign in with Discord to automatically create your account',
    discordButton: 'Sign up with Discord',
  },

  // Profile page
  profile: {
    title: 'Profile',
    user: 'User',
    accountInfo: 'Account Information',
    username: 'Username',
    email: 'Email',
    discordId: 'Discord ID',
    memberSince: 'Member since',
    discordConnection: 'Discord Connection',
    discordConnected: 'Discord account connected',
    signOut: 'Sign out',
    dangerZone: 'Danger Zone',
    deleteAccount: 'Delete my account',
    deleteWarning: 'This action is irreversible. All your data will be permanently deleted.',
    deleteConfirmation: 'DELETE',
    deleteError: 'An error occurred while deleting the account',
  },

  // Game
  game: {
    accounts: {
      title: 'Game Accounts',
      description: 'Manage your Marvel Contest of Champions game accounts.',
      pseudo: 'Game Pseudo',
      pseudoPlaceholder: 'Enter your in-game name',
      isPrimary: 'Primary account',
      createTitle: 'Add a Game Account',
      createButton: 'Add account',
      creating: 'Creating...',
      empty: 'No game accounts yet. Add one to get started!',
      primary: 'Primary',
      deleteConfirm: 'Are you sure you want to delete this game account?',
      createSuccess: 'Game account created successfully!',
      createError: 'Failed to create game account',
      deleteSuccess: 'Game account deleted successfully!',
      deleteError: 'Failed to delete game account',
    },
    alliances: {
      title: 'Alliances',
      description: 'Browse and create alliances for your alliance wars.',
      name: 'Alliance Name',
      namePlaceholder: 'e.g. Mighty Warriors',
      tag: 'Tag',
      tagPlaceholder: 'e.g. MW',
      createTitle: 'Create an Alliance',
      createButton: 'Create alliance',
      creating: 'Creating...',
      empty: 'No alliances yet. Create the first one!',
      members: 'members',
      deleteConfirm: 'Are you sure you want to delete this alliance?',
      createSuccess: 'Alliance created successfully!',
      createError: 'Failed to create alliance',
      deleteSuccess: 'Alliance deleted successfully!',
      deleteError: 'Failed to delete alliance',
    },
  },

  // Dashboard / Admin
  dashboard: {
    tableHeaders: {
      login: 'Login',
      email: 'Email',
      role: 'Role',
      creation: 'Created',
      lastLogin: 'Last login',
      status: 'Status',
      actions: 'Actions',
    },
    status: {
      all: 'All',
      enabled: 'Enabled',
      disabled: 'Disabled',
      deleted: 'Deleted',
    },
    roles: {
      all: 'All',
      user: 'user',
      admin: 'admin',
    },
    pagination: {
      perPage: '{count} per page',
      usersPerPage: 'Users per page',
      selectRole: 'Select a role',
      default: '(Default)',
      resetFilters: 'Reset filters',
    },
    actions: {
      promote: 'Promote to admin',
      enable: 'Enable',
      disable: 'Disable',
      delete: 'Delete',
      isAdmin: 'This user is an administrator',
      isDeleted: 'This user is deleted',
    },
    dialogs: {
      enableUser: 'Enable user',
      enableUserDesc: 'Are you sure you want to re-enable this user?',
      disableUser: 'Disable user',
      disableUserDesc: 'Are you sure you want to disable this user?',
      deleteUser: 'Delete user',
      deleteUserDesc: 'Are you sure you want to delete this user? This action is irreversible.',
      promoteUser: 'Promote to administrator',
      promoteUserDesc: 'Are you sure you want to promote this user to administrator?',
    },
    errors: {
      unauthorized: 'Unauthorized',
      loadError: 'An error occurred while loading users',
    },
  },
} as const;

export default en;

// Recursively convert literal string types to string
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Translations = DeepStringify<typeof en>;
